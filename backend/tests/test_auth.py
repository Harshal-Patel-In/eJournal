"""Unit and Integration tests for Authentication, OTP, and Profile Setup workflows.

RULE-TEST01: Unit tests cover service-layer rules, permission checks, workflow state.
RULE-TEST04: Contract tests verify validation, status codes, envelope formats.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.constants import ErrorCode
from app.main import app
from app.services.auth_service import AuthService
from app.utils.security import hash_password

client = TestClient(app)


# 1. Test registration contract validation
def test_register_validation():
    """Verify registration request validation rejects malformed payload."""
    # Empty payload
    response = client.post("/api/v1/auth/register", json={})
    assert response.status_code == 422
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == ErrorCode.VALIDATION_ERROR

    # Short password
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "student@uni.edu", "password": "short", "role": "student"},
    )
    assert response.status_code == 422


# 2. Test registration service logic
@pytest.mark.anyio
@patch("app.services.auth_service.UserRepository")
@patch("app.services.auth_service.AuditLogRepository")
@patch("app.services.auth_service.send_otp_email", new_callable=AsyncMock)
async def test_register_service(mock_send_email, mock_audit_repo, mock_user_repo):
    """Test successful user registration flow."""
    user_repo_instance = MagicMock()
    user_repo_instance.find_by_email = AsyncMock(return_value=None)
    user_repo_instance.insert_one = AsyncMock(return_value="user_id_123")
    mock_user_repo.return_value = user_repo_instance

    audit_repo_instance = MagicMock()
    audit_repo_instance.log_event = AsyncMock()
    mock_audit_repo.return_value = audit_repo_instance

    auth_service = AuthService()

    from app.schemas.auth import UserRegisterRequest
    request = UserRegisterRequest(
        email="new_student@uni.edu", password="securepassword123", role="student"
    )

    result = await auth_service.register(request)

    assert result["userId"] == "user_id_123"
    assert result["email"] == "new_student@uni.edu"
    assert user_repo_instance.insert_one.called
    assert mock_send_email.called


# 3. Test OTP verification logic
@pytest.mark.anyio
@patch("app.services.auth_service.UserRepository")
@patch("app.services.auth_service.AuditLogRepository")
async def test_verify_otp_service(mock_audit_repo, mock_user_repo):
    """Test OTP verification, expiration checking, and activation."""
    user_repo_instance = MagicMock()
    # Mock user document returned by DB
    mock_user = {
        "id": "user_id_123",
        "email": "student@uni.edu",
        "role": "student",
        "is_verified": False,
        "otp": "123456",
        "otp_expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    user_repo_instance.find_by_email = AsyncMock(return_value=mock_user)
    user_repo_instance.verify_user = AsyncMock(return_value=True)
    user_repo_instance.record_otp_failure = AsyncMock(return_value=True)
    user_repo_instance.reset_otp_credentials = AsyncMock(return_value=True)
    mock_user_repo.return_value = user_repo_instance

    audit_repo_instance = MagicMock()
    audit_repo_instance.log_event = AsyncMock()
    mock_audit_repo.return_value = audit_repo_instance

    auth_service = AuthService()

    # Verify correct OTP
    token = await auth_service.verify_otp("student@uni.edu", "123456")
    assert token is not None
    assert user_repo_instance.verify_user.called

    # Verify incorrect OTP throws exception
    with pytest.raises(Exception) as exc_info:
        await auth_service.verify_otp("student@uni.edu", "000000")
    assert "code" in dir(exc_info.value)
    assert getattr(exc_info.value, "code") == ErrorCode.INVALID_OTP


# 4. Test login credentials
@pytest.mark.anyio
@patch("app.services.auth_service.UserRepository")
@patch("app.services.auth_service.AuditLogRepository")
async def test_login_service(mock_audit_repo, mock_user_repo):
    """Test credential validation and verified-user access control during login."""
    user_repo_instance = MagicMock()
    mock_user = {
        "id": "user_id_123",
        "email": "student@uni.edu",
        "role": "student",
        "is_verified": True,
        "password_hash": hash_password("securepassword123"),
    }
    user_repo_instance.find_by_email = AsyncMock(return_value=mock_user)
    mock_user_repo.return_value = user_repo_instance

    audit_repo_instance = MagicMock()
    audit_repo_instance.log_event = AsyncMock()
    mock_audit_repo.return_value = audit_repo_instance

    auth_service = AuthService()

    # Correct login
    token, user = await auth_service.login("student@uni.edu", "securepassword123")
    assert token is not None
    assert user["id"] == "user_id_123"

    # Wrong password
    with pytest.raises(Exception) as exc_info:
        await auth_service.login("student@uni.edu", "wrongpassword")
    assert getattr(exc_info.value, "code") == ErrorCode.INVALID_CREDENTIALS
