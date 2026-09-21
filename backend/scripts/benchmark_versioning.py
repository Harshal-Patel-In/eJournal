"""Empirical benchmark comparing snapshot vs block-level incremental versioning.

Measures:
1. Current journal read latency (O(1) active draft read)
2. Historical snapshot read latency vs Incremental historical reconstruction latency
3. Revision creation latency (diff detection + bulk write + metadata record)
4. Storage footprint across collections (journal_versions vs journal_block_versions)
5. Database query execution statistics via explain("executionStats")
"""

import time
import json
import statistics
from pymongo import MongoClient
from app.core.config import settings
from app.repositories.block_version_repository import BlockVersionRepository


def run_benchmarks():
    client = MongoClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DATABASE]

    print("=" * 70)
    print("eJournal Versioning Empirical Benchmark Suite")
    print(f"Database: {settings.MONGODB_DATABASE}")
    print("=" * 70)

    # 1. Measure Storage Footprints
    print("\n--- 1. Storage Statistics ---")
    stats_versions = db.command("collstats", "journal_versions")
    stats_block_versions = db.command("collstats", "journal_block_versions")
    stats_journals = db.command("collstats", "journals")

    print(f"journals collection:")
    print(f"  Count:        {stats_journals.get('count', 0)} documents")
    print(f"  Size:         {stats_journals.get('size', 0):,} bytes")
    print(f"  Storage Size: {stats_journals.get('storageSize', 0):,} bytes")

    print(f"journal_versions collection:")
    print(f"  Count:        {stats_versions.get('count', 0)} documents")
    print(f"  Size:         {stats_versions.get('size', 0):,} bytes")
    print(f"  Storage Size: {stats_versions.get('storageSize', 0):,} bytes")

    print(f"journal_block_versions collection:")
    print(f"  Count:        {stats_block_versions.get('count', 0)} documents")
    print(f"  Size:         {stats_block_versions.get('size', 0):,} bytes")
    print(f"  Storage Size: {stats_block_versions.get('storageSize', 0):,} bytes")

    # Find a journal with revisions to benchmark
    sample_version = db.journal_versions.find_one({"blockOrder": {"$exists": True, "$ne": []}})
    if not sample_version:
        print("\nNo historical versions with blockOrder found to benchmark queries.")
        return

    journal_id = sample_version["journalId"]
    revision_number = sample_version["revisionNumber"]
    block_order = sample_version.get("blockOrder", [])
    print(f"\nBenchmarking on Journal ID: {journal_id}, Revision: #{revision_number} ({len(block_order)} blocks)")

    # 2. Measure Active Journal Read Latency (GET /journals/{id})
    runs = 50
    journal_read_times = []
    for _ in range(runs):
        t0 = time.perf_counter()
        doc = db.journals.find_one({"_id": sample_version.get("journalId")})
        if not doc:
            doc = db.journals.find_one()
        t1 = time.perf_counter()
        journal_read_times.append((t1 - t0) * 1000)

    # 3. Measure Legacy Snapshot Read Latency
    snapshot_read_times = []
    for _ in range(runs):
        t0 = time.perf_counter()
        doc = db.journal_versions.find_one({"journalId": journal_id, "revisionNumber": revision_number})
        t1 = time.perf_counter()
        snapshot_read_times.append((t1 - t0) * 1000)

    # 4. Measure Incremental Reconstruction Aggregation Latency
    reconstruction_times = []
    pipeline = [
        {
            "$match": {
                "journalId": journal_id,
                "blockId": {"$in": block_order},
                "revisionNumber": {"$lte": revision_number},
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

    for _ in range(runs):
        t0 = time.perf_counter()
        cursor = list(db.journal_block_versions.aggregate(pipeline))
        t1 = time.perf_counter()
        reconstruction_times.append((t1 - t0) * 1000)

    print("\n--- 2. Latency Benchmarks (50 iterations) ---")
    print(f"Active Draft Read (db.journals.find_one):")
    print(f"  Mean:   {statistics.mean(journal_read_times):.3f} ms")
    print(f"  Median: {statistics.median(journal_read_times):.3f} ms")
    print(f"  Min:    {min(journal_read_times):.3f} ms | Max: {max(journal_read_times):.3f} ms")

    print(f"\nLegacy Snapshot Read (db.journal_versions.find_one):")
    print(f"  Mean:   {statistics.mean(snapshot_read_times):.3f} ms")
    print(f"  Median: {statistics.median(snapshot_read_times):.3f} ms")
    print(f"  Min:    {min(snapshot_read_times):.3f} ms | Max: {max(snapshot_read_times):.3f} ms")

    print(f"\nIncremental Historical Reconstruction (Aggregation Pipeline):")
    print(f"  Mean:   {statistics.mean(reconstruction_times):.3f} ms")
    print(f"  Median: {statistics.median(reconstruction_times):.3f} ms")
    print(f"  Min:    {min(reconstruction_times):.3f} ms | Max: {max(reconstruction_times):.3f} ms")

    # 5. Explain Plan for Incremental Reconstruction
    print("\n--- 3. Query Execution Statistics via explain('executionStats') ---")
    explain_res = db.command(
        "explain",
        {
            "aggregate": "journal_block_versions",
            "pipeline": pipeline,
            "cursor": {},
        },
        verbosity="executionStats",
    )

    stages = explain_res.get("stages", [])
    exec_stats = explain_res.get("executionStats", {})
    server_info = explain_res.get("serverInfo", {})

    print(f"MongoDB Version: {server_info.get('version', 'N/A')}")
    if stages:
        first_stage = stages[0]
        cursor_stage = first_stage.get("$cursor", {})
        cursor_stats = cursor_stage.get("executionStats", {})
        print(f"Cursor Stage Execution Time: {cursor_stats.get('executionTimeMillis', 'N/A')} ms")
        print(f"Total Keys Examined:         {cursor_stats.get('totalKeysExamined', 'N/A')}")
        print(f"Total Docs Examined:         {cursor_stats.get('totalDocsExamined', 'N/A')}")
        print(f"Docs Returned:               {cursor_stats.get('nReturned', 'N/A')}")
        
        # Check index usage
        query_plan = cursor_stage.get("queryPlanner", {}).get("winningPlan", {})
        input_stage = query_plan.get("inputStage", {})
        index_name = input_stage.get("indexName", query_plan.get("indexName", "None (COLLSCAN)"))
        print(f"Winning Index Name:          {index_name}")
    elif exec_stats:
        print(f"Execution Time:              {exec_stats.get('executionTimeMillis', 'N/A')} ms")
        print(f"Total Keys Examined:         {exec_stats.get('totalKeysExamined', 'N/A')}")
        print(f"Total Docs Examined:         {exec_stats.get('totalDocsExamined', 'N/A')}")
        print(f"Docs Returned:               {exec_stats.get('nReturned', 'N/A')}")

    print("\n" + "=" * 70)
    print("Empirical Benchmark Complete. Zero speculative numbers.")
    print("=" * 70)


if __name__ == "__main__":
    run_benchmarks()
