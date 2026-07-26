"""Visual Block-Based Document Editor API router.

RULE-API01: Follow RESTful conventions.
RULE-AUTH07: RBAC controls routes.
"""

from fastapi import APIRouter, Depends, Request, status

from app.dependencies.auth import RoleChecker, get_active_user
from app.schemas.journal import JournalCreateRequest, JournalSaveRequest, JournalResponse
from app.schemas.response import ApiResponse, success_response
from app.services.journal_service import JournalService

router = APIRouter(prefix="/journals")


@router.post(
    "",
    response_model=ApiResponse[JournalResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_journal(
    payload: JournalCreateRequest,
    request: Request,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Initialize a new visual block draft journal for an assignment (Student only)."""
    ip_address = request.client.host if request.client else None
    journal = await journal_service.create_journal(user["id"], payload, ip_address=ip_address)
    return success_response(journal)


@router.get("", response_model=ApiResponse[list])
async def list_my_journals(
    user: dict = Depends(get_active_user),
    journal_service: JournalService = Depends(),
):
    """List all journals belonging to the authenticated student."""
    journals = await journal_service.list_student_journals(user["id"])
    return success_response(journals)


@router.get("/{journalId}", response_model=ApiResponse[JournalResponse])
async def get_journal(
    journalId: str,
    user: dict = Depends(get_active_user),
    journal_service: JournalService = Depends(),
):
    """Retrieve details and block contents of a journal (Student owner or Classroom teacher)."""
    journal = await journal_service.get_journal_by_id(journalId, user["id"], user["role"])
    return success_response(journal)


@router.put("/{journalId}", response_model=ApiResponse[JournalResponse])
async def save_journal(
    journalId: str,
    payload: JournalSaveRequest,
    request: Request,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Save/Sync the complete document blocks content for a draft journal (Student only)."""
    ip_address = request.client.host if request.client else None
    journal = await journal_service.save_journal(
        journalId, user["id"], payload, ip_address=ip_address
    )
    return success_response(journal)


@router.post(
    "/{journalId}/submit",
    response_model=ApiResponse[JournalResponse],
    status_code=status.HTTP_200_OK,
)
async def submit_journal(
    journalId: str,
    request: Request,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Submit/Hand-in a visual journal for instructor review (Student only)."""
    ip_address = request.client.host if request.client else None
    journal = await journal_service.submit_journal(
        journalId, user["id"], ip_address=ip_address
    )
    return success_response(journal)


@router.post(
    "/{journalId}/unsubmit",
    response_model=ApiResponse[JournalResponse],
    status_code=status.HTTP_200_OK,
)
async def unsubmit_journal(
    journalId: str,
    request: Request,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Undo submission/Unsubmit a visual journal back to draft (Student only)."""
    ip_address = request.client.host if request.client else None
    journal = await journal_service.unsubmit_journal(
        journalId, user["id"], ip_address=ip_address
    )
    return success_response(journal)


@router.get("/{journalId}/export/pdf")
async def export_journal_pdf(
    journalId: str,
    user: dict = Depends(get_active_user),
    journal_service: JournalService = Depends(),
):
    """Export journal report as PDF (Student owner or Teacher)."""
    from fastapi import Response
    from app.repositories.user_repository import UserRepository
    from app.repositories.classroom_repository import ClassroomRepository
    from app.utils.export import generate_pdf_bytes

    # 1. Fetch journal details
    journal = await journal_service.get_journal_by_id(
        journalId, user["id"], user["role"]
    )

    # 2. Fetch student and classroom profiles
    user_repo = UserRepository()
    classroom_repo = ClassroomRepository()

    student = await user_repo.find_by_id(journal["studentId"])
    student_name = (
        student.get("profile", {}).get("name", "A Student")
        if student
        else "A Student"
    )

    assignment = await journal_service.assignment_repo.find_by_id(
        journal["assignmentId"]
    )
    classroom_name = "N/A"
    if assignment:
        classroom = await classroom_repo.find_by_id(assignment["classroomId"])
        if classroom:
            classroom_name = classroom["name"]

    # 3. Generate PDF content
    pdf_data = generate_pdf_bytes(journal, student_name, classroom_name)

    # 4. Stream attachment
    filename = f"Journal_{journalId}.pdf"
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{journalId}/export/docx")
async def export_journal_docx(
    journalId: str,
    user: dict = Depends(get_active_user),
    journal_service: JournalService = Depends(),
):
    """Export journal report as Word Document (.docx) (Student owner or Teacher)."""
    from fastapi import Response
    from app.repositories.user_repository import UserRepository
    from app.repositories.classroom_repository import ClassroomRepository
    from app.utils.export import generate_docx_bytes

    # 1. Fetch journal details
    journal = await journal_service.get_journal_by_id(
        journalId, user["id"], user["role"]
    )

    # 2. Fetch student and classroom profiles
    user_repo = UserRepository()
    classroom_repo = ClassroomRepository()

    student = await user_repo.find_by_id(journal["studentId"])
    student_name = (
        student.get("profile", {}).get("name", "A Student")
        if student
        else "A Student"
    )

    assignment = await journal_service.assignment_repo.find_by_id(
        journal["assignmentId"]
    )
    classroom_name = "N/A"
    if assignment:
        classroom = await classroom_repo.find_by_id(assignment["classroomId"])
        if classroom:
            classroom_name = classroom["name"]

    # 3. Generate Word DOCX content
    docx_data = generate_docx_bytes(journal, student_name, classroom_name)

    # 4. Stream attachment
    filename = f"Journal_{journalId}.docx"
    return Response(
        content=docx_data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



