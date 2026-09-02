"""Unit tests for assignment clustering and cluster control services."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId

from app.schemas.assignment import AssignmentCreateRequest, RubricCriterion
from app.services.assignment_service import AssignmentService


@pytest.mark.anyio
@patch("app.services.assignment_service.AssignmentRepository")
@patch("app.services.assignment_service.ClassroomRepository")
@patch("app.services.assignment_service.ClassroomMembershipRepository")
@patch("app.services.assignment_service.AuditLogRepository")
async def test_publish_assignment_with_cluster_and_rubric(
    mock_audit, mock_membership, mock_classroom, mock_assignment
):
    audit_repo = MagicMock()
    audit_repo.log_event = AsyncMock()
    mock_audit.return_value = audit_repo

    classroom_repo = MagicMock()
    classroom_repo.find_by_id = AsyncMock(
        return_value={"id": "class_1", "teacherId": "teacher_1", "name": "Physics Lab"}
    )
    mock_classroom.return_value = classroom_repo

    membership_repo = MagicMock()
    membership_repo.find_members_by_classroom_id = AsyncMock(return_value=[])
    mock_membership.return_value = membership_repo

    assignment_repo = MagicMock()
    assignment_repo.is_assignment_exists = AsyncMock(return_value=False)
    assignment_repo.insert_one = AsyncMock(return_value="asg_1")
    assignment_repo.find_by_id = AsyncMock(
        return_value={
            "id": "asg_1",
            "clusterName": "Cluster 1: DC Circuits",
            "rubric": [
                {"id": "c1", "title": "Setup & Circuit", "maxMarks": 3.0},
                {"id": "c2", "title": "Table Data & Slope", "maxMarks": 4.0},
                {"id": "c3", "title": "Conclusion & Viva", "maxMarks": 3.0},
            ],
        }
    )
    mock_assignment.return_value = assignment_repo

    service = AssignmentService()

    payload = AssignmentCreateRequest(
        experimentNumber=1,
        title="Ohm's Law",
        aim="Verify V = IR",
        instructions="Connect voltmeter and ammeter",
        maxMarks=10,
        deadline=datetime.now(timezone.utc) + timedelta(days=7),
        clusterName="Cluster 1: DC Circuits",
        rubric=[
            RubricCriterion(id="c1", title="Setup & Circuit", maxMarks=3.0),
            RubricCriterion(id="c2", title="Table Data & Slope", maxMarks=4.0),
            RubricCriterion(id="c3", title="Conclusion & Viva", maxMarks=3.0),
        ],
    )

    result = await service.publish_assignment("teacher_1", "class_1", payload)

    assert result["id"] == "asg_1"
    assert result["clusterName"] == "Cluster 1: DC Circuits"
    assert len(result["rubric"]) == 3
    assert assignment_repo.insert_one.called
    doc = assignment_repo.insert_one.call_args[0][0]
    assert doc["clusterName"] == "Cluster 1: DC Circuits"
    assert len(doc["rubric"]) == 3
    assert doc["rubric"][0]["title"] == "Setup & Circuit"


@pytest.mark.anyio
@patch("app.services.assignment_service.AssignmentRepository")
@patch("app.services.assignment_service.ClassroomRepository")
async def test_update_assignment_cluster(mock_classroom, mock_assignment):
    classroom_repo = MagicMock()
    classroom_repo.find_by_id = AsyncMock(
        return_value={"id": "class_1", "teacherId": "teacher_1"}
    )
    mock_classroom.return_value = classroom_repo

    assignment_repo = MagicMock()
    assignment_repo.find_by_id = AsyncMock(
        return_value={"id": "asg_1", "classroomId": "class_1", "clusterName": None}
    )
    assignment_repo.update_by_id = AsyncMock(return_value=True)
    mock_assignment.return_value = assignment_repo

    service = AssignmentService()

    # 1. Assign to cluster
    updated = await service.update_assignment_cluster(
        "teacher_1", "class_1", "asg_1", "Cluster 1: DC Circuits"
    )
    assert updated["clusterName"] == "Cluster 1: DC Circuits"
    assert assignment_repo.update_by_id.called

    # 2. Uncluster
    unclustered = await service.update_assignment_cluster(
        "teacher_1", "class_1", "asg_1", None
    )
    assert unclustered["clusterName"] is None


@pytest.mark.anyio
@patch("app.services.assignment_service.AssignmentRepository")
@patch("app.services.assignment_service.ClassroomRepository")
async def test_bulk_assign_and_disband_cluster(mock_classroom, mock_assignment):
    classroom_repo = MagicMock()
    classroom_repo.find_by_id = AsyncMock(
        return_value={"id": "class_1", "teacherId": "teacher_1"}
    )
    mock_classroom.return_value = classroom_repo

    assignment_repo = MagicMock()
    assignment_repo.update_many = AsyncMock(return_value=3)
    mock_assignment.return_value = assignment_repo

    service = AssignmentService()

    valid_id1 = str(ObjectId())
    valid_id2 = str(ObjectId())
    valid_id3 = str(ObjectId())

    # 1. Bulk assign 3 practicals to Cluster 2
    res = await service.bulk_assign_cluster(
        "teacher_1", "class_1", [valid_id1, valid_id2, valid_id3], "Cluster 2: AC Circuits"
    )
    assert res["updatedCount"] == 3
    assert res["clusterName"] == "Cluster 2: AC Circuits"

    # 2. Disband cluster
    disband_res = await service.disband_cluster(
        "teacher_1", "class_1", "Cluster 2: AC Circuits"
    )
    assert disband_res["disbandedCount"] == 3
    assert disband_res["clusterName"] == "Cluster 2: AC Circuits"
