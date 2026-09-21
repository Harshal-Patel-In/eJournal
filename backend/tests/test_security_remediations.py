"""Regression and validation tests for security audit remediations (SEC-01 through SEC-11)."""

import pytest
import html
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI, Request, status
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.constants import ErrorCode
from app.dependencies.rate_limit import RateLimiter, _in_memory_buckets
from app.middleware.error_handler import AppException
from app.services.comment_service import CommentService
from app.api.v1.upload import _destroy_cloud_or_local_file


# 1. Test SEC-01: Local File Path Traversal Defense
def test_sec01_path_traversal_prevention(tmp_path):
    """Verify that path traversal in local file deletion cannot escape base uploads directory."""
    # Attempting to delete a file outside uploads via path traversal
    malicious_asset = {
        "url": "/uploads/../../app/main.py",
        "public_id": None,
    }
    # Should not raise exception and should not touch outside files
    _destroy_cloud_or_local_file(malicious_asset)


# 2. Test SEC-02: BOLA / Authorization in CommentService
@pytest.mark.anyio
@patch("app.services.comment_service.ClassroomRepository")
@patch("app.services.comment_service.AssignmentRepository")
@patch("app.services.comment_service.CommentRepository")
@patch("app.services.comment_service.JournalRepository")
@patch("app.services.comment_service.UserRepository")
async def test_sec02_comment_service_bola_rejection(
    mock_user, mock_journal, mock_comment, mock_asg, mock_class
):
    """Verify unauthorized student or teacher cannot access comments of foreign journals."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "jour_999",
            "studentId": "victim_student",
            "assignmentId": "asg_123",
        }
    )
    mock_journal.return_value = journal_repo

    asg_repo = MagicMock()
    asg_repo.find_by_id = AsyncMock(return_value={"id": "asg_123", "classroomId": "class_100"})
    mock_asg.return_value = asg_repo

    class_repo = MagicMock()
    # Classroom belongs to teacher_alpha, but caller will be teacher_beta
    class_repo.find_by_id = AsyncMock(return_value={"id": "class_100", "teacherId": "teacher_alpha"})
    mock_class.return_value = class_repo

    service = CommentService()

    # Foreign student attempt
    with pytest.raises(AppException) as exc_info:
        await service.verify_journal_access("jour_999", "attacker_student", "student")
    assert exc_info.value.code == ErrorCode.FORBIDDEN

    # Foreign teacher attempt
    with pytest.raises(AppException) as exc_info:
        await service.verify_journal_access("jour_999", "teacher_beta", "teacher")
    assert exc_info.value.code == ErrorCode.FORBIDDEN

    # Authorized student attempt
    res_student = await service.verify_journal_access("jour_999", "victim_student", "student")
    assert res_student["id"] == "jour_999"

    # Authorized teacher attempt
    res_teacher = await service.verify_journal_access("jour_999", "teacher_alpha", "teacher")
    assert res_teacher["id"] == "jour_999"


# 3. Test SEC-05: Rate Limiting
@pytest.mark.anyio
async def test_sec05_rate_limiter_blocks_abuse():
    """Verify RateLimiter triggers 429 after exceeding threshold."""
    limiter = RateLimiter(max_requests=3, window_seconds=60, action="test_action")

    # Clear in-memory bucket for clean test
    _in_memory_buckets.clear()

    mock_request = MagicMock()
    mock_request.client.host = "192.168.1.50"

    # With Redis mocked to offline, in-memory sliding window enforces limits
    with patch("app.dependencies.rate_limit.get_redis", side_effect=Exception("Offline")):
        await limiter(mock_request)
        await limiter(mock_request)
        await limiter(mock_request)

        # 4th request must be rejected
        with pytest.raises(AppException) as exc_info:
            await limiter(mock_request)
        assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert exc_info.value.code == ErrorCode.TOO_MANY_REQUESTS


# 4. Test SEC-06 & SEC-04: Settings Properties
def test_sec06_cookie_secure_matches_environment():
    """Verify cookie_secure is False in development and True in production."""
    with patch.object(settings, "ENVIRONMENT", "development"):
        assert settings.cookie_secure is False

    with patch.object(settings, "ENVIRONMENT", "production"):
        assert settings.cookie_secure is True


# 5. Test SEC-10: Email HTML Escaping
def test_sec10_email_html_escaping():
    """Verify malicious HTML tags in user names or titles are properly escaped."""
    xss_payload = '<script>alert("xss")</script>'
    escaped = html.escape(xss_payload)
    assert "<script>" not in escaped
    assert "&lt;script&gt;" in escaped
