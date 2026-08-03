"""API v1 router aggregating all sub-routers.

RULE-API02: All APIs versioned under /api/v1/.
"""

from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.profile import router as profile_router
from app.api.v1.classroom import router as classroom_router
from app.api.v1.assignment import router as assignment_router
from app.api.v1.journal import router as journal_router
from app.api.v1.upload import router as upload_router
from app.api.v1.notification import router as notification_router
from app.api.v1.comment import router as comment_router

api_v1_router = APIRouter()

# Health check
api_v1_router.include_router(health_router, tags=["Health"])

# Authentication & Registration
api_v1_router.include_router(auth_router, tags=["Authentication"])

# Profiles
api_v1_router.include_router(profile_router, tags=["Profiles"])

# Classrooms & Memberships
api_v1_router.include_router(classroom_router, tags=["Classrooms"])

# Practical Assignments
api_v1_router.include_router(assignment_router, tags=["Assignments"])

# Visual Editor & Journals
api_v1_router.include_router(journal_router, tags=["Journals"])

# Comments & Annotations
api_v1_router.include_router(comment_router, tags=["Comments"])

# Local File Uploads
api_v1_router.include_router(upload_router, tags=["Uploads"])

# Notifications
api_v1_router.include_router(notification_router, tags=["Notifications"])




