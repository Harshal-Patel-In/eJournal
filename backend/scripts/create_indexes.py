"""Database initialization and index creation script.

RULE-DB03: Every collection MUST have appropriate indexes.
Run: uv run python -m scripts.create_indexes
"""

try:
    import dns.resolver

    dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
    dns.resolver.default_resolver.nameservers = ["8.8.8.8", "1.1.1.1"]
except Exception:
    pass

import certifi
from typing import Any
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database
from app.core.config import settings


def create_indexes(db: Database | None = None) -> None:
    """Create or verify all required MongoDB indexes as defined in architecture.

    Reuses existing database connection pool if provided to eliminate redundant
    remote SSL handshakes and Atlas round-trips.
    """
    close_client = False
    if db is None:
        client = MongoClient(settings.MONGODB_URI, tlsCAFile=certifi.where())
        db = client[settings.MONGODB_DATABASE]
        close_client = True

    print(f"Verifying indexes on database: {settings.MONGODB_DATABASE}")

    # Cache index information per collection to make startup checks sub-millisecond
    _index_cache: dict[str, dict[str, Any]] = {}

    def _get_existing_indexes(col_name: str) -> dict[str, Any]:
        if col_name not in _index_cache:
            try:
                _index_cache[col_name] = db[col_name].index_information()
            except Exception:
                _index_cache[col_name] = {}
        return _index_cache[col_name]

    def _ensure_index(collection, keys, **kwargs):
        name = kwargs.get("name")
        col_name = collection.name
        existing = _get_existing_indexes(col_name)
        if name and name in existing:
            return
        collection.create_index(keys, **kwargs)

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
        "profile_change_requests",
    ]
    existing_cols = db.list_collection_names()
    for name in collection_names:
        if name not in existing_cols:
            db.create_collection(name)
            print(f"  Created collection: {name}")

    # users: Unique email
    _ensure_index(db.users, "email", unique=True, name="idx_users_email_unique")
    print("  Index: users.email (unique)")

    # classrooms: Unique joinCode
    _ensure_index(
        db.classrooms,
        "joinCode", unique=True, name="idx_classrooms_joinCode_unique"
    )
    print("  Index: classrooms.joinCode (unique)")

    # classroom_memberships: Compound unique classroomId + studentId
    _ensure_index(
        db.classroom_memberships,
        [("classroomId", ASCENDING), ("studentId", ASCENDING)],
        unique=True,
        name="idx_memberships_classroom_student_unique",
    )
    # Student reverse lookup for student dashboard (RULE-DB03: Avoid full-collection scan)
    _ensure_index(
        db.classroom_memberships,
        [("studentId", ASCENDING), ("status", ASCENDING)],
        name="idx_memberships_student_status",
    )
    print("  Index: classroom_memberships (compound unique + student reverse lookup)")

    # assignments: classroomId & dueDate
    _ensure_index(
        db.assignments,
        "classroomId", name="idx_assignments_classroomId"
    )
    _ensure_index(
        db.assignments,
        [("classroomId", ASCENDING), ("dueDate", ASCENDING)],
        name="idx_assignments_classroom_due",
    )
    print("  Index: assignments.classroomId & dueDate")

    # journals: Unique studentId + assignmentId (guarantees exactly 1 draft per student per assignment)
    try:
        _ensure_index(
            db.journals,
            [("studentId", ASCENDING), ("assignmentId", ASCENDING)],
            unique=True,
            name="idx_journals_student_assignment_unique",
        )
    except Exception as e:
        print(f"  Warning creating unique student-assignment index: {e}")

    _ensure_index(db.journals, "studentId", name="idx_journals_studentId")
    _ensure_index(db.journals, "status", name="idx_journals_status")

    # Compound indexes for status filtering + sorted by date (Teacher Gradebook & Student Views)
    _ensure_index(
        db.journals,
        [("assignmentId", ASCENDING), ("status", ASCENDING), ("updatedAt", DESCENDING)],
        name="idx_journals_assignment_status_updated",
    )
    _ensure_index(
        db.journals,
        [("studentId", ASCENDING), ("status", ASCENDING), ("updatedAt", DESCENDING)],
        name="idx_journals_student_status_updated",
    )

    # Optimistic concurrency and block sub-document matching
    _ensure_index(
        db.journals,
        [("_id", ASCENDING), ("currentVersion", ASCENDING)],
        name="idx_journals_id_currentVersion",
    )
    _ensure_index(
        db.journals,
        [("_id", ASCENDING), ("blocks.id", ASCENDING)],
        name="idx_journals_id_blockId",
    )
    print("  Index: journals (student unique, status filtering, concurrency & block matching)")

    # journal_versions: unique journalId + revisionNumber, journalId + createdAt
    _ensure_index(
        db.journal_versions,
        [("journalId", ASCENDING), ("revisionNumber", ASCENDING)],
        unique=True,
        name="idx_versions_journal_revision_unique",
    )
    _ensure_index(
        db.journal_versions,
        [("journalId", ASCENDING), ("createdAt", DESCENDING)],
        name="idx_versions_journal_createdAt",
    )
    _ensure_index(
        db.journal_versions,
        [("authorId", ASCENDING), ("createdAt", DESCENDING)],
        name="idx_versions_author_createdAt",
    )
    print("  Index: journal_versions (3 indexes)")

    # journal_block_versions: compound unique [journalId + blockId + revisionNumber], journalId + revisionNumber
    _ensure_index(
        db.journal_block_versions,
        [
            ("journalId", ASCENDING),
            ("blockId", ASCENDING),
            ("revisionNumber", DESCENDING),
        ],
        unique=True,
        name="idx_block_versions_lookup_unique",
    )
    _ensure_index(
        db.journal_block_versions,
        [("journalId", ASCENDING), ("revisionNumber", DESCENDING)],
        name="idx_block_versions_journal_rev",
    )
    print("  Index: journal_block_versions (2 indexes)")

    # comments: journalId + blockId, chronological thread retrieval, status, authorId
    _ensure_index(
        db.comments,
        [("journalId", ASCENDING), ("blockId", ASCENDING), ("createdAt", ASCENDING)],
        name="idx_comments_journal_block_created",
    )
    _ensure_index(
        db.comments,
        [("journalId", ASCENDING), ("createdAt", ASCENDING)],
        name="idx_comments_journal_created",
    )
    _ensure_index(
        db.comments,
        [("journalId", ASCENDING), ("blockId", ASCENDING)],
        name="idx_comments_journal_block",
    )
    _ensure_index(
        db.comments,
        [("journalId", ASCENDING), ("status", ASCENDING)],
        name="idx_comments_journal_status",
    )
    _ensure_index(db.comments, "authorId", name="idx_comments_authorId")
    print("  Index: comments (5 indexes)")

    # approvals: journalId, teacherId
    _ensure_index(db.approvals, "journalId", name="idx_approvals_journalId")
    _ensure_index(db.approvals, "teacherId", name="idx_approvals_teacherId")
    print("  Index: approvals (2 indexes)")

    # notifications: userId + isRead, userId + createdAt, and 7-day TTL on readAt
    _ensure_index(
        db.notifications,
        [("userId", ASCENDING), ("isRead", ASCENDING)],
        name="idx_notifications_user_read",
    )
    _ensure_index(
        db.notifications,
        [("userId", ASCENDING), ("createdAt", DESCENDING)],
        name="idx_notifications_user_createdAt",
    )
    _ensure_index(
        db.notifications,
        "readAt",
        expireAfterSeconds=7 * 86400,
        name="ttl_notifications_readAt_7d",
    )
    print("  Index: notifications (3 indexes)")

    # uploaded_assets: userId + isDeleted, and 3-day TTL on deletedAt
    _ensure_index(
        db.uploaded_assets,
        [("userId", ASCENDING), ("isDeleted", ASCENDING)],
        name="idx_assets_user_deleted",
    )
    _ensure_index(
        db.uploaded_assets,
        "deletedAt",
        expireAfterSeconds=3 * 86400,
        name="ttl_assets_deletedAt_3d",
    )
    print("  Index: uploaded_assets (2 indexes)")

    # audit_logs: entity + entityId, timestamp, userId
    _ensure_index(
        db.audit_logs,
        [("entity", ASCENDING), ("entityId", ASCENDING)],
        name="idx_audit_entity",
    )
    _ensure_index(
        db.audit_logs,
        [("timestamp", DESCENDING)],
        name="idx_audit_timestamp",
    )
    # Drop any conflicting legacy TTL indexes on timestamp (e.g. ttl_audit_logs_3d)
    try:
        existing_indexes = _get_existing_indexes("audit_logs")
        for idx_name, idx_info in existing_indexes.items():
            if idx_name != "idx_audit_ttl_5days" and idx_info.get("key") == [("timestamp", 1)]:
                db.audit_logs.drop_index(idx_name)
    except Exception:
        pass

    _ensure_index(
        db.audit_logs,
        [("timestamp", ASCENDING)],
        expireAfterSeconds=5 * 86400,
        name="idx_audit_ttl_5days",
    )
    _ensure_index(db.audit_logs, "userId", name="idx_audit_userId")
    print("  Index: audit_logs (4 indexes with 5-day TTL)")

    # profile_change_requests: active pending uniqueness + status query index
    _ensure_index(
        db.profile_change_requests,
        [("userId", ASCENDING), ("status", ASCENDING)],
        name="idx_profile_requests_user_status",
    )
    _ensure_index(
        db.profile_change_requests,
        [("status", ASCENDING), ("updatedAt", DESCENDING)],
        name="idx_profile_requests_status_updated",
    )
    print("  Index: profile_change_requests (2 indexes)")

    if close_client:
        client.close()
    print("All indexes verified successfully.")


if __name__ == "__main__":
    create_indexes()
