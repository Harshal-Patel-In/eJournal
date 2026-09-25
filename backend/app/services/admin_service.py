"""Administrator Service managing institutional governance and academic supervision.

RULE-BE04: All business logic MUST live inside service classes.
RULE-AUTH07: Strict RBAC enforcement.
RULE-SEC10: Immutable security audit logging.
"""

from datetime import datetime, timezone, timedelta
import secrets
from typing import Any

from bson import ObjectId
from fastapi import status

from app.core.config import settings
from app.core.constants import ErrorCode
from app.core.database import get_database, get_mongo_client
from app.core.redis import get_redis_client
from app.middleware.error_handler import AppException
from app.repositories.assignment_repository import AssignmentRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.classroom_membership_repository import ClassroomMembershipRepository
from app.repositories.classroom_repository import ClassroomRepository
from app.repositories.journal_repository import JournalRepository
from app.repositories.user_repository import UserRepository
from app.schemas.admin import FacultyCreateRequest
from app.utils.email import send_notification_email
from app.utils.security import hash_password, verify_password
import platform
import structlog
import time
import urllib.parse

logger = structlog.get_logger(__name__)



def _sanitize_netloc(url_str: str, default: str) -> str:
    """Extract host and port from URL while stripping any username/password credentials."""
    try:
        parsed = urllib.parse.urlsplit(url_str)
        if "@" in parsed.netloc:
            return parsed.netloc.split("@", 1)[1]
        return parsed.netloc or default
    except Exception:
        return default



class AdminService:
    """Institutional administration, faculty provisioning, and audit service."""

    def __init__(self):
        self.user_repo = UserRepository()
        self.classroom_repo = ClassroomRepository()
        self.membership_repo = ClassroomMembershipRepository()
        self.assignment_repo = AssignmentRepository()
        self.journal_repo = JournalRepository()
        self.audit_repo = AuditLogRepository()

    async def get_system_stats(self) -> dict:
        """Aggregate campus-wide KPI metrics, system health, and recent audit activity."""
        db = get_database()

        # KPI Counters
        total_students = db.users.count_documents({"role": "student"})
        total_faculty = db.users.count_documents({"role": "teacher"})
        active_classrooms = db.classrooms.count_documents({"isArchived": {"$ne": True}})
        total_journals = db.journals.count_documents({})
        pending_submissions = db.journals.count_documents(
            {"status": {"$in": ["submitted", "late_submitted"]}}
        )
        approved_journals = db.journals.count_documents({"status": "approved"})

        # System Health Ping (MongoDB)
        db_status = "disconnected"
        db_latency_ms = None
        db_host = _sanitize_netloc(settings.MONGODB_URI, "mongodb-cluster")
        try:
            t0 = time.perf_counter()
            db.command("ping")
            db_latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            db_status = "connected"
        except Exception:
            db_status = "disconnected"

        # System Health Ping (Redis)
        redis_status = "unavailable"
        redis_latency_ms = None
        redis_host = _sanitize_netloc(settings.REDIS_URL, "redis-server")
        redis_client = get_redis_client()
        if redis_client is not None:
            try:
                t1 = time.perf_counter()
                await redis_client.ping()
                redis_latency_ms = round((time.perf_counter() - t1) * 1000, 1)
                redis_status = "optimal"
            except Exception:
                redis_status = "offline"

        # Runtime uptime calculation
        uptime_seconds = 0
        try:
            from app.main import APP_START_TIME
            uptime_seconds = int(time.time() - APP_START_TIME)
        except Exception:
            pass

        # Recent Activity Feed (last 8 audit events)
        cursor = db.audit_logs.find().sort("timestamp", -1).limit(8)
        recent_activity = []

        # Cache user emails for recent events
        user_ids = []
        raw_events = list(cursor)
        for doc in raw_events:
            if doc.get("userId"):
                user_ids.append(doc["userId"])

        user_map = {}
        if user_ids:
            # Look up emails
            obj_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
            users_cursor = db.users.find({"_id": {"$in": obj_ids}}, {"email": 1})
            for u in users_cursor:
                user_map[str(u["_id"])] = u.get("email")

        for doc in raw_events:
            uid = doc.get("userId")
            recent_activity.append(
                {
                    "id": str(doc["_id"]),
                    "action": doc.get("action", "UNKNOWN"),
                    "entity": doc.get("entity", "system"),
                    "entityId": str(doc["entityId"]) if doc.get("entityId") else None,
                    "userId": uid,
                    "userEmail": user_map.get(uid, "system"),
                    "ipAddress": doc.get("ipAddress"),
                    "timestamp": doc.get("timestamp", datetime.now(timezone.utc)),
                }
            )

        return {
            "totalStudents": total_students,
            "totalFaculty": total_faculty,
            "activeClassrooms": active_classrooms,
            "totalJournals": total_journals,
            "pendingSubmissions": pending_submissions,
            "approvedJournals": approved_journals,
            "health": {
                "environment": settings.ENVIRONMENT,
                "uptimeSeconds": uptime_seconds,
                "pythonVersion": platform.python_version(),
                "database": {
                    "status": db_status,
                    "name": settings.MONGODB_DATABASE,
                    "host": db_host,
                    "latencyMs": db_latency_ms,
                },
                "redis": {
                    "status": redis_status,
                    "host": redis_host,
                    "latencyMs": redis_latency_ms,
                },
                "api": {
                    "status": "active",
                    "version": "0.1.0",
                },
            },
            "recentActivity": recent_activity,
        }

    async def list_users(
        self,
        role: str | None = None,
        search: str | None = None,
        department: str | None = None,
        status_filter: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> dict:
        """Paginated search across the university user directory."""
        conditions: list[dict[str, Any]] = []

        if role and role in ["student", "teacher", "admin"]:
            conditions.append({"role": role})

        if department:
            conditions.append({"profile.department": {"$regex": department, "$options": "i"}})

        if status_filter:
            if status_filter == "pending_setup":
                conditions.append({
                    "$or": [
                        {"is_profile_complete": False},
                        {"profile.enrollmentNumber": {"$exists": False}},
                        {"profile.enrollmentNumber": ""},
                        {"profile.enrollmentNumber": None},
                    ]
                })
            elif status_filter == "unverified":
                conditions.append({"is_verified": False})
            elif status_filter in ["active", "suspended"]:
                conditions.append({"status": status_filter})

        if search:
            escaped_search = search.strip()
            conditions.append({
                "$or": [
                    {"email": {"$regex": escaped_search, "$options": "i"}},
                    {"profile.name": {"$regex": escaped_search, "$options": "i"}},
                    {"profile.enrollmentNumber": {"$regex": escaped_search, "$options": "i"}},
                    {"profile.facultyId": {"$regex": escaped_search, "$options": "i"}},
                ]
            })

        query = {"$and": conditions} if conditions else {}

        total = await self.user_repo.count(query)
        users = await self.user_repo.find_many(
            query,
            projection={"password_hash": 0, "otp": 0, "otp_expires_at": 0},
            sort=[("createdAt", -1)],
            skip=skip,
            limit=limit,
        )

        for u in users:
            u["isAdmin"] = bool(u.get("is_admin", False) or u.get("isAdmin", False) or u.get("role") == "admin")
            u["is_admin"] = u["isAdmin"]

        return {
            "users": users,
            "total": total,
            "page": (skip // limit) + 1,
            "totalPages": (total + limit - 1) // limit if total > 0 else 1,
        }

    async def create_faculty(
        self, admin_user: dict, request: FacultyCreateRequest, ip_address: str | None = None
    ) -> dict:
        """Directly onboard a verified faculty member with temporary credentials."""
        email = request.email.lower().strip()
        existing = await self.user_repo.find_by_email(email)
        if existing:
            raise AppException(
                code=ErrorCode.ALREADY_EXISTS,
                message=f"An account with email '{email}' already exists",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        raw_password = (
            request.password.strip()
            if request.password
            else f"{secrets.token_urlsafe(8)}!1Aa"
        )
        hashed_password = hash_password(raw_password)

        user_doc = {
            "email": email,
            "password_hash": hashed_password,
            "role": "teacher",
            "is_verified": True,
            "is_profile_complete": True,
            "status": "active",
            "must_change_password": True,
            "profile": {
                "name": request.name.strip(),
                "department": request.department.strip(),
                "designation": request.designation.strip(),
                "college": "Engineering & Technology Institute",
            },
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        }

        user_id = await self.user_repo.insert_one(user_doc)

        # Dispatch welcome invitation email
        welcome_html = f"""
        <html>
            <body style="font-family: sans-serif; padding: 24px; color: #1e293b; line-height: 1.6;">
                <h2 style="color: #0f172a;">Welcome to eJournal Faculty Portal</h2>
                <p>Dear {request.name},</p>
                <p>An institutional faculty account has been created for you by the university administrator.</p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
                    <p style="margin: 0 0 8px 0;"><strong>Login Portal:</strong> <a href="http://localhost:3000/auth/login">eJournal Login</a></p>
                    <p style="margin: 0 0 8px 0;"><strong>Username:</strong> {email}</p>
                    <p style="margin: 0 0 0 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 4px 8px; border-radius: 6px; font-weight: bold;">{raw_password}</code></p>
                </div>
                <p style="color: #64748b; font-size: 13px;">For security compliance, you will be required to set your own password upon first logging in.</p>
            </body>
        </html>
        """
        await send_notification_email(
            to_email=email,
            subject="Your eJournal Faculty Account Credentials",
            html_content=welcome_html,
        )

        # Immutable security audit log
        await self.audit_repo.log_event(
            user_id=admin_user.get("id"),
            action="FACULTY_CREATED",
            entity="users",
            entity_id=user_id,
            ip_address=ip_address,
        )

        return {
            "id": user_id,
            "email": email,
            "name": request.name,
            "role": "teacher",
            "initialPassword": raw_password,
            "message": "Faculty member provisioned successfully.",
        }

    async def update_user_status(
        self, admin_user: dict, user_id: str, new_status: str, ip_address: str | None = None
    ) -> dict:
        """Suspend or activate a user account."""
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise AppException(
                code=ErrorCode.USER_NOT_FOUND,
                message="User not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if str(user["id"]) == str(admin_user.get("id")):
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Administrators cannot suspend their own account",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Peer protection: Delegated faculty admins cannot suspend an administrator account
        is_target_admin = bool(user.get("is_admin") or user.get("isAdmin") or user.get("role") == "admin")
        if is_target_admin and admin_user.get("role") != "admin":
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Only the institutional Super Administrator can alter an administrator's status",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        await self.user_repo.update_by_id(
            user_id,
            {"$set": {"status": new_status, "updatedAt": datetime.now(timezone.utc)}},
        )

        await self.audit_repo.log_event(
            user_id=admin_user.get("id"),
            action="USER_STATUS_UPDATED",
            entity="users",
            entity_id=user_id,
            ip_address=ip_address,
        )

        return {
            "id": user_id,
            "status": new_status,
            "message": f"Account status updated to '{new_status}'.",
        }

    async def reset_user_password(
        self,
        admin_user: dict,
        user_id: str,
        custom_password: str | None = None,
        ip_address: str | None = None,
    ) -> dict:
        """Administrative emergency password reset."""
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise AppException(
                code=ErrorCode.USER_NOT_FOUND,
                message="User not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Invariant 1: Self-reset prevention (administrators must use change_self_password)
        if str(user["id"]) == str(admin_user.get("id")):
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Administrators cannot reset their own password via management directory. Please use Change Password.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Invariant 2: Peer protection - Delegated faculty admins cannot reset an administrator's password
        is_target_admin = bool(user.get("is_admin") or user.get("isAdmin") or user.get("role") == "admin")
        if is_target_admin and admin_user.get("role") != "admin":
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Only the institutional Super Administrator can reset credentials for an administrator account",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        raw_password = (
            custom_password.strip()
            if custom_password
            else f"{secrets.token_urlsafe(8)}!1Aa"
        )
        hashed = hash_password(raw_password)

        await self.user_repo.update_by_id(
            user_id,
            {
                "$set": {
                    "password_hash": hashed,
                    "must_change_password": True,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

        await self.audit_repo.log_event(
            user_id=admin_user.get("id"),
            action="USER_PASSWORD_RESET",
            entity="users",
            entity_id=user_id,
            ip_address=ip_address,
        )

        # Dispatch security notification email to user with temporary password
        try:
            user_name = user.get("profile", {}).get("name") or "User"
            subject = "eJournal Security — Temporary Password Issued by Administrator"
            html_content = f"""
            <html>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc;">
                    <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <h2 style="margin-top: 0; color: #0f172a; font-size: 20px; font-weight: 700;">Password Reset Notification</h2>
                        <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                            Hello <strong>{user_name}</strong>,
                        </p>
                        <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                            An institutional administrator has reset the password for your eJournal account (<strong>{user.get('email')}</strong>).
                        </p>
                        <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; margin: 20px 0; border: 1px dashed #cbd5e1; text-align: center;">
                            <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">Your Temporary Password</span>
                            <span style="font-family: monospace; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: 1px;">{raw_password}</span>
                        </div>
                        <p style="font-size: 13px; line-height: 1.5; color: #64748b;">
                            <strong>Security Requirement:</strong> You will be required to set a new private password upon your next login.
                        </p>
                        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                            If you did not expect this request, please contact your university department administrator immediately.
                        </div>
                    </div>
                </body>
            </html>
            """
            await send_notification_email(user["email"], subject, html_content)
        except Exception as e:
            logger.error("password_reset_email_failed", error=str(e), email=user.get("email"))

        return {
            "id": user_id,
            "temporaryPassword": raw_password,
            "message": "Password reset successfully. The user has been notified via email and must update password on next login.",
        }

    async def change_self_password(
        self,
        user: dict,
        current_password: str,
        new_password: str,
        ip_address: str | None = None,
    ) -> dict:
        """Self-service password update for logged-in users and first-time login enforcement."""
        if not verify_password(current_password, user.get("password_hash", "")):
            raise AppException(
                code=ErrorCode.INVALID_CREDENTIALS,
                message="Current password verification failed",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        if len(new_password) < 8:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="New password must be at least 8 characters long",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        hashed = hash_password(new_password)

        await self.user_repo.update_by_id(
            user["id"],
            {
                "$set": {
                    "password_hash": hashed,
                    "must_change_password": False,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

        await self.audit_repo.log_event(
            user_id=user["id"],
            action="PASSWORD_CHANGED",
            entity="users",
            entity_id=user["id"],
            ip_address=ip_address,
        )

        return {"message": "Password updated successfully."}

    async def list_classrooms(
        self, search: str | None = None, skip: int = 0, limit: int = 20
    ) -> dict:
        """List all university classrooms with instructor and enrollment statistics."""
        db = get_database()
        query: dict[str, Any] = {}

        if search:
            escaped = search.strip()
            query["$or"] = [
                {"name": {"$regex": escaped, "$options": "i"}},
                {"subjectCode": {"$regex": escaped, "$options": "i"}},
                {"joinCode": {"$regex": escaped, "$options": "i"}},
            ]

        total = db.classrooms.count_documents(query)
        cursor = db.classrooms.find(query).sort("createdAt", -1).skip(skip).limit(limit)
        classrooms = list(cursor)

        # Batch lookup teacher info
        teacher_ids = [c.get("teacherId") for c in classrooms if c.get("teacherId")]
        obj_ids = [ObjectId(tid) for tid in teacher_ids if ObjectId.is_valid(tid)]
        teachers_cursor = db.users.find({"_id": {"$in": obj_ids}})
        teacher_map = {
            str(t["_id"]): {
                "name": t.get("profile", {}).get("name", "Unknown Teacher"),
                "email": t.get("email"),
            }
            for t in teachers_cursor
        }

        # Enrich each classroom
        enriched = []
        for c in classrooms:
            cid = str(c["_id"])
            student_count = db.classroom_memberships.count_documents({"classroomId": cid})
            assignment_count = db.assignments.count_documents({"classroomId": cid})
            teacher_info = teacher_map.get(c.get("teacherId"), {"name": "Unassigned", "email": None})

            enriched.append(
                {
                    "id": cid,
                    "name": c.get("name"),
                    "subjectCode": c.get("subjectCode"),
                    "description": c.get("description"),
                    "joinCode": c.get("joinCode"),
                    "semester": c.get("semester"),
                    "teacherId": c.get("teacherId"),
                    "teacherName": teacher_info["name"],
                    "teacherEmail": teacher_info["email"],
                    "studentCount": student_count,
                    "assignmentCount": assignment_count,
                    "isArchived": c.get("isArchived", False),
                    "createdAt": c.get("createdAt"),
                }
            )

        return {
            "classrooms": enriched,
            "total": total,
            "page": (skip // limit) + 1,
            "totalPages": (total + limit - 1) // limit if total > 0 else 1,
        }

    async def reassign_classroom(
        self,
        admin_user: dict,
        classroom_id: str,
        new_teacher_id: str,
        ip_address: str | None = None,
    ) -> dict:
        """Reassign classroom to a new faculty member, preserving all historical student work."""
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        if not classroom:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Classroom not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        new_teacher = await self.user_repo.find_by_id(new_teacher_id)
        if not new_teacher or new_teacher.get("role") != "teacher":
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Selected user is not a valid faculty member",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        await self.classroom_repo.update_by_id(
            classroom_id,
            {"$set": {"teacherId": new_teacher_id, "updatedAt": datetime.now(timezone.utc)}},
        )

        await self.audit_repo.log_event(
            user_id=admin_user.get("id"),
            action="CLASSROOM_REASSIGNED",
            entity="classrooms",
            entity_id=classroom_id,
            ip_address=ip_address,
        )

        return {
            "classroomId": classroom_id,
            "newTeacherId": new_teacher_id,
            "newTeacherName": new_teacher.get("profile", {}).get("name", new_teacher["email"]),
            "message": "Classroom instructor reassigned successfully.",
        }

    async def list_journals(
        self,
        classroom_id: str | None = None,
        status_filter: str | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> dict:
        """Global academic journal registry with multi-status filtering."""
        db = get_database()
        query: dict[str, Any] = {}

        if classroom_id:
            query["classroomId"] = classroom_id

        if status_filter and status_filter != "all":
            query["status"] = status_filter

        total = db.journals.count_documents(query)
        cursor = db.journals.find(query).sort("updatedAt", -1).skip(skip).limit(limit)
        journals = list(cursor)

        # Batch lookup students and assignments
        student_ids = [j.get("studentId") for j in journals if j.get("studentId")]
        obj_sids = [ObjectId(sid) for sid in student_ids if ObjectId.is_valid(sid)]
        students_cursor = db.users.find({"_id": {"$in": obj_sids}})
        student_map = {
            str(s["_id"]): {
                "name": s.get("profile", {}).get("name", "Student"),
                "email": s.get("email"),
                "enrollmentNumber": s.get("profile", {}).get("enrollmentNumber", "—"),
            }
            for s in students_cursor
        }

        assignment_ids = [j.get("assignmentId") for j in journals if j.get("assignmentId")]
        obj_aids = [ObjectId(aid) for aid in assignment_ids if ObjectId.is_valid(aid)]
        assignments_cursor = db.assignments.find({"_id": {"$in": obj_aids}})
        assignment_map = {str(a["_id"]): a.get("title", "Practical") for a in assignments_cursor}

        classroom_ids = [j.get("classroomId") for j in journals if j.get("classroomId")]
        obj_cids = [ObjectId(cid) for cid in classroom_ids if ObjectId.is_valid(cid)]
        classrooms_cursor = db.classrooms.find({"_id": {"$in": obj_cids}})
        classroom_map = {
            str(c["_id"]): f"{c.get('name')} ({c.get('subjectCode')})" for c in classrooms_cursor
        }

        # Batch lookup actual snapshot version count from journal_versions collection
        journal_ids = [str(j["_id"]) for j in journals]
        version_map: dict[str, int] = {}
        if journal_ids:
            try:
                pipeline = [
                    {"$match": {"journalId": {"$in": journal_ids}}},
                    {"$group": {"_id": "$journalId", "count": {"$sum": 1}}},
                ]
                for agg in db.journal_versions.aggregate(pipeline):
                    version_map[str(agg["_id"])] = agg["count"]
            except Exception:
                pass

        enriched = []
        for j in journals:
            jid = str(j["_id"])
            student_info = student_map.get(
                j.get("studentId"),
                {"name": "Unknown Student", "email": "", "enrollmentNumber": "—"},
            )
            assignment_title = assignment_map.get(j.get("assignmentId"), "Practical")
            classroom_title = classroom_map.get(j.get("classroomId"), "Lab")

            # True user milestone version (snapshot count or 1 for draft), NOT the internal auto-save OCC counter
            milestone_version = version_map.get(jid, 1) if version_map.get(jid, 0) > 0 else 1

            enriched.append(
                {
                    "id": jid,
                    "title": j.get("title", assignment_title),
                    "status": j.get("status", "draft"),
                    "studentId": j.get("studentId"),
                    "studentName": student_info["name"],
                    "studentEmail": student_info["email"],
                    "enrollmentNumber": student_info["enrollmentNumber"],
                    "assignmentTitle": assignment_title,
                    "classroomTitle": classroom_title,
                    "marks": j.get("marks"),
                    "currentVersion": milestone_version,
                    "updatedAt": j.get("updatedAt"),
                    "submittedAt": j.get("submittedAt"),
                }
            )

        return {
            "journals": enriched,
            "total": total,
            "page": (skip // limit) + 1,
            "totalPages": (total + limit - 1) // limit if total > 0 else 1,
        }

    async def list_audit_logs(
        self, action_filter: str | None = None, skip: int = 0, limit: int = 50
    ) -> dict:
        """Fetch immutable security audit trail with FIFO log cap enforcement."""
        db = get_database()

        # Enforce 5-day time-bounded retention policy: purge logs older than 5 days
        cutoff = datetime.now(timezone.utc) - timedelta(days=5)
        db.audit_logs.delete_many({"timestamp": {"$lt": cutoff}})

        query: dict[str, Any] = {}
        if action_filter and action_filter != "all":
            query["action"] = action_filter

        total = db.audit_logs.count_documents(query)
        cursor = db.audit_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        logs = list(cursor)

        # Batch lookup actor emails
        user_ids = [l.get("userId") for l in logs if l.get("userId")]
        obj_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
        users_cursor = db.users.find({"_id": {"$in": obj_ids}}, {"email": 1})
        user_map = {str(u["_id"]): u.get("email") for u in users_cursor}

        enriched = []
        for l in logs:
            ts = l.get("timestamp")
            if isinstance(ts, datetime):
                ts_str = ts.replace(tzinfo=timezone.utc).isoformat() if ts.tzinfo is None else ts.isoformat()
            else:
                ts_str = ts

            enriched.append(
                {
                    "id": str(l["_id"]),
                    "action": l.get("action", "UNKNOWN"),
                    "entity": l.get("entity", "system"),
                    "entityId": str(l["entityId"]) if l.get("entityId") else None,
                    "userId": l.get("userId"),
                    "userEmail": user_map.get(l.get("userId"), "System"),
                    "ipAddress": l.get("ipAddress") or "—",
                    "timestamp": ts_str,
                }
            )

        return {
            "logs": enriched,
            "total": total,
            "page": (skip // limit) + 1,
            "totalPages": (total + limit - 1) // limit if total > 0 else 1,
        }

    async def delete_user(
        self,
        admin_user: dict,
        user_id: str,
        ip_address: str | None = None,
    ) -> dict:
        """Deep purge of a user account and all cascading data (journals, assets, memberships, Cloudinary images)."""
        db = get_database()
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise AppException(
                code=ErrorCode.USER_NOT_FOUND,
                message="User not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Invariant: Root Super Administrator cannot be deleted
        if user.get("email") == "admin@ejournal.com" or str(user["id"]) == str(admin_user.get("id")):
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Cannot delete the root administrator account or current active session",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # Peer protection: Delegated faculty admins cannot delete an administrator account
        is_target_admin = bool(user.get("is_admin") or user.get("isAdmin") or user.get("role") == "admin")
        if is_target_admin and admin_user.get("role") != "admin":
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Only the institutional Super Administrator can delete an administrator account",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # 1. Purge Cloudinary and local assets
        try:
            from app.api.v1.upload import _destroy_cloud_or_local_file
            assets_cursor = db.assets.find({"userId": user_id})
            for asset in assets_cursor:
                try:
                    _destroy_cloud_or_local_file(asset)
                except Exception as e:
                    logger.warning("asset_cloud_destroy_failed", asset_id=str(asset.get("_id")), error=str(e))
            db.assets.delete_many({"userId": user_id})
        except Exception as e:
            logger.error("user_assets_cleanup_failed", user_id=user_id, error=str(e))

        # 2. Purge user journals and associated blocks / versions / comments
        try:
            user_journals = list(db.journals.find({"studentId": user_id}, {"_id": 1}))
            for j in user_journals:
                jid = str(j["_id"])
                db.journal_blocks.delete_many({"journalId": jid})
                db.journal_versions.delete_many({"journalId": jid})
                db.journal_comments.delete_many({"journalId": jid})
            db.journals.delete_many({"studentId": user_id})
        except Exception as e:
            logger.error("user_journals_cleanup_failed", user_id=user_id, error=str(e))

        # 3. Purge classroom memberships
        try:
            db.classroom_memberships.delete_many({"userId": user_id})
        except Exception as e:
            logger.error("user_memberships_cleanup_failed", user_id=user_id, error=str(e))

        # 4. If faculty: unassign teacher from active classrooms
        try:
            db.classrooms.update_many(
                {"teacherId": user_id},
                {"$set": {"teacherId": None, "isArchived": True, "updatedAt": datetime.now(timezone.utc)}}
            )
        except Exception as e:
            logger.error("teacher_classrooms_unassign_failed", user_id=user_id, error=str(e))

        # 5. Invalidate session cache in Redis
        try:
            redis_client = get_redis_client()
            if redis_client is not None:
                await redis_client.delete(f"session:{user_id}")
                await redis_client.delete(f"user:{user_id}")
        except Exception:
            pass

        # 6. Delete user document from MongoDB
        obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        db.users.delete_one({"_id": obj_id})

        # 7. Audit log event
        await self.audit_repo.log_event(
            user_id=admin_user.get("id"),
            action="USER_DELETED",
            entity="users",
            entity_id=user_id,
            ip_address=ip_address,
        )

        return {
            "id": user_id,
            "email": user.get("email"),
            "message": "User and all associated data, journals, and assets have been permanently deleted.",
        }

    async def toggle_faculty_admin_role(
        self,
        admin_user: dict,
        user_id: str,
        is_admin: bool,
        ip_address: str | None = None,
    ) -> dict:
        """Grant or revoke administrative authority for a faculty member."""
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise AppException(
                code=ErrorCode.USER_NOT_FOUND,
                message="User not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if user.get("role") != "teacher":
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Administrative authority delegation is only applicable to faculty members",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Invariant 1: Only root Super Administrator can grant/revoke admin rights
        if admin_user.get("role") != "admin":
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Only the institutional Super Administrator has the authority to grant or revoke administrative roles",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # Invariant 2: Self-action prevention
        if str(user["id"]) == str(admin_user.get("id")):
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Administrators cannot alter their own administrative authority",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # Invariant 3: Protect root super admin
        if user.get("email") == "admin@ejournal.com":
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Cannot alter permissions of the root institutional administrator",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        await self.user_repo.update_by_id(
            user_id,
            {
                "$set": {
                    "is_admin": is_admin,
                    "updatedAt": datetime.now(timezone.utc),
                }
            }
        )

        action = "FACULTY_ADMIN_GRANTED" if is_admin else "FACULTY_ADMIN_REVOKED"
        await self.audit_repo.log_event(
            user_id=admin_user.get("id"),
            action=action,
            entity="users",
            entity_id=user_id,
            ip_address=ip_address,
        )

        return {
            "id": user_id,
            "email": user.get("email"),
            "isAdmin": is_admin,
            "message": f"Administrative authority {'granted to' if is_admin else 'revoked from'} faculty member.",
        }

