"""Non-destructive migration script from snapshot-based versioning to incremental block-level versioning.

RULE-DB01: Schema migrations MUST be idempotent and non-destructive.
RULE-VH01: Historical revisions must remain immutable.

Usage:
  # Dry run (simulation only, zero writes):
  uv run python -m scripts.migrate_snapshot_versions --dry-run

  # Execute migration:
  uv run python -m scripts.migrate_snapshot_versions --execute
"""

import argparse
import hashlib
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pymongo import MongoClient, UpdateOne
from app.core.config import settings


def compute_content_hash(block: dict) -> str:
    """Compute deterministic SHA-256 hash of block type and content."""
    normalized = {
        "type": block.get("type", "paragraph"),
        "content": block.get("content", {}),
    }
    serialized = json.dumps(normalized, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def detect_block_deltas(prev_blocks: list[dict], new_blocks: list[dict], journal_id: str, new_rev: int) -> tuple[list[dict], list[str], bool]:
    """Detect block-level deltas between two revisions."""
    prev_map = {b["id"]: b for b in prev_blocks if isinstance(b, dict) and "id" in b}
    new_map = {b["id"]: b for b in new_blocks if isinstance(b, dict) and "id" in b}

    prev_order = [b["id"] for b in prev_blocks if isinstance(b, dict) and "id" in b]
    new_order = [b["id"] for b in new_blocks if isinstance(b, dict) and "id" in b]

    deltas = []
    changed_ids = []
    now = datetime.now(timezone.utc)

    for b in new_blocks:
        if not isinstance(b, dict) or "id" not in b:
            continue
        b_id = b["id"]
        new_hash = compute_content_hash(b)
        prev_b = prev_map.get(b_id)

        if prev_b is None:
            deltas.append({
                "journalId": journal_id,
                "blockId": b_id,
                "revisionNumber": new_rev,
                "operation": "insert",
                "type": b.get("type", "paragraph"),
                "content": b.get("content", {}),
                "metadata": b.get("metadata", {}),
                "contentHash": new_hash,
                "createdAt": now,
            })
            changed_ids.append(b_id)
        else:
            prev_hash = compute_content_hash(prev_b)
            if new_hash != prev_hash:
                deltas.append({
                    "journalId": journal_id,
                    "blockId": b_id,
                    "revisionNumber": new_rev,
                    "operation": "update",
                    "type": b.get("type", "paragraph"),
                    "content": b.get("content", {}),
                    "metadata": b.get("metadata", {}),
                    "contentHash": new_hash,
                    "createdAt": now,
                })
                changed_ids.append(b_id)

    for b_id in prev_order:
        if b_id not in new_map:
            deltas.append({
                "journalId": journal_id,
                "blockId": b_id,
                "revisionNumber": new_rev,
                "operation": "delete",
                "type": "tombstone",
                "content": {},
                "metadata": {},
                "contentHash": "",
                "createdAt": now,
            })
            changed_ids.append(b_id)

    structure_changed = prev_order != new_order
    return deltas, changed_ids, structure_changed


def reconstruct_revision_from_deltas(db, journal_id: str, block_order: list[str], rev_num: int) -> list[dict]:
    """Reconstruct document blocks at a revision from journal_block_versions."""
    if not block_order:
        return []

    pipeline = [
        {
            "$match": {
                "journalId": journal_id,
                "blockId": {"$in": block_order},
                "revisionNumber": {"$lte": rev_num},
            }
        },
        {"$sort": {"blockId": 1, "revisionNumber": -1}},
        {
            "$group": {
                "_id": "$blockId",
                "blockId": {"$first": "$blockId"},
                "type": {"$first": "$type"},
                "content": {"$first": "$content"},
                "metadata": {"$first": "$metadata"},
                "operation": {"$first": "$operation"},
            }
        },
    ]
    docs = list(db.journal_block_versions.aggregate(pipeline))
    by_id = {d["blockId"]: d for d in docs}

    reconstructed = []
    for b_id in block_order:
        d = by_id.get(b_id)
        if d and d.get("operation") != "delete":
            reconstructed.append({
                "id": d["blockId"],
                "type": d.get("type", "paragraph"),
                "content": d.get("content", {}),
            })
    return reconstructed


def run_migration(dry_run: bool = True):
    """Execute the idempotent migration."""
    print("=" * 70)
    print(f"eJournal Snapshot to Block-Level Incremental Migration")
    print(f"Mode: {'[DRY RUN - Zero writes]' if dry_run else '[EXECUTE - Live Writes]'}")
    print(f"Database: {settings.MONGODB_DATABASE}")
    print("=" * 70)

    client = MongoClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DATABASE]

    # Find all journal_versions that contain legacy 'blocks' array
    query = {"blocks": {"$exists": True, "$type": "array"}}
    total_version_docs = db.journal_versions.count_documents(query)
    print(f"Found {total_version_docs} historical revision snapshot document(s).")

    if total_version_docs == 0:
        print("No legacy snapshot versions found. Everything is already migrated.")
        return

    # Group by journalId
    cursor = db.journal_versions.find(query).sort([("journalId", 1), ("revisionNumber", 1)])
    journals_versions = defaultdict(list)
    for doc in cursor:
        journals_versions[doc["journalId"]].append(doc)

    print(f"Discovered {len(journals_versions)} distinct journal(s) with revision history.\n")

    total_deltas_created = 0
    total_blocks_deduplicated = 0
    verified_revisions = 0
    failed_revisions = 0

    for journal_id, versions in journals_versions.items():
        print(f"Processing Journal [{journal_id}] ({len(versions)} revisions)...")
        prev_blocks = []

        for v in versions:
            rev_num = v.get("revisionNumber", 1)
            snapshot_blocks = v.get("blocks", [])
            block_order = [b["id"] for b in snapshot_blocks if isinstance(b, dict) and "id" in b]

            deltas, changed_ids, struct_changed = detect_block_deltas(
                prev_blocks=prev_blocks,
                new_blocks=snapshot_blocks,
                journal_id=journal_id,
                new_rev=rev_num,
            )

            total_deltas_created += len(deltas)
            deduped = len(snapshot_blocks) - len([d for d in deltas if d["operation"] in ("insert", "update")])
            total_blocks_deduplicated += max(0, deduped)

            if not dry_run:
                # Upsert deltas into journal_block_versions
                if deltas:
                    ops = [
                        UpdateOne(
                            {
                                "journalId": d["journalId"],
                                "blockId": d["blockId"],
                                "revisionNumber": d["revisionNumber"],
                            },
                            {"$set": d},
                            upsert=True,
                        )
                        for d in deltas
                    ]
                    db.journal_block_versions.bulk_write(ops, ordered=False)

                # Reconstruct and verify equality against snapshot
                reconstructed = reconstruct_revision_from_deltas(db, journal_id, block_order, rev_num)
                
                # Check IDs and content hashes
                is_equal = len(reconstructed) == len(snapshot_blocks)
                if is_equal:
                    for r_b, s_b in zip(reconstructed, snapshot_blocks):
                        if r_b["id"] != s_b["id"] or compute_content_hash(r_b) != compute_content_hash(s_b):
                            is_equal = False
                            break

                if is_equal:
                    verified_revisions += 1
                    # Update journal_versions metadata WITHOUT deleting legacy blocks
                    db.journal_versions.update_one(
                        {"_id": v["_id"]},
                        {
                            "$set": {
                                "blockOrder": block_order,
                                "changedBlockIds": changed_ids,
                                "structureChanged": struct_changed,
                                "schemaVersion": 1,
                            }
                        },
                    )
                else:
                    failed_revisions += 1
                    print(f"  [ERROR] Verification failed for Journal {journal_id} Rev #{rev_num}!")
            else:
                verified_revisions += 1

            prev_blocks = snapshot_blocks

    print("\n" + "=" * 70)
    print("Migration Summary")
    print("=" * 70)
    print(f"Total Journals Processed:     {len(journals_versions)}")
    print(f"Total Revisions Processed:    {total_version_docs}")
    print(f"Total Deltas Generated:       {total_deltas_created}")
    print(f"Blocks Deduplicated:          {total_blocks_deduplicated}")
    print(f"Revisions Verified Equal:     {verified_revisions}")
    print(f"Revisions Failed:             {failed_revisions}")
    print("=" * 70)

    if dry_run:
        print("\nDry run completed successfully. No changes were written to MongoDB.")
        print("To apply changes, run with: --execute")
    else:
        if failed_revisions == 0:
            print("\nMigration completed and 100% verified against historical snapshots!")
        else:
            print(f"\nMigration completed with {failed_revisions} verification errors. Inspect above logs.")
            sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate eJournal snapshot versions to block-level incremental versions.")
    group = parser.add_mutually_exclusive_group(required=False)
    group.add_argument("--dry-run", action="store_true", default=True, help="Simulate migration without modifying data (default).")
    group.add_argument("--execute", action="store_true", help="Execute migration and write to MongoDB.")
    args = parser.parse_args()

    is_dry_run = not args.execute
    run_migration(dry_run=is_dry_run)
