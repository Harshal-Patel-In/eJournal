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
import os
import platform
import re
import hashlib
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
            escaped_dept = re.escape(department.strip())
            conditions.append({"profile.department": {"$regex": escaped_dept, "$options": "i"}})

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
            escaped_search = re.escape(search.strip())
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

        new_token_version = user.get("token_version", 1) + 1
        await self.user_repo.update_by_id(
            user_id,
            {"$set": {"status": new_status, "token_version": new_token_version, "updatedAt": datetime.now(timezone.utc)}},
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

        new_token_version = user.get("token_version", 1) + 1
        await self.user_repo.update_by_id(
            user_id,
            {
                "$set": {
                    "password_hash": hashed,
                    "token_version": new_token_version,
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
        new_token_version = user.get("token_version", 1) + 1

        await self.user_repo.update_by_id(
            user["id"],
            {
                "$set": {
                    "password_hash": hashed,
                    "token_version": new_token_version,
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
            escaped = re.escape(search.strip())
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
            is_frozen = bool(c.get("is_frozen") or c.get("isFrozen", False))

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
                    "is_frozen": is_frozen,
                    "isFrozen": is_frozen,
                    "frozenAt": c.get("frozenAt"),
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
        configured_admin_email = os.getenv("ADMIN_EMAIL", "admin@ejournal.com").lower().strip()
        user_email = user.get("email", "").lower().strip()
        if user_email == configured_admin_email or user.get("role") == "admin" or str(user["id"]) == str(admin_user.get("id")):
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Cannot delete an institutional administrator account or current active session",
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



    async def bulk_import_students(
        self,
        admin_user: dict,
        students: list[Any],
        target_classroom_id: str | None = None,
        send_email_invite: bool = True,
        ip_address: str | None = None,
    ) -> dict:
        """High-performance bulk student onboarding with Two-Tier pending_setup state machine."""
        if not students:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Student roster list cannot be empty.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        seen_enrollments = set()
        cleaned_rows = []
        candidate_emails = []
        candidate_enrollments = []
        skipped_errors = []

        for idx, row in enumerate(students):
            raw_enr = getattr(row, "enrollmentNumber", None) if hasattr(row, "enrollmentNumber") else (row.get("enrollmentNumber") if isinstance(row, dict) else None)
            raw_name = getattr(row, "name", None) if hasattr(row, "name") else (row.get("name") if isinstance(row, dict) else None)
            raw_sem = getattr(row, "semester", None) if hasattr(row, "semester") else (row.get("semester", 1) if isinstance(row, dict) else 1)
            raw_dept = getattr(row, "department", None) if hasattr(row, "department") else (row.get("department") if isinstance(row, dict) else None)
            raw_div = getattr(row, "division", None) if hasattr(row, "division") else (row.get("division") if isinstance(row, dict) else None)
            raw_batch = getattr(row, "batch", None) if hasattr(row, "batch") else (row.get("batch") if isinstance(row, dict) else None)
            raw_college = getattr(row, "college", None) if hasattr(row, "college") else (row.get("college") if isinstance(row, dict) else None)
            raw_uni = getattr(row, "university", None) if hasattr(row, "university") else (row.get("university") if isinstance(row, dict) else "Charotar University of Science and Technology (CHARUSAT)")

            enr_clean = str(raw_enr or "").upper().strip()
            name_clean = str(raw_name or "").strip()

            if not enr_clean or not name_clean:
                skipped_errors.append({
                    "row": idx + 1,
                    "reason": "Missing mandatory student name or enrollment number",
                })
                continue

            if enr_clean in seen_enrollments:
                skipped_errors.append({
                    "row": idx + 1,
                    "enrollmentNumber": enr_clean,
                    "reason": f"Duplicate enrollment number '{enr_clean}' within uploaded batch",
                })
                continue

            seen_enrollments.add(enr_clean)
            email_clean = f"{enr_clean.lower()}@charusat.edu.in"
            candidate_emails.append(email_clean)
            candidate_enrollments.append(enr_clean)

            cleaned_rows.append({
                "name": name_clean,
                "enrollmentNumber": enr_clean,
                "email": email_clean,
                "semester": int(raw_sem or 1),
                "department": raw_dept.strip() if raw_dept and str(raw_dept).strip() else None,
                "division": str(raw_div).strip() if raw_div and str(raw_div).strip() else None,
                "batch": str(raw_batch).strip() if raw_batch and str(raw_batch).strip() else None,
                "college": str(raw_college).strip() if raw_college and str(raw_college).strip() else None,
                "university": str(raw_uni).strip() if raw_uni else "Charotar University of Science and Technology (CHARUSAT)",
            })

        existing_emails, existing_enrollments = await self.user_repo.find_existing_by_emails_or_enrollments(
            candidate_emails, candidate_enrollments
        )

        user_docs = []
        credentials_manifest = []
        active_count = 0
        pending_setup_count = 0
        email_dispatch_payload = []
        now = datetime.now(timezone.utc)

        for row in cleaned_rows:
            enr = row["enrollmentNumber"]
            em = row["email"]

            if em in existing_emails or enr in existing_enrollments:
                skipped_errors.append({
                    "enrollmentNumber": enr,
                    "email": em,
                    "reason": "Account with this enrollment number or institutional email already exists in system",
                })
                continue

            is_complete = bool(
                row["department"] and row["division"] and row["batch"] and row["college"]
            )
            # All bulk-imported students start as pending_setup until their first login and password change
            account_status = "pending_setup"
            pending_setup_count += 1

            temp_password = secrets.token_urlsafe(8)
            password_hash = hash_password(temp_password)

            user_id = ObjectId()
            doc = {
                "_id": user_id,
                "email": em,
                "password_hash": password_hash,
                "role": "student",
                "is_verified": True,
                "is_profile_complete": False,  # Becomes True when student completes first login setup
                "status": "pending_setup",
                "must_change_password": True,
                "profile": {
                    "name": row["name"],
                    "enrollmentNumber": enr,
                    "semester": str(row["semester"]),
                    "department": row["department"],
                    "division": row["division"],
                    "batch": row["batch"],
                    "college": row["college"],
                    "university": row["university"],
                },
                "createdAt": now,
                "updatedAt": now,
            }
            user_docs.append(doc)

            credentials_manifest.append({
                "name": row["name"],
                "enrollmentNumber": enr,
                "email": em,
                "temporaryPassword": temp_password,
                "status": "pending_setup",
                "isProfileComplete": False,
            })

            if send_email_invite:
                email_dispatch_payload.append({
                    "name": row["name"],
                    "email": em,
                    "enrollment": enr,
                    "temp_password": temp_password,
                    "status": account_status,
                })

        total_created = 0
        if user_docs:
            total_created = await self.user_repo.bulk_insert_users(user_docs)

            if target_classroom_id:
                try:
                    cls_obj_id = ObjectId(target_classroom_id)
                    membership_docs = [
                        {
                            "userId": doc["_id"],
                            "classroomId": cls_obj_id,
                            "role": "student",
                            "joinedAt": now,
                        }
                        for doc in user_docs
                    ]
                    db = get_database()
                    db.classroom_memberships.insert_many(membership_docs, ordered=False)
                except Exception as e:
                    logger.warning("bulk_classroom_enrollment_partial_error", error=str(e))

            if email_dispatch_payload:
                import asyncio

                async def _dispatch_worker(items: list[dict]):
                    for item in items:
                        try:
                            html_msg = f"""
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <h2 style="color: #2563eb; margin-top: 0;">Welcome to eJournal Platform</h2>
                                <p>Dear <strong>{item['name']}</strong>,</p>
                                <p>Your institutional student account for eJournal has been created.</p>
                                <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                                    <p style="margin: 5px 0;"><strong>Enrollment Number:</strong> {item['enrollment']}</p>
                                    <p style="margin: 5px 0;"><strong>Official Email:</strong> {item['email']}</p>
                                    <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">{item['temp_password']}</code></p>
                                </div>
                                <p>Please sign in at the eJournal portal and change your password immediately.</p>
                                {'<p style="color: #d97706;"><em>Note: Please complete your missing batch/college details upon initial login.</em></p>' if item['status'] == 'pending_setup' else ''}
                            </div>
                            """
                            await send_notification_email(
                                to_email=item["email"],
                                subject="eJournal Student Portal Access Credentials",
                                html_content=html_msg,
                            )
                        except Exception:
                            pass
                        await asyncio.sleep(1.0 / 15.0)

                asyncio.create_task(_dispatch_worker(email_dispatch_payload))

        await self.audit_repo.log_event(
            user_id=admin_user.get("id"),
            action="STUDENTS_BULK_IMPORTED",
            entity="users",
            entity_id=None,
            ip_address=ip_address,
        )

        return {
            "totalProcessed": len(students),
            "totalCreated": total_created,
            "totalSkipped": len(skipped_errors),
            "activeCount": active_count,
            "pendingSetupCount": pending_setup_count,
            "credentials": credentials_manifest,
            "skippedErrors": skipped_errors,
        }


    async def freeze_classroom(
        self,
        admin_user: dict,
        classroom_id: str,
        is_frozen: bool,
        ip_address: str | None = None,
    ) -> dict:
        """Seal or unseal an academic term for a classroom, locking all student journal writes."""
        db = get_database()
        cls_obj = await self.classroom_repo.find_by_id(classroom_id)
        if not cls_obj:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Classroom not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        now = datetime.now(timezone.utc)
        await self.classroom_repo.update_by_id(
            classroom_id,
            {"$set": {"is_frozen": is_frozen, "frozenAt": now if is_frozen else None}},
        )

        action = "ACADEMIC_TERM_SEALED" if is_frozen else "ACADEMIC_TERM_UNSEALED"
        await self.audit_repo.log_event(
            user_id=admin_user.get("id"),
            action=action,
            entity="classrooms",
            entity_id=classroom_id,
            ip_address=ip_address,
        )

        return {
            "id": classroom_id,
            "name": cls_obj.get("name"),
            "isFrozen": is_frozen,
            "is_frozen": is_frozen,
            "message": f"Academic term officially {'sealed' if is_frozen else 'unsealed'} for this classroom.",
        }

    async def purge_classroom_deep(
        self,
        admin_user: dict,
        classroom_id: str,
        password: str,
        confirm_title: str,
        ip_address: str | None = None,
    ) -> dict:
        """Deep Storage Purge: batch-deletes Cloudinary images and cascades MongoDB collections."""
        # 1. Admin Password verification
        db = get_database()
        admin_doc = db.users.find_one({"_id": ObjectId(admin_user.get("id"))})
        if not admin_doc or not verify_password(password, admin_doc.get("password_hash", "")):
            raise AppException(
                code=ErrorCode.INVALID_CREDENTIALS,
                message="Administrative password verification failed",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        # 2. Classroom Title Confirmation
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        if not classroom:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Classroom not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if classroom.get("name", "").strip().lower() != confirm_title.strip().lower():
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Classroom title confirmation does not match exact record",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Collect all assignments and journals in this classroom
        asg_cursor = db.assignments.find({"classroomId": ObjectId(classroom_id)}, {"_id": 1})
        asg_ids = [doc["_id"] for doc in asg_cursor]

        journal_cursor = db.journals.find(
            {"$or": [{"assignmentId": {"$in": asg_ids}}, {"assignmentId": {"$in": [str(a) for a in asg_ids]}}]},
            {"_id": 1, "blocks": 1},
        )
        journals = list(journal_cursor)
        journal_ids = [j["_id"] for j in journals]
        journal_str_ids = [str(j) for j in journal_ids]

        # 4. Scan image blocks for Cloudinary assets
        cloudinary_public_ids = []
        for j in journals:
            for block in j.get("blocks", []):
                if block.get("type") == "image":
                    c_data = block.get("content") or {}
                    pid = c_data.get("publicId") or c_data.get("public_id")
                    if pid:
                        cloudinary_public_ids.append(pid)

        # 5. Batch-delete Cloudinary assets via Admin API
        if cloudinary_public_ids:
            try:
                import cloudinary.api
                for i in range(0, len(cloudinary_public_ids), 100):
                    chunk = cloudinary_public_ids[i:i + 100]
                    cloudinary.api.delete_resources(chunk, resource_type="image")
            except Exception as e:
                logger.warning("cloudinary_asset_deletion_failed", error=str(e))

        # 6. Cascading MongoDB Deletes
        db.journals.delete_many({"_id": {"$in": journal_ids}})
        db.block_versions.delete_many({"journalId": {"$in": journal_str_ids}})
        db.comments.delete_many({"journalId": {"$in": journal_str_ids}})
        db.classroom_memberships.delete_many({"classroomId": ObjectId(classroom_id)})
        db.assignments.delete_many({"_id": {"$in": asg_ids}})
        db.classrooms.delete_one({"_id": ObjectId(classroom_id)})

        reclaimed_bytes = len(cloudinary_public_ids) * 800 * 1024 + len(journal_ids) * 50 * 1024

        await self.audit_repo.log_event(
            user_id=admin_user.get("id"),
            action="CLASSROOM_DEEP_PURGED",
            entity="classrooms",
            entity_id=classroom_id,
            ip_address=ip_address,
        )

        return {
            "success": True,
            "classroomId": classroom_id,
            "reclaimedBytes": reclaimed_bytes,
            "imagesPurged": len(cloudinary_public_ids),
            "journalsPurged": len(journal_ids),
            "assignmentsPurged": len(asg_ids),
            "message": f"Classroom deep purge complete. Reclaimed ~{round(reclaimed_bytes / (1024 * 1024), 1)} MB storage.",
        }

    async def get_defaulters_radar(
        self,
        classroom_id: str | None = None,
        threshold: float = 75.0,
    ) -> dict:
        """High-performance indexed aggregation pipeline calculating defaulter student indices (< 75%)."""
        db = get_database()

        classroom_filter = {}
        if classroom_id:
            classroom_filter["_id"] = ObjectId(classroom_id)

        target_classrooms = list(db.classrooms.find(classroom_filter, {"_id": 1, "name": 1, "subjectCode": 1}))
        if not target_classrooms:
            return {
                "classroomId": classroom_id,
                "classroomName": None,
                "threshold": threshold,
                "totalStudents": 0,
                "defaultersCount": 0,
                "defaulters": [],
            }

        # Map of unique student_id (str) -> {"total": int, "approved": int}
        student_workload: dict[str, dict[str, int]] = {}

        for cls in target_classrooms:
            cls_id = cls["_id"]
            cls_keys = [cls_id, str(cls_id)]
            # Total published assignments for this classroom
            asg_cursor = db.assignments.find({"classroomId": {"$in": cls_keys}}, {"_id": 1})
            asg_ids = [doc["_id"] for doc in asg_cursor]
            total_practicals = len(asg_ids)
            if total_practicals == 0:
                continue

            asg_keys = asg_ids + [str(a) for a in asg_ids]

            # Enrolled students (support both studentId and userId, string and ObjectId)
            memberships = list(db.classroom_memberships.find({"classroomId": {"$in": cls_keys}}))
            raw_sids = [m.get("studentId") or m.get("userId") for m in memberships if (m.get("studentId") or m.get("userId"))]
            cls_student_ids = list({str(s) for s in raw_sids})
            if not cls_student_ids:
                continue

            # Query approved journals in one batch for this classroom's assignments
            approved_cursor = db.journals.aggregate([
                {
                    "$match": {
                        "assignmentId": {"$in": asg_keys},
                        "status": "approved",
                    }
                },
                {
                    "$group": {
                        "_id": "$studentId",
                        "approvedCount": {"$sum": 1},
                    }
                }
            ])
            approved_map = {str(doc["_id"]): doc["approvedCount"] for doc in approved_cursor}

            for sid in cls_student_ids:
                if sid not in student_workload:
                    student_workload[sid] = {"total": 0, "approved": 0}
                student_workload[sid]["total"] += total_practicals
                student_workload[sid]["approved"] += approved_map.get(sid, 0)

        if not student_workload:
            primary_name = target_classrooms[0]["name"] if len(target_classrooms) == 1 else "All Department Labs"
            return {
                "classroomId": classroom_id,
                "classroomName": primary_name,
                "threshold": threshold,
                "totalStudents": 0,
                "defaultersCount": 0,
                "defaulters": [],
            }

        # Query student profiles for all unique evaluated students in one batch
        student_object_ids = []
        for sid in student_workload.keys():
            student_object_ids.append(sid)
            if ObjectId.is_valid(sid):
                student_object_ids.append(ObjectId(sid))

        student_users = list(db.users.find({"_id": {"$in": student_object_ids}}, {"_id": 1, "email": 1, "profile": 1}))
        user_map = {str(u["_id"]): u for u in student_users}

        all_defaulters = []
        for sid, metrics in student_workload.items():
            total = metrics["total"]
            approved = metrics["approved"]
            rate = round((approved / total) * 100, 1) if total > 0 else 0.0

            if rate < threshold:
                s_user = user_map.get(sid, {})
                s_profile = s_user.get("profile") or {}
                all_defaulters.append({
                    "studentId": sid,
                    "name": s_profile.get("name", "Student"),
                    "enrollmentNumber": s_profile.get("enrollmentNumber", "—"),
                    "email": s_user.get("email", ""),
                    "batch": s_profile.get("batch"),
                    "department": s_profile.get("department"),
                    "division": s_profile.get("division"),
                    "approvedPracticals": approved,
                    "totalPracticals": total,
                    "completionRate": rate,
                })

        # Sort defaulters by lowest completion rate first
        all_defaulters.sort(key=lambda d: d["completionRate"])

        primary_name = target_classrooms[0]["name"] if len(target_classrooms) == 1 else "All Department Labs"

        return {
            "classroomId": classroom_id,
            "classroomName": primary_name,
            "threshold": threshold,
            "totalStudents": len(student_workload),
            "defaultersCount": len(all_defaulters),
            "defaulters": all_defaulters,
        }

    # =========================================================================
    # Phase 3: Integrity Screener & Accreditation Portfolio Subsystems
    # =========================================================================

    @staticmethod
    def _normalize_text(text: str) -> str:
        """Normalize text by lowercasing and stripping punctuation and excess whitespace."""
        if not text:
            return ""
        text = re.sub(r"[^\w\s]", " ", text.lower())
        return " ".join(text.split())

    @staticmethod
    def _normalize_code(code: str) -> str:
        """Strip single and multi-line comments and collapse whitespace in code."""
        if not code:
            return ""
        code = re.sub(r"/\*[\s\S]*?\*/", "", code)
        code = re.sub(r'"""[\s\S]*?"""', "", code)
        code = re.sub(r"'''[\s\S]*?'''", "", code)
        code = re.sub(r"//.*$", "", code, flags=re.MULTILINE)
        code = re.sub(r"#.*$", "", code, flags=re.MULTILINE)
        return " ".join(code.lower().split())

    @staticmethod
    def _normalize_table(content: dict) -> str:
        """Extract and normalize all cell values from table block content."""
        if not content:
            return ""
        rows = content.get("rows") or []
        cells = []
        for r in rows:
            if isinstance(r, list):
                for cell in r:
                    cells.append(str(cell).strip().lower())
            elif isinstance(r, dict):
                for v in r.values():
                    cells.append(str(v).strip().lower())
        return " ".join(cells)

    @staticmethod
    def _normalize_math(content: dict) -> str:
        """Normalize mathematical LaTeX expressions."""
        if not content:
            return ""
        eq = content.get("latex") or content.get("formula") or content.get("text") or ""
        # Strip layout and spacing commands while preserving math operators
        eq = re.sub(r"\\(left|right|text|mathrm|mathbf|displaystyle|quad|qquad|,|;|!)\b", "", eq)
        eq = re.sub(r"[\s\\]", "", eq.lower())
        return eq

    @classmethod
    def _winnowing_fingerprints(cls, text: str, k: int = 15, w: int = 15) -> set[int]:
        """
        Winnowing local fingerprinting algorithm (Schleimer et al.).
        Generates deterministic hash fingerprints resistant to whitespace variation.
        """
        if len(text) < k:
            if not text:
                return set()
            return {int(hashlib.md5(text.encode("utf-8")).hexdigest()[:12], 16)}

        hashes = []
        for i in range(len(text) - k + 1):
            kgram = text[i : i + k]
            h = int(hashlib.md5(kgram.encode("utf-8")).hexdigest()[:12], 16)
            hashes.append(h)

        if len(hashes) <= w:
            return {min(hashes)} if hashes else set()

        fingerprints = set()
        min_idx = -1

        for i in range(len(hashes) - w + 1):
            window = hashes[i : i + w]
            w_min_val = min(window)
            w_min_idx = i + [j for j, v in enumerate(window) if v == w_min_val][-1]

            if w_min_idx != min_idx:
                fingerprints.add(w_min_val)
                min_idx = w_min_idx

        return fingerprints

    async def scan_similarity(
        self,
        admin_user: dict,
        assignment_id: str | None = None,
        classroom_id: str | None = None,
        threshold: float = 0.50,
        ip_address: str | None = None,
    ) -> dict:
        """Cross-journal multi-block similarity screener across code, math, tables, and paragraphs."""
        db = get_database()

        # 1. Resolve Target Assignments
        asg_filter: dict[str, Any] = {}
        asg_title = None
        cls_name = None

        if assignment_id:
            asg_lookup_keys = [assignment_id]
            if ObjectId.is_valid(assignment_id):
                asg_lookup_keys.append(ObjectId(assignment_id))
            asg_doc = db.assignments.find_one({"_id": {"$in": asg_lookup_keys}})
            if not asg_doc:
                raise AppException(code=ErrorCode.NOT_FOUND, message="Target assignment not found", status_code=status.HTTP_404_NOT_FOUND)
            asg_filter["_id"] = asg_doc["_id"]
            asg_title = asg_doc.get("title")
            classroom_id = str(asg_doc.get("classroomId"))
        elif classroom_id:
            cls_lookup_keys = [classroom_id]
            if ObjectId.is_valid(classroom_id):
                cls_lookup_keys.append(ObjectId(classroom_id))
            asg_filter["classroomId"] = {"$in": cls_lookup_keys}

        if classroom_id:
            cls_lookup_keys = [classroom_id]
            if ObjectId.is_valid(classroom_id):
                cls_lookup_keys.append(ObjectId(classroom_id))
            cls_doc = db.classrooms.find_one({"_id": {"$in": cls_lookup_keys}})
            if cls_doc:
                cls_name = cls_doc.get("name")

        target_assignments = list(db.assignments.find(asg_filter, {"_id": 1, "title": 1, "description": 1, "classroomId": 1}))
        if not target_assignments:
            report_id = str(ObjectId())
            empty_report = {
                "id": report_id,
                "assignmentId": assignment_id,
                "assignmentTitle": asg_title or "No Published Lab Practicals Found",
                "classroomId": classroom_id,
                "classroomName": cls_name or "Course",
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "totalSubmissions": 0,
                "flaggedPairsCount": 0,
                "threshold": threshold,
                "matches": [],
            }
            db.integrity_reports.insert_one({"_id": ObjectId(report_id), **empty_report})
            return empty_report

        asg_obj_ids = [a["_id"] for a in target_assignments]
        asg_keys = asg_obj_ids + [str(a) for a in asg_obj_ids]

        # 2. Fetch Submitted/Approved Student Journals
        journals_cursor = db.journals.find(
            {
                "assignmentId": {"$in": asg_keys},
                "status": {"$in": ["submitted", "late_submitted", "approved"]},
            },
            {"_id": 1, "studentId": 1, "assignmentId": 1, "title": 1, "blocks": 1, "studentName": 1, "enrollmentNumber": 1}
        )
        journals = list(journals_cursor)

        if len(journals) < 2:
            report_id = str(ObjectId())
            empty_report = {
                "id": report_id,
                "assignmentId": assignment_id,
                "assignmentTitle": asg_title or (target_assignments[0]["title"] if len(target_assignments) == 1 else "Batch Lab Practicals"),
                "classroomId": classroom_id,
                "classroomName": cls_name,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "totalSubmissions": len(journals),
                "flaggedPairsCount": 0,
                "threshold": threshold,
                "matches": [],
            }
            db.integrity_reports.insert_one({"_id": ObjectId(report_id), **empty_report})
            return empty_report

        # 3. Fetch User Profiles to enrich student data
        student_ids = [j.get("studentId") for j in journals if j.get("studentId")]
        users_cursor = db.users.find(
            {"_id": {"$in": [ObjectId(s) for s in student_ids if ObjectId.is_valid(s)]}},
            {"_id": 1, "email": 1, "profile": 1}
        )
        user_map = {str(u["_id"]): u for u in users_cursor}

        # 4. Extract Block-Level and Category-Level Fingerprints per Student Journal
        processed_journals = []
        for j in journals:
            s_id = str(j.get("studentId"))
            u_doc = user_map.get(s_id, {})
            u_prof = u_doc.get("profile") or {}
            student_meta = {
                "id": s_id,
                "name": u_prof.get("name") or j.get("studentName") or "Student",
                "enrollment": u_prof.get("enrollmentNumber") or j.get("enrollmentNumber") or "—",
                "email": u_doc.get("email", ""),
            }

            blocks = j.get("blocks") or []
            cat_texts: dict[str, list[str]] = {"code": [], "table": [], "paragraph": [], "math": []}
            block_fingerprints = []

            for b in blocks:
                b_type = b.get("type")
                b_id = b.get("id") or str(ObjectId())
                b_content = b.get("content") or {}

                norm_str = ""
                snippet = ""

                if b_type == "code":
                    raw_code = b_content.get("code") or ""
                    snippet = raw_code[:120]
                    norm_str = self._normalize_code(raw_code)
                    cat_texts["code"].append(norm_str)
                elif b_type == "table":
                    snippet = f"Table ({len(b_content.get('rows') or [])} rows)"
                    norm_str = self._normalize_table(b_content)
                    cat_texts["table"].append(norm_str)
                elif b_type in ["paragraph", "heading"]:
                    raw_p = b_content.get("text") or ""
                    snippet = raw_p[:120]
                    norm_str = self._normalize_text(raw_p)
                    cat_texts["paragraph"].append(norm_str)
                elif b_type == "math":
                    raw_m = b_content.get("latex") or b_content.get("formula") or ""
                    snippet = raw_m[:120]
                    norm_str = self._normalize_math(b_content)
                    cat_texts["math"].append(norm_str)

                if norm_str:
                    fps = self._winnowing_fingerprints(norm_str)
                    if fps:
                        block_fingerprints.append({
                            "blockType": "paragraph" if b_type == "heading" else b_type,
                            "blockId": b_id,
                            "fps": fps,
                            "snippet": snippet,
                        })

            cat_fps = {
                cat: self._winnowing_fingerprints(" ".join(texts))
                for cat, texts in cat_texts.items()
                if texts
            }

            processed_journals.append({
                "journalId": str(j["_id"]),
                "student": student_meta,
                "catFps": cat_fps,
                "blockFps": block_fingerprints,
            })

        # 5. Pairwise Combinations (3,160 pairs for 80 students)
        matches = []
        n_docs = len(processed_journals)

        for i in range(n_docs):
            for j in range(i + 1, n_docs):
                j_a = processed_journals[i]
                j_b = processed_journals[j]

                # Prevent self-comparison
                if j_a["student"]["id"] == j_b["student"]["id"]:
                    continue

                cat_sims: dict[str, float] = {}
                weights = {"code": 0.35, "table": 0.25, "paragraph": 0.25, "math": 0.15}
                weighted_sum = 0.0
                total_weight = 0.0

                for cat in ["code", "table", "paragraph", "math"]:
                    fps_a = j_a["catFps"].get(cat, set())
                    fps_b = j_b["catFps"].get(cat, set())

                    if fps_a or fps_b:
                        intersection = len(fps_a & fps_b)
                        union = len(fps_a | fps_b)
                        sim = round(intersection / union, 2) if union > 0 else 0.0
                        cat_sims[cat] = sim
                        w = weights[cat]
                        weighted_sum += sim * w
                        total_weight += w
                    else:
                        cat_sims[cat] = 0.0

                overall_sim = round(weighted_sum / total_weight, 2) if total_weight > 0 else 0.0

                # Flag pair if overall similarity >= threshold OR any core technical block >= 0.70
                if overall_sim >= threshold or cat_sims.get("code", 0) >= 0.70 or cat_sims.get("table", 0) >= 0.70:
                    matched_block_pairs = []

                    # Find specific matching blocks
                    for blk_a in j_a["blockFps"]:
                        for blk_b in j_b["blockFps"]:
                            if blk_a["blockType"] == blk_b["blockType"]:
                                b_inter = len(blk_a["fps"] & blk_b["fps"])
                                b_union = len(blk_a["fps"] | blk_b["fps"])
                                b_sim = round(b_inter / b_union, 2) if b_union > 0 else 0.0
                                if b_sim >= 0.55:
                                    matched_block_pairs.append({
                                        "blockType": blk_a["blockType"],
                                        "blockIdA": blk_a["blockId"],
                                        "blockIdB": blk_b["blockId"],
                                        "similarity": b_sim,
                                        "snippetA": blk_a["snippet"],
                                        "snippetB": blk_b["snippet"],
                                    })

                    matches.append({
                        "studentA": j_a["student"],
                        "studentB": j_b["student"],
                        "journalIdA": j_a["journalId"],
                        "journalIdB": j_b["journalId"],
                        "overallSimilarity": overall_sim,
                        "categoryMatches": cat_sims,
                        "matchedBlockPairs": matched_block_pairs,
                    })

        matches.sort(key=lambda m: m["overallSimilarity"], reverse=True)

        report_id = str(ObjectId())
        report_data = {
            "id": report_id,
            "assignmentId": assignment_id,
            "assignmentTitle": asg_title or (target_assignments[0]["title"] if len(target_assignments) == 1 else "Batch Lab Practicals"),
            "classroomId": classroom_id,
            "classroomName": cls_name or "Department Course",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "totalSubmissions": len(journals),
            "flaggedPairsCount": len(matches),
            "threshold": threshold,
            "matches": matches,
        }

        db.integrity_reports.insert_one({"_id": ObjectId(report_id), **report_data})

        await self.audit_repo.log_event(
            user_id=admin_user.get("id"),
            action="SIMILARITY_SCAN_EXECUTED",
            entity="integrity_reports",
            entity_id=report_id,
            ip_address=ip_address,
        )

        return report_data

    async def list_similarity_reports(
        self,
        classroom_id: str | None = None,
        assignment_id: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> dict:
        """List historical academic integrity reports."""
        db = get_database()
        query: dict[str, Any] = {}
        if classroom_id:
            query["classroomId"] = classroom_id
        if assignment_id:
            query["assignmentId"] = assignment_id

        total = db.integrity_reports.count_documents(query)
        cursor = db.integrity_reports.find(query).sort("generatedAt", -1).skip(skip).limit(limit)
        reports = []
        for r in cursor:
            r["id"] = str(r.get("_id", r.get("id")))
            r.pop("_id", None)
            reports.append(r)

        return {"total": total, "reports": reports}

    async def get_similarity_report_by_id(self, report_id: str) -> dict:
        """Fetch a specific integrity report by ID."""
        db = get_database()
        report = db.integrity_reports.find_one({"_id": ObjectId(report_id)})
        if not report:
            report = db.integrity_reports.find_one({"id": report_id})
        if not report:
            raise AppException(code=ErrorCode.NOT_FOUND, message="Integrity report not found", status_code=status.HTTP_404_NOT_FOUND)

        report["id"] = str(report.get("_id", report.get("id")))
        report.pop("_id", None)
        return report

    async def get_accreditation_portfolio_data(
        self,
        classroom_id: str,
    ) -> dict:
        """
        Aggregate comprehensive institutional portfolio dataset for NBA / NAAC accreditation.
        Partitions class into Top 10%, Mid 10%, and Low 10% sampling tiers.
        """
        db = get_database()
        cls_keys = [classroom_id]
        if ObjectId.is_valid(classroom_id):
            cls_keys.append(ObjectId(classroom_id))
        cls_doc = db.classrooms.find_one({"_id": {"$in": cls_keys}})
        if not cls_doc:
            raise AppException(code=ErrorCode.NOT_FOUND, message="Classroom not found", status_code=status.HTTP_404_NOT_FOUND)

        # Faculty Info
        teacher_id = cls_doc.get("teacherId")
        teacher_keys = [teacher_id]
        if teacher_id and ObjectId.is_valid(teacher_id):
            teacher_keys.append(ObjectId(teacher_id))
        teacher_doc = db.users.find_one({"_id": {"$in": teacher_keys}}) if teacher_id else None
        teacher_name = teacher_doc.get("profile", {}).get("name") or teacher_doc.get("email") or "Faculty Instructor"

        # Assignments
        asg_cursor = db.assignments.find({"classroomId": {"$in": cls_keys}}).sort("createdAt", 1)
        assignments = list(asg_cursor)
        asg_map = {str(a["_id"]): a for a in assignments}
        asg_keys = [a["_id"] for a in assignments] + [str(a["_id"]) for a in assignments]

        # Enrolled Students (support both studentId and userId, string and ObjectId)
        memberships = list(db.classroom_memberships.find({"classroomId": {"$in": cls_keys}}))
        raw_sids = [m.get("studentId") or m.get("userId") for m in memberships if (m.get("studentId") or m.get("userId"))]
        student_keys = []
        for s in raw_sids:
            student_keys.append(s)
            if isinstance(s, str) and ObjectId.is_valid(s):
                student_keys.append(ObjectId(s))
            elif isinstance(s, ObjectId):
                student_keys.append(str(s))

        students_cursor = db.users.find(
            {"_id": {"$in": student_keys}},
            {"_id": 1, "email": 1, "profile": 1}
        )
        student_docs = list(students_cursor)
        student_map = {str(s["_id"]): s for s in student_docs}

        # Fetch Journals
        journals_cursor = db.journals.find(
            {"assignmentId": {"$in": asg_keys}},
            {"_id": 1, "studentId": 1, "assignmentId": 1, "title": 1, "marks": 1, "teacherRemarks": 1, "status": 1, "blocks": 1}
        )
        all_journals = list(journals_cursor)

        # Group by student
        student_journals_map: dict[str, list[dict]] = {}
        for j in all_journals:
            sid = str(j.get("studentId"))
            if sid not in student_journals_map:
                student_journals_map[sid] = []
            student_journals_map[sid].append(j)

        # Build Evaluation Matrix Rows
        max_possible_marks = sum(a.get("maxMarks", 10) for a in assignments) or 10
        evaluation_rows = []

        for sid, s_user in student_map.items():
            s_prof = s_user.get("profile") or {}
            s_journals = student_journals_map.get(sid, [])

            marks_per_asg = {}
            total_obtained = 0

            for asg in assignments:
                asg_id_str = str(asg["_id"])
                j_match = next((j for j in s_journals if str(j.get("assignmentId")) == asg_id_str), None)
                if j_match and j_match.get("marks") is not None:
                    m = j_match.get("marks", 0)
                    marks_per_asg[asg.get("title", asg_id_str)] = m
                    total_obtained += m
                else:
                    marks_per_asg[asg.get("title", asg_id_str)] = 0

            percentage = round((total_obtained / max_possible_marks) * 100, 1) if max_possible_marks > 0 else 0.0

            evaluation_rows.append({
                "studentId": sid,
                "enrollmentNumber": s_prof.get("enrollmentNumber", "—"),
                "name": s_prof.get("name", "Student"),
                "department": s_prof.get("department", "Engineering"),
                "division": s_prof.get("division", "1"),
                "batch": s_prof.get("batch", "A1"),
                "marksPerAssignment": marks_per_asg,
                "totalMarks": total_obtained,
                "maxPossibleMarks": max_possible_marks,
                "percentage": percentage,
                "journalsCount": len(s_journals),
            })

        # Sort students descending by percentage
        evaluation_rows.sort(key=lambda r: r["percentage"], reverse=True)

        # Partition into NBA/NAAC Sampling Tiers (Top 10%, Mid 10%, Low 10%)
        n_total = len(evaluation_rows)
        sample_count = max(1, round(n_total * 0.10)) if n_total > 0 else 0

        top_tier_students = evaluation_rows[:sample_count] if sample_count > 0 else []
        low_tier_students = evaluation_rows[-sample_count:] if sample_count > 0 else []

        mid_start = max(0, (n_total // 2) - (sample_count // 2))
        mid_tier_students = evaluation_rows[mid_start : mid_start + sample_count] if sample_count > 0 else []

        def _serialize_journals(student_tier_rows):
            serialized = []
            for s_row in student_tier_rows:
                sid = s_row["studentId"]
                s_journals = student_journals_map.get(sid, [])
                for j in s_journals:
                    asg = asg_map.get(str(j.get("assignmentId")), {})
                    serialized.append({
                        "journalId": str(j["_id"]),
                        "studentName": s_row["name"],
                        "enrollmentNumber": s_row["enrollmentNumber"],
                        "assignmentTitle": asg.get("title", j.get("title", "Lab Practical")),
                        "marks": j.get("marks"),
                        "maxMarks": asg.get("maxMarks", 10),
                        "teacherRemarks": j.get("teacherRemarks"),
                        "blocks": j.get("blocks", []),
                    })
            return serialized

        return {
            "classroomId": classroom_id,
            "classroomName": cls_doc.get("name", "Practical Course"),
            "subjectCode": cls_doc.get("subjectCode", "LAB"),
            "teacherName": teacher_name,
            "academicTerm": cls_doc.get("academicTerm", "Active Semester"),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "totalStudents": n_total,
            "totalAssignments": len(assignments),
            "sampleCount": sample_count,
            "topTierCount": len(top_tier_students),
            "midTierCount": len(mid_tier_students),
            "lowTierCount": len(low_tier_students),
            "evaluationMatrix": evaluation_rows,
            "topTierJournals": _serialize_journals(top_tier_students),
            "midTierJournals": _serialize_journals(mid_tier_students),
            "lowTierJournals": _serialize_journals(low_tier_students),
        }
