"""Safe, idempotent migration script to backfill notification entity references and categories.

Backfills:
- entityType: 'journal' | 'assignment' | 'classroom'
- entityId: target primary entity ID (journalId, assignmentId, classroomId)
- subEntityId: blockId or sub-item ID (if applicable)
- classroomId: associated classroom ID
- category: 'submission' | 'late_submission' | 'revision' | 'approval' | 'question' | 'suggestion' | 'warning' | 'comment' | 'assignment' | 'announcement'
"""

import asyncio
import os
import sys
import re
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bson import ObjectId
from app.core.database import connect_to_mongodb, close_mongodb_connection, get_async_database


async def migrate():
    await connect_to_mongodb()
    db = get_async_database()
    notifications_col = db["notifications"]
    journals_col = db["journals"]
    assignments_col = db["assignments"]
    users_col = db["users"]

    cursor = notifications_col.find({})
    docs = await cursor.to_list(length=2000)
    print(f"Loaded {len(docs)} notification records for inspection.")

    updated_count = 0

    for doc in docs:
        doc_id = doc["_id"]
        title = doc.get("title") or ""
        msg = doc.get("message") or ""
        notif_type = doc.get("type") or ""
        link = doc.get("link") or ""
        metadata = doc.get("metadata") or {}

        existing_entity_type = doc.get("entityType")
        existing_entity_id = doc.get("entityId")
        existing_sub_entity_id = doc.get("subEntityId")
        existing_classroom_id = doc.get("classroomId")
        existing_category = doc.get("category")

        # 1. Determine Category
        category = existing_category
        if not category:
            if metadata.get("category"):
                category = metadata["category"].lower()
            elif notif_type == "announcement" or "announcement" in title.lower():
                category = "announcement"
            elif notif_type == "assignment" or "assignment" in title.lower():
                category = "assignment"
            elif notif_type == "submission" or "submission" in title.lower() or "handed in" in msg.lower():
                if "late" in msg.lower() or "late" in title.lower():
                    category = "late_submission"
                else:
                    category = "submission"
            elif notif_type in ["revision", "changes_requested"] or "changes requested" in title.lower() or "requested revisions" in msg.lower():
                category = "revision"
            elif notif_type == "approval" or "approved" in title.lower() or "approved" in msg.lower():
                category = "approval"
            elif notif_type == "comment" or "comment" in title.lower():
                t_lower = title.lower()
                if "suggestion" in t_lower:
                    category = "suggestion"
                elif "question" in t_lower:
                    category = "question"
                elif "warning" in t_lower:
                    category = "warning"
                elif "approval" in t_lower:
                    category = "approval"
                else:
                    category = "comment"
            else:
                category = "comment"

        # 2. Determine Entity Type
        entity_type = existing_entity_type
        if not entity_type:
            raw_meta_type = (metadata.get("entityType") or "").lower()
            if raw_meta_type in ["journals", "journal"]:
                entity_type = "journal"
            elif raw_meta_type in ["assignments", "assignment"]:
                entity_type = "assignment"
            elif raw_meta_type in ["classrooms", "classroom"]:
                entity_type = "classroom"
            elif category in ["submission", "late_submission", "revision", "approval", "question", "suggestion", "warning", "comment"]:
                entity_type = "journal"
            elif category == "assignment":
                entity_type = "assignment"
            elif category == "announcement":
                entity_type = "classroom"

        # 3. Determine Entity ID
        entity_id = existing_entity_id
        if not entity_id:
            entity_id = metadata.get("entityId") or metadata.get("journalId") or metadata.get("assignmentId")

            # Extract from link if available
            if not entity_id and link:
                editor_match = re.search(r"/editor/([a-fA-F0-9]{24}|[a-zA-Z0-9_-]+)", link)
                if editor_match:
                    entity_id = editor_match.group(1)
                    if not entity_type:
                        entity_type = "journal"

                asg_match = re.search(r"assignmentId=([a-fA-F0-9]{24}|[a-zA-Z0-9_-]+)", link)
                if asg_match and entity_type == "assignment":
                    entity_id = asg_match.group(1)

            # Special resolution for submission notifications (e.g. 6a82cefe26353818b5ea543b)
            if not entity_id and entity_type == "journal" and category in ["submission", "late_submission"]:
                # Try to extract classroomId from link: /classrooms/{classroomId}
                cls_match = re.search(r"/classrooms/([a-fA-F0-9]{24}|[a-zA-Z0-9_-]+)", link)
                cls_id = cls_match.group(1) if cls_match else None
                # Try to extract experiment number from message: "Experiment #1"
                exp_match = re.search(r"Experiment #(\d+)", msg)
                exp_num = int(exp_match.group(1)) if exp_match else None

                if cls_id and exp_num is not None:
                    # Find assignment for this experiment
                    asg = await assignments_col.find_one({"classroomId": cls_id, "experimentNumber": exp_num})
                    if asg:
                        # Find journal for this assignment
                        asg_id = str(asg.get("_id") if isinstance(asg.get("_id"), ObjectId) else asg.get("id"))
                        # Search journals for this assignmentId
                        journal = await journals_col.find_one({"assignmentId": asg_id})
                        if journal:
                            entity_id = str(journal.get("_id") if isinstance(journal.get("_id"), ObjectId) else journal.get("id"))
                            print(f"Resolved submission notification {doc_id} to journalId: {entity_id}")

        # 4. Determine Sub Entity ID (e.g. blockId)
        sub_entity_id = existing_sub_entity_id
        if not sub_entity_id:
            sub_entity_id = metadata.get("subEntityId") or metadata.get("blockId")
            if not sub_entity_id and link:
                block_match = re.search(r"blockId=([^&]+)", link)
                if block_match:
                    sub_entity_id = block_match.group(1)

        # 5. Determine Classroom ID
        classroom_id = existing_classroom_id
        if not classroom_id:
            classroom_id = metadata.get("classroomId")
            if not classroom_id and link:
                cls_match = re.search(r"/classrooms/([a-fA-F0-9]{24}|[a-zA-Z0-9_-]+)", link)
                if cls_match:
                    classroom_id = cls_match.group(1)

        # Build update fields if changed
        updates = {}
        if doc.get("entityType") != entity_type and entity_type is not None:
            updates["entityType"] = entity_type
        if doc.get("entityId") != entity_id and entity_id is not None:
            updates["entityId"] = entity_id
        if doc.get("subEntityId") != sub_entity_id and sub_entity_id is not None:
            updates["subEntityId"] = sub_entity_id
        if doc.get("classroomId") != classroom_id and classroom_id is not None:
            updates["classroomId"] = classroom_id
        if doc.get("category") != category and category is not None:
            updates["category"] = category

        if updates:
            await notifications_col.update_one({"_id": doc_id}, {"$set": updates})
            updated_count += 1

    print(f"Migration completed successfully: {updated_count} notifications updated.")
    await close_mongodb_connection()


if __name__ == "__main__":
    asyncio.run(migrate())
