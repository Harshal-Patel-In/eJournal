"""Pydantic schemas for Admin Subsystem requests and responses."""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, EmailStr, Field


class FacultyCreateRequest(BaseModel):
    """Request payload for directly provisioning a faculty member."""

    name: str = Field(..., min_length=2, description="Full name of professor or instructor")
    email: EmailStr = Field(..., description="Institutional email address")
    department: str = Field(..., min_length=2, description="Academic department (e.g. Computer Science)")
    designation: str = Field(
        default="Assistant Professor",
        description="Designation (e.g. Assistant Professor, Associate Professor, Head of Department, Lab Instructor)",
    )
    password: str | None = Field(
        default=None,
        min_length=8,
        description="Optional initial password. Auto-generated cryptographically if omitted.",
    )


class UserStatusUpdateRequest(BaseModel):
    """Request payload for toggling user active or suspended status."""

    status: Literal["active", "suspended"] = Field(..., description="New account status")


class PasswordResetRequest(BaseModel):
    """Request payload for administrative password reset."""

    newPassword: str | None = Field(
        default=None,
        min_length=8,
        description="Optional explicit password. Auto-generated if omitted.",
    )


class AdminPasswordChangeRequest(BaseModel):
    """Request payload for self-service password change by admin or users with must_change_password."""

    current_password: str = Field(..., min_length=1, description="Current password for verification")
    new_password: str = Field(..., min_length=8, description="New strong password (min 8 chars)")


class ClassroomReassignRequest(BaseModel):
    """Request payload for reassigning a classroom to a new faculty instructor."""

    newTeacherId: str = Field(..., min_length=1, description="Target teacher user ID")


class FacultyAdminRoleRequest(BaseModel):
    """Request payload for granting or revoking administrative authority to a faculty member."""

    isAdmin: bool = Field(..., description="Whether the faculty member has administrative access")


class SystemHealthStatus(BaseModel):

    """System health metrics."""

    environment: str
    database: str = "connected"
    redis: str = "connected"


class RecentActivityItem(BaseModel):
    """Recent platform activity event item."""

    id: str
    action: str
    entity: str
    entityId: str | None = None
    userId: str | None = None
    userEmail: str | None = None
    ipAddress: str | None = None
    timestamp: datetime


class AdminStatsData(BaseModel):
    """Overall platform KPI counters and health status."""

    totalStudents: int = 0
    totalFaculty: int = 0
    activeClassrooms: int = 0
    totalJournals: int = 0
    pendingSubmissions: int = 0
    approvedJournals: int = 0
    health: SystemHealthStatus
    recentActivity: list[RecentActivityItem] = []


class StudentBulkRowSchema(BaseModel):
    """Individual row schema for high-throughput student ingestion."""

    name: str = Field(..., min_length=2, max_length=100, description="Full Name of Student")
    enrollmentNumber: str = Field(
        ...,
        min_length=7,
        max_length=15,
        pattern=r"^[A-Z0-9]+$",
        description="University Enrollment Number (e.g., 24CS065)",
    )
    semester: int = Field(..., ge=1, le=8, description="Current Academic Semester (1-8)")
    department: str | None = Field(default=None, description="Academic Department")
    division: str | None = Field(default=None, description="Class Division (Numeric or Alphanumeric)")
    batch: str | None = Field(default=None, description="Lab Batch (e.g. A1, B2)")
    college: str | None = Field(default=None, description="Constituent Institute (e.g. CSPIT, DEPSTAR)")
    university: str = Field(
        default="Charotar University of Science and Technology (CHARUSAT)",
        description="Parent University Name",
    )


class StudentBulkImportRequest(BaseModel):
    """Request payload for bulk importing an entire student cohort."""

    students: list[StudentBulkRowSchema] = Field(..., min_length=1, max_length=1000)
    targetClassroomId: str | None = Field(default=None, description="Optional target classroom to enroll into")
    sendEmailInvite: bool = Field(default=True, description="Whether to dispatch welcome credentials via email queue")


class StudentCredentialItem(BaseModel):
    """Account credentials issued for an onboarded student."""

    name: str
    enrollmentNumber: str
    email: str
    temporaryPassword: str
    status: Literal["active", "pending_setup"]
    isProfileComplete: bool


class StudentBulkImportResponse(BaseModel):
    """Execution summary and credential manifest for bulk onboarding."""

    totalProcessed: int
    totalCreated: int
    totalSkipped: int
    activeCount: int
    pendingSetupCount: int
    credentials: list[StudentCredentialItem]
    skippedErrors: list[dict]



class StudentBulkRowSchema(BaseModel):
    """Individual row schema for high-throughput student ingestion."""

    name: str = Field(..., min_length=2, max_length=100, description="Full Name of Student")
    enrollmentNumber: str = Field(
        ...,
        min_length=7,
        max_length=15,
        pattern=r"^[A-Za-z0-9]+$",
        description="University Enrollment Number (e.g., 24CS064)",
    )
    semester: int = Field(..., ge=1, le=8, description="Current Academic Semester (1-8)")
    department: str | None = Field(default=None, description="Academic Department")
    division: str | None = Field(default=None, description="Class Division (Numeric or Alphanumeric)")
    batch: str | None = Field(default=None, description="Lab Batch (e.g. A1, B2)")
    college: str | None = Field(default=None, description="Constituent Institute (e.g. CSPIT, DEPSTAR)")
    university: str = Field(
        default="Charotar University of Science and Technology (CHARUSAT)",
        description="Parent University Name",
    )


class StudentBulkImportRequest(BaseModel):
    """Request payload for bulk importing an entire student cohort."""

    students: list[StudentBulkRowSchema] = Field(..., min_length=1, max_length=1000)
    targetClassroomId: str | None = Field(default=None, description="Optional target classroom to enroll into")
    sendEmailInvite: bool = Field(default=True, description="Whether to dispatch welcome credentials via email queue")


class StudentCredentialItem(BaseModel):
    """Account credentials issued for an onboarded student."""

    name: str
    enrollmentNumber: str
    email: str
    temporaryPassword: str
    status: Literal["active", "pending_setup"]
    isProfileComplete: bool


class StudentBulkImportResponse(BaseModel):
    """Execution summary and credential manifest for bulk onboarding."""

    totalProcessed: int
    totalCreated: int
    totalSkipped: int
    activeCount: int
    pendingSetupCount: int
    credentials: list[StudentCredentialItem]
    skippedErrors: list[dict]



class ClassroomFreezeRequest(BaseModel):
    """Request payload to seal or unseal an academic term for a classroom."""

    isFrozen: bool = Field(..., description="Whether to seal the term and lock journal writes")


class ClassroomPurgeRequest(BaseModel):
    """Irreversible deep storage purge request with security confirmation."""

    password: str = Field(..., min_length=1, description="Admin password confirmation")
    confirmTitle: str = Field(..., min_length=1, description="Exact classroom title confirmation")


class DefaulterStudentItem(BaseModel):
    """Academic progress and completion metrics for a student."""

    studentId: str
    name: str
    enrollmentNumber: str
    email: str
    batch: str | None = None
    department: str | None = None
    division: str | None = None
    approvedPracticals: int
    totalPracticals: int
    completionRate: float


class DefaultersRadarResponse(BaseModel):
    """Defaulters analysis report across a lab classroom or department cohort."""

    classroomId: str | None = None
    classroomName: str | None = None
    threshold: float
    totalStudents: int
    defaultersCount: int
    defaulters: list[DefaulterStudentItem]


class MatchedBlockPair(BaseModel):
    """Pair of matching blocks identified between two student submissions."""

    blockType: str = Field(..., description="Block category: code, table, paragraph, or math")
    blockIdA: str
    blockIdB: str
    similarity: float
    snippetA: str | None = None
    snippetB: str | None = None


class SimilarityMatchItem(BaseModel):
    """Pairwise similarity match details between two student submissions."""

    studentA: dict
    studentB: dict
    journalIdA: str
    journalIdB: str
    overallSimilarity: float
    categoryMatches: dict[str, float]
    matchedBlockPairs: list[MatchedBlockPair]


class SimilarityScanRequest(BaseModel):
    """Request payload to initiate a cross-journal similarity scan."""

    assignmentId: str | None = Field(None, description="Specific practical assignment ID")
    classroomId: str | None = Field(None, description="Target classroom ID")
    threshold: float = Field(0.50, ge=0.1, le=1.0, description="Minimum similarity threshold to flag (0.1 to 1.0)")


class SimilarityReportResponse(BaseModel):
    """Report summarizing cross-journal similarity scan results."""

    id: str
    assignmentId: str | None = None
    assignmentTitle: str | None = None
    classroomId: str | None = None
    classroomName: str | None = None
    generatedAt: str
    totalSubmissions: int
    flaggedPairsCount: int
    threshold: float
    matches: list[SimilarityMatchItem]


class AccreditationPortfolioResponse(BaseModel):
    """Comprehensive academic portfolio package data for NBA / NAAC accreditation audits."""

    classroomId: str
    classroomName: str
    subjectCode: str
    teacherName: str
    academicTerm: str
    generatedAt: str
    totalStudents: int
    totalAssignments: int
    sampleCount: int = 0
    topTierCount: int = 0
    midTierCount: int = 0
    lowTierCount: int = 0
    evaluationMatrix: list[dict]
    topTierJournals: list[dict]
    midTierJournals: list[dict]
    lowTierJournals: list[dict]
