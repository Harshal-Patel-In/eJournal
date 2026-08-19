"""Teacher Gradebook Matrix, CSV Reporting, and Student Analytics Service.

Provides 2D student-assignment grading matrices, formatted CSV exports for faculty reporting,
and student academic performance summaries.
"""

import csv
from datetime import datetime, timezone
import io
from fastapi import status
from fastapi.responses import StreamingResponse

from app.core.constants import ErrorCode
from app.middleware.error_handler import AppException
from app.repositories.assignment_repository import AssignmentRepository
from app.repositories.classroom_membership_repository import ClassroomMembershipRepository
from app.repositories.classroom_repository import ClassroomRepository
from app.repositories.journal_repository import JournalRepository
from app.repositories.user_repository import UserRepository


class GradebookService:
    """Gradebook aggregation and reporting service."""

    def __init__(self) -> None:
        self.classroom_repo = ClassroomRepository()
        self.assignment_repo = AssignmentRepository()
        self.membership_repo = ClassroomMembershipRepository()
        self.journal_repo = JournalRepository()
        self.user_repo = UserRepository()

    async def get_classroom_gradebook(
        self, classroom_id: str, teacher_id: str, batch: str | None = None
    ) -> dict:
        """Construct the full 2D grading matrix for a classroom (Teacher only)."""
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        if not classroom:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Classroom not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if classroom.get("teacherId") != teacher_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not authorized to view the gradebook for this classroom",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # 1. Fetch all published assignments for this classroom sorted by experiment number
        assignments = await self.assignment_repo.find_by_classroom_id(classroom_id)
        assignments.sort(key=lambda a: int(a.get("experimentNumber", 0)))

        # 2. Fetch unique student memberships for this classroom
        raw_memberships = await self.membership_repo.find_members_by_classroom_id(classroom_id)
        seen_student_ids: set[str] = set()
        all_memberships = []
        for m in raw_memberships:
            sid = m.get("studentId")
            if sid and sid not in seen_student_ids:
                seen_student_ids.add(sid)
                all_memberships.append(m)

        # 3. Load all journals for this classroom's assignments
        assignment_ids = [a["id"] for a in assignments]
        journals = []
        if assignment_ids:
            journals = await self.journal_repo.find_many(
                {"assignmentId": {"$in": assignment_ids}}, limit=1000
            )

        # Ensure any student who created a journal in this classroom is also included
        for j in journals:
            sid = j.get("studentId")
            if sid and sid not in seen_student_ids:
                seen_student_ids.add(sid)
                all_memberships.append({"studentId": sid})

        # Index journals by (studentId, assignmentId)
        journal_map: dict[tuple[str, str], dict] = {}
        for j in journals:
            key = (str(j.get("studentId", "")), str(j.get("assignmentId", "")))
            journal_map[key] = j

        # 4. Extract batches and build student rows
        available_batches_set: set[str] = set(classroom.get("batches", []))
        student_rows = []
        total_eval_percentages = []

        active_batch_filter = (batch or "ALL").strip().upper()

        for m in all_memberships:
            student_id = m.get("studentId")
            if not student_id:
                continue

            user = await self.user_repo.find_by_id(student_id)
            profile = user.get("profile", {}) if user else {}
            student_name = profile.get("name") or (user.get("name") if user else None) or (user.get("email") if user else "Student")
            enrollment_no = profile.get("enrollmentNumber") or m.get("enrollmentNumber") or "N/A"
            student_batch = (profile.get("batch") or m.get("batch") or "").strip().upper()

            if student_batch:
                available_batches_set.add(student_batch)

            # Apply batch filter if specified
            if active_batch_filter != "ALL" and student_batch != active_batch_filter:
                continue

            student_grades: dict[str, dict] = {}
            marks_obtained_sum = 0.0
            evaluated_max_marks_sum = 0.0
            term_max_marks_sum = 0.0
            approved_count = 0

            for asg in assignments:
                asg_id = asg["id"]
                asg_max = float(asg.get("maxMarks", 10))
                term_max_marks_sum += asg_max

                j = journal_map.get((student_id, asg_id))
                if j:
                    status_str = j.get("status", "draft")
                    marks = j.get("marks")
                    if status_str == "approved" and marks is not None:
                        approved_count += 1
                        marks_obtained_sum += float(marks)
                        evaluated_max_marks_sum += asg_max

                    student_grades[asg_id] = {
                        "journalId": j.get("id"),
                        "status": status_str,
                        "marks": marks,
                        "maxMarks": asg_max,
                        "isLate": j.get("isLate", False),
                        "submittedAt": j.get("submittedAt"),
                        "approvedAt": j.get("approvedAt"),
                        "teacherRemarks": j.get("teacherRemarks"),
                    }
                else:
                    student_grades[asg_id] = {
                        "journalId": None,
                        "status": "not_started",
                        "marks": None,
                        "maxMarks": asg_max,
                        "isLate": False,
                        "submittedAt": None,
                        "approvedAt": None,
                        "teacherRemarks": None,
                    }

            percentage = (
                round((marks_obtained_sum / evaluated_max_marks_sum) * 100, 2)
                if evaluated_max_marks_sum > 0
                else 0.0
            )
            if approved_count > 0:
                total_eval_percentages.append(percentage)

            if approved_count > 0:
                if percentage >= 75.0:
                    standing = "Distinction"
                elif percentage >= 60.0:
                    standing = "First Class"
                elif percentage >= 50.0:
                    standing = "Second Class"
                elif percentage >= 40.0:
                    standing = "Pass Class"
                else:
                    standing = "Needs Improvement"
            else:
                standing = "Pending"

            student_rows.append(
                {
                    "studentId": student_id,
                    "name": student_name,
                    "enrollmentNumber": enrollment_no,
                    "batch": student_batch or "N/A",
                    "email": user.get("email") if user else None,
                    "grades": student_grades,
                    "totalMarksObtained": round(marks_obtained_sum, 2),
                    "evaluatedMaxMarks": round(evaluated_max_marks_sum, 2),
                    "totalMaxMarks": round(term_max_marks_sum, 2),
                    "percentage": percentage,
                    "standing": standing,
                    "completedCount": approved_count,
                    "totalAssignmentsCount": len(assignments),
                }
            )

        # Sort students alphabetically by enrollment number / name
        student_rows.sort(key=lambda s: (s["enrollmentNumber"], s["name"]))

        class_avg_percentage = (
            round(sum(total_eval_percentages) / len(total_eval_percentages), 2)
            if total_eval_percentages
            else 0.0
        )

        return {
            "classroom": {
                "id": classroom["id"],
                "name": classroom.get("name"),
                "subject": classroom.get("subject"),
                "semester": classroom.get("semester"),
                "division": classroom.get("division"),
                "department": classroom.get("department"),
                "joinCode": classroom.get("joinCode"),
                "batches": classroom.get("batches", []),
            },
            "assignments": [
                {
                    "id": a["id"],
                    "title": a.get("title"),
                    "experimentNumber": a.get("experimentNumber"),
                    "maxMarks": a.get("maxMarks", 10),
                    "aim": a.get("aim"),
                    "deadline": a.get("deadline"),
                }
                for a in assignments
            ],
            "students": student_rows,
            "summary": {
                "totalStudents": len(student_rows),
                "totalAssignments": len(assignments),
                "classAveragePercentage": class_avg_percentage,
                "availableBatches": sorted(list(available_batches_set)),
                "selectedBatch": active_batch_filter,
            },
        }

    async def export_gradebook_csv(
        self, classroom_id: str, teacher_id: str, batch: str | None = None
    ) -> StreamingResponse:
        """Stream a downloadable .csv spreadsheet of classroom marks."""
        gradebook_data = await self.get_classroom_gradebook(classroom_id, teacher_id, batch)
        classroom = gradebook_data["classroom"]
        assignments = gradebook_data["assignments"]
        students = gradebook_data["students"]
        summary = gradebook_data["summary"]

        output = io.StringIO()
        writer = csv.writer(output)

        # Header metadata block
        writer.writerow(["eJournal — Academic Gradebook & Evaluation Report"])
        writer.writerow(["Classroom:", classroom.get("name", "N/A"), "Subject:", classroom.get("subject", "N/A")])
        writer.writerow(["Department:", classroom.get("department", "N/A"), "Semester / Div:", f"Sem {classroom.get('semester', '')} - Div {classroom.get('division', '')}"])
        writer.writerow(["Batch Filter:", summary.get("selectedBatch", "ALL"), "Export Date (UTC):", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")])
        writer.writerow(["Total Students:", summary.get("totalStudents", 0), "Class Avg Score:", f"{summary.get('classAveragePercentage', 0)}%"])
        writer.writerow([])  # Blank spacer row

        # Table Column Headers
        headers = ["Sr. No.", "Enrollment No.", "Student Name", "Batch"]
        for asg in assignments:
            exp_num = asg.get("experimentNumber", 1)
            max_m = asg.get("maxMarks", 10)
            headers.append(f"Exp #{exp_num} (Max: {max_m})")

        headers.extend(["Total Obtained", "Total Max", "Percentage (%)", "Completed Practicals", "Standing"])
        writer.writerow(headers)

        # Table Rows
        for i, s in enumerate(students, 1):
            row = [
                str(i),
                s["enrollmentNumber"],
                s["name"],
                s["batch"],
            ]

            for asg in assignments:
                g = s["grades"].get(asg["id"], {})
                status_str = g.get("status", "not_started")
                marks = g.get("marks")

                if status_str == "approved" and marks is not None:
                    cell_val = f"{marks}"
                elif status_str in ["submitted", "late_submitted"]:
                    cell_val = "Submitted (Pending)"
                elif status_str == "changes_requested":
                    cell_val = "Revision Req."
                elif status_str == "draft":
                    cell_val = "In Progress"
                else:
                    cell_val = "Not Started"

                row.append(cell_val)

            pct = s["percentage"]
            standing = s.get("standing", "Pending")

            row.extend([
                str(s["totalMarksObtained"]),
                f"{s['evaluatedMaxMarks']} (Term: {s['totalMaxMarks']})",
                f"{pct:.2f}%" if s["completedCount"] > 0 else "N/A",
                f"{s['completedCount']} / {s['totalAssignmentsCount']}",
                standing,
            ])
            writer.writerow(row)

        output.seek(0)
        safe_name = "".join(c if c.isalnum() else "_" for c in classroom.get("name", "Classroom")).strip("_")
        batch_suffix = f"_{summary.get('selectedBatch')}" if summary.get("selectedBatch") != "ALL" else ""
        filename = f"Gradebook_{safe_name}{batch_suffix}.csv"

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    async def get_student_analytics(self, student_id: str) -> dict:
        """Aggregate student's overall academic progress across all enrolled classrooms."""
        memberships = await self.membership_repo.find_by_student_id(student_id)
        classroom_ids = [m["classroomId"] for m in memberships]

        if not classroom_ids:
            return {
                "totalAssigned": 0,
                "completedApproved": 0,
                "submittedPending": 0,
                "changesRequested": 0,
                "inProgress": 0,
                "notStarted": 0,
                "cumulativeAverageScore": 0.0,
                "classroomsProgress": [],
            }

        classrooms = await self.classroom_repo.find_many({"_id": {"$in": [self.classroom_repo._to_object_id(cid) for cid in classroom_ids]}})
        all_assignments = await self.assignment_repo.find_many({"classroomId": {"$in": classroom_ids}}, limit=1000)
        all_journals = await self.journal_repo.find_many({"studentId": student_id}, limit=1000)

        journal_by_assignment = {j["assignmentId"]: j for j in all_journals if j.get("assignmentId")}

        total_assigned = len(all_assignments)
        completed_approved = 0
        submitted_pending = 0
        changes_requested = 0
        in_progress = 0
        not_started = 0
        total_marks_obtained = 0.0
        total_max_marks = 0.0

        classroom_map: dict[str, dict] = {}
        for c in classrooms:
            classroom_map[c["id"]] = {
                "classroomId": c["id"],
                "classroomName": c.get("name"),
                "subject": c.get("subject"),
                "totalAssignments": 0,
                "completed": 0,
                "pending": 0,
                "marksObtained": 0.0,
                "maxMarks": 0.0,
            }

        for asg in all_assignments:
            cid = asg.get("classroomId")
            if cid in classroom_map:
                classroom_map[cid]["totalAssignments"] += 1

            j = journal_by_assignment.get(asg["id"])
            if not j:
                not_started += 1
            else:
                st = j.get("status", "draft")
                if st == "approved":
                    completed_approved += 1
                    marks = float(j.get("marks", 0))
                    max_m = float(asg.get("maxMarks", 10))
                    total_marks_obtained += marks
                    total_max_marks += max_m
                    if cid in classroom_map:
                        classroom_map[cid]["completed"] += 1
                        classroom_map[cid]["marksObtained"] += marks
                        classroom_map[cid]["maxMarks"] += max_m
                elif st in ["submitted", "late_submitted"]:
                    submitted_pending += 1
                    if cid in classroom_map:
                        classroom_map[cid]["pending"] += 1
                elif st == "changes_requested":
                    changes_requested += 1
                    if cid in classroom_map:
                        classroom_map[cid]["pending"] += 1
                elif st == "draft":
                    in_progress += 1

        cumulative_avg = (
            round((total_marks_obtained / total_max_marks) * 100, 2)
            if total_max_marks > 0
            else 0.0
        )

        classrooms_progress = []
        for cp in classroom_map.values():
            avg_score = (
                round((cp["marksObtained"] / cp["maxMarks"]) * 100, 2)
                if cp["maxMarks"] > 0
                else 0.0
            )
            classrooms_progress.append(
                {
                    "classroomId": cp["classroomId"],
                    "classroomName": cp["classroomName"],
                    "subject": cp["subject"],
                    "total": cp["totalAssignments"],
                    "completed": cp["completed"],
                    "pending": cp["pending"],
                    "averageScore": avg_score,
                }
            )

        return {
            "totalAssigned": total_assigned,
            "completedApproved": completed_approved,
            "submittedPending": submitted_pending,
            "changesRequested": changes_requested,
            "inProgress": in_progress,
            "notStarted": not_started,
            "cumulativeAverageScore": cumulative_avg,
            "classroomsProgress": classrooms_progress,
        }
