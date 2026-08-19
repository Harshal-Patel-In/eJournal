"""Unit tests for Teacher Gradebook Matrix, CSV Export, and Student Analytics."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.responses import StreamingResponse

from app.services.gradebook_service import GradebookService


@pytest.mark.anyio
@patch("app.services.gradebook_service.ClassroomRepository")
@patch("app.services.gradebook_service.AssignmentRepository")
@patch("app.services.gradebook_service.ClassroomMembershipRepository")
@patch("app.services.gradebook_service.JournalRepository")
@patch("app.services.gradebook_service.UserRepository")
async def test_get_classroom_gradebook_matrix(
    mock_user_repo_cls,
    mock_journal_repo_cls,
    mock_membership_repo_cls,
    mock_asg_repo_cls,
    mock_class_repo_cls,
):
    """Verify 2D gradebook matrix calculation across multiple students and assignments."""
    mock_class_repo = MagicMock()
    mock_class_repo.find_by_id = AsyncMock(
        return_value={
            "id": "c1",
            "name": "Physics Lab",
            "subject": "PHY101",
            "teacherId": "t1",
            "semester": "1",
            "division": "A",
            "department": "Engineering",
        }
    )
    mock_class_repo_cls.return_value = mock_class_repo

    mock_asg_repo = MagicMock()
    mock_asg_repo.find_by_classroom_id = AsyncMock(
        return_value=[
            {"id": "a1", "title": "Ohm's Law", "experimentNumber": 1, "maxMarks": 20},
            {"id": "a2", "title": "Optics", "experimentNumber": 2, "maxMarks": 20},
        ]
    )
    mock_asg_repo_cls.return_value = mock_asg_repo

    mock_membership_repo = MagicMock()
    mock_membership_repo.find_members_by_classroom_id = AsyncMock(
        return_value=[
            {"studentId": "s1", "batch": "B1", "enrollmentNumber": "21EC001"},
            {"studentId": "s2", "batch": "B2", "enrollmentNumber": "21EC002"},
        ]
    )
    mock_membership_repo_cls.return_value = mock_membership_repo

    mock_journal_repo = MagicMock()
    mock_journal_repo.find_many = AsyncMock(
        return_value=[
            {"id": "j1", "studentId": "s1", "assignmentId": "a1", "status": "approved", "marks": 18.0},
            {"id": "j2", "studentId": "s1", "assignmentId": "a2", "status": "submitted", "marks": None},
            {"id": "j3", "studentId": "s2", "assignmentId": "a1", "status": "approved", "marks": 20.0},
        ]
    )
    mock_journal_repo_cls.return_value = mock_journal_repo

    mock_user_repo = MagicMock()
    async def find_user(uid):
        if uid == "s1":
            return {"id": "s1", "name": "Alice Smith", "profile": {"name": "Alice Smith", "enrollmentNumber": "21EC001", "batch": "B1"}}
        return {"id": "s2", "name": "Bob Jones", "profile": {"name": "Bob Jones", "enrollmentNumber": "21EC002", "batch": "B2"}}

    mock_user_repo.find_by_id = AsyncMock(side_effect=find_user)
    mock_user_repo_cls.return_value = mock_user_repo

    service = GradebookService()
    result = await service.get_classroom_gradebook("c1", "t1")

    assert result["classroom"]["name"] == "Physics Lab"
    assert len(result["assignments"]) == 2
    assert len(result["students"]) == 2

    # Alice has 18/20 evaluated total (90.0% Distinction)
    alice = next(s for s in result["students"] if s["studentId"] == "s1")
    assert alice["grades"]["a1"]["status"] == "approved"
    assert alice["grades"]["a1"]["marks"] == 18.0
    assert alice["grades"]["a2"]["status"] == "submitted"
    assert alice["totalMarksObtained"] == 18.0
    assert alice["evaluatedMaxMarks"] == 20.0
    assert alice["totalMaxMarks"] == 40.0
    assert alice["percentage"] == 90.0
    assert alice["standing"] == "Distinction"
    assert alice["completedCount"] == 1

    # Bob has 20/20 evaluated total (100.0% Distinction)
    bob = next(s for s in result["students"] if s["studentId"] == "s2")
    assert bob["grades"]["a1"]["status"] == "approved"
    assert bob["grades"]["a1"]["marks"] == 20.0
    assert bob["grades"]["a2"]["status"] == "not_started"
    assert bob["evaluatedMaxMarks"] == 20.0
    assert bob["percentage"] == 100.0
    assert bob["standing"] == "Distinction"
    assert bob["completedCount"] == 1


@pytest.mark.anyio
@patch("app.services.gradebook_service.ClassroomRepository")
@patch("app.services.gradebook_service.AssignmentRepository")
@patch("app.services.gradebook_service.ClassroomMembershipRepository")
@patch("app.services.gradebook_service.JournalRepository")
@patch("app.services.gradebook_service.UserRepository")
async def test_export_gradebook_csv(
    mock_user_repo_cls,
    mock_journal_repo_cls,
    mock_membership_repo_cls,
    mock_asg_repo_cls,
    mock_class_repo_cls,
):
    """Verify CSV streaming generation for classroom gradebook."""
    mock_class_repo = MagicMock()
    mock_class_repo.find_by_id = AsyncMock(
        return_value={
            "id": "c1",
            "name": "Chemistry Lab",
            "subject": "CHM101",
            "teacherId": "t1",
            "semester": "2",
            "division": "B",
            "department": "Science",
        }
    )
    mock_class_repo_cls.return_value = mock_class_repo

    mock_asg_repo = MagicMock()
    mock_asg_repo.find_by_classroom_id = AsyncMock(
        return_value=[
            {"id": "a1", "title": "Titration", "experimentNumber": 1, "maxMarks": 10},
        ]
    )
    mock_asg_repo_cls.return_value = mock_asg_repo

    mock_membership_repo = MagicMock()
    mock_membership_repo.find_members_by_classroom_id = AsyncMock(
        return_value=[{"studentId": "s1", "batch": "B1", "enrollmentNumber": "21CH001"}]
    )
    mock_membership_repo_cls.return_value = mock_membership_repo

    mock_journal_repo = MagicMock()
    mock_journal_repo.find_many = AsyncMock(
        return_value=[
            {"id": "j1", "studentId": "s1", "assignmentId": "a1", "status": "approved", "marks": 9.0}
        ]
    )
    mock_journal_repo_cls.return_value = mock_journal_repo

    mock_user_repo = MagicMock()
    mock_user_repo.find_by_id = AsyncMock(
        return_value={"id": "s1", "name": "Charlie Brown", "profile": {"name": "Charlie Brown", "enrollmentNumber": "21CH001", "batch": "B1"}}
    )
    mock_user_repo_cls.return_value = mock_user_repo

    service = GradebookService()
    response = await service.export_gradebook_csv("c1", "t1")

    assert isinstance(response, StreamingResponse)
    assert response.media_type == "text/csv"
    assert "attachment; filename=" in response.headers["Content-Disposition"]
