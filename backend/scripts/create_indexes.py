"""Database initialization and index creation script.

RULE-DB03: Every collection MUST have appropriate indexes.
Run: uv run python -m scripts.create_indexes
"""

from pymongo import MongoClient, ASCENDING, DESCENDING
from app.core.config import settings


def create_indexes():
    """Create all required MongoDB indexes as defined in architecture."""
    client = MongoClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DATABASE]

    print(f"Creating indexes on database: {settings.MONGODB_DATABASE}")

    # Ensure collections exist
    collection_names = [
        "users",
        "classrooms",
        "classroom_memberships",
        "assignments",
        "journals",
        "journal_versions",
        "journal_block_versions",
        "comments",
        "approvals",
        "notifications",
        "audit_logs",
    ]
    existing = db.list_collection_names()
    for name in collection_names:
        if name not in existing:
            db.create_collection(name)
            print(f"  Created collection: {name}")

    # users: Unique email
    db.users.create_index("email", unique=True, name="idx_users_email_unique")
    print("  Index: users.email (unique)")

    # classrooms: Unique joinCode
    db.classrooms.create_index(
        "joinCode", unique=True, name="idx_classrooms_joinCode_unique"
    )
    print("  Index: classrooms.joinCode (unique)")

    # classroom_memberships: Compound unique classroomId + studentId
    db.classroom_memberships.create_index(
        [("classroomId", ASCENDING), ("studentId", ASCENDING)],
        unique=True,
        name="idx_memberships_classroom_student_unique",
    )
    print("  Index: classroom_memberships.classroomId+studentId (compound unique)")

    # assignments: classroomId
    db.assignments.create_index(
        "classroomId", name="idx_assignments_classroomId"
    )
    print("  Index: assignments.classroomId")

    # journals: compound assignmentId + studentId, studentId, status
    db.journals.create_index(
        [("assignmentId", ASCENDING), ("studentId", ASCENDING)],
        name="idx_journals_assignment_student",
    )
    db.journals.create_index("studentId", name="idx_journals_studentId")
    db.journals.create_index("status", name="idx_journals_status")
    print("  Index: journals.assignmentId+studentId, studentId, status")

    # journal_versions: unique journalId + revisionNumber, journalId + createdAt
    db.journal_versions.create_index(
        [("journalId", ASCENDING), ("revisionNumber", ASCENDING)],
        unique=True,
        name="idx_versions_journal_revision_unique",
    )
    db.journal_versions.create_index(
        [("journalId", ASCENDING), ("createdAt", DESCENDING)],
        name="idx_versions_journal_createdAt",
    )
    db.journal_versions.create_index(
        [("authorId", ASCENDING), ("createdAt", DESCENDING)],
        name="idx_versions_author_createdAt",
    )
    print("  Index: journal_versions (3 indexes)")

    # journal_block_versions: compound unique [journalId + blockId + revisionNumber], journalId + revisionNumber
    db.journal_block_versions.create_index(
        [
            ("journalId", ASCENDING),
            ("blockId", ASCENDING),
            ("revisionNumber", DESCENDING),
        ],
        unique=True,
        name="idx_block_versions_lookup_unique",
    )
    db.journal_block_versions.create_index(
        [("journalId", ASCENDING), ("revisionNumber", DESCENDING)],
        name="idx_block_versions_journal_rev",
    )
    print("  Index: journal_block_versions (2 indexes)")

    # comments: journalId + blockId, journalId + status, authorId
    db.comments.create_index(
        [("journalId", ASCENDING), ("blockId", ASCENDING)],
        name="idx_comments_journal_block",
    )
    db.comments.create_index(
        [("journalId", ASCENDING), ("status", ASCENDING)],
        name="idx_comments_journal_status",
    )
    db.comments.create_index("authorId", name="idx_comments_authorId")
    print("  Index: comments (3 indexes)")

    # approvals: journalId, teacherId
    db.approvals.create_index("journalId", name="idx_approvals_journalId")
    db.approvals.create_index("teacherId", name="idx_approvals_teacherId")
    print("  Index: approvals (2 indexes)")

    # notifications: userId + isRead, userId + createdAt, and 7-day TTL on readAt
    db.notifications.create_index(
        [("userId", ASCENDING), ("isRead", ASCENDING)],
        name="idx_notifications_user_read",
    )
    db.notifications.create_index(
        [("userId", ASCENDING), ("createdAt", DESCENDING)],
        name="idx_notifications_user_createdAt",
    )
    db.notifications.create_index(
        "readAt",
        expireAfterSeconds=7 * 86400,
        name="ttl_notifications_readAt_7d",
    )
    print("  Index: notifications (3 indexes)")

    # uploaded_assets: userId + isDeleted, and 3-day TTL on deletedAt
    db.uploaded_assets.create_index(
        [("userId", ASCENDING), ("isDeleted", ASCENDING)],
        name="idx_assets_user_deleted",
    )
    db.uploaded_assets.create_index(
        "deletedAt",
        expireAfterSeconds=3 * 86400,
        name="ttl_assets_deletedAt_3d",
    )
    print("  Index: uploaded_assets (2 indexes)")

    # audit_logs: entity + entityId, timestamp, userId
    db.audit_logs.create_index(
        [("entity", ASCENDING), ("entityId", ASCENDING)],
        name="idx_audit_entity",
    )
    db.audit_logs.create_index(
        [("timestamp", DESCENDING)],
        name="idx_audit_timestamp",
    )
    db.audit_logs.create_index("userId", name="idx_audit_userId")
    print("  Index: audit_logs (3 indexes)")

    client.close()
    print("All indexes created successfully.")


if __name__ == "__main__":
    create_indexes()
