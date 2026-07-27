# Project Rules
## Journal Management & Review System

> These rules define the mandatory constraints, conventions, and guardrails that every developer, AI agent, or contributor MUST follow when working on this project. Violating any rule listed here is considered a defect.

---

## Table of Contents

1. [Architecture Invariants](#1-architecture-invariants)
2. [Core Design Philosophy](#2-core-design-philosophy)
3. [Document Model Rules](#3-document-model-rules)
4. [Database Rules (MongoDB)](#4-database-rules-mongodb)
5. [Backend Rules (FastAPI / Python)](#5-backend-rules-fastapi--python)
6. [Frontend Rules (Next.js / TypeScript)](#6-frontend-rules-nextjs--typescript)
7. [Authentication & Authorization Rules](#7-authentication--authorization-rules)
8. [Editor Rules](#8-editor-rules)
9. [Mathematical Writing Rules](#9-mathematical-writing-rules)
10. [Review System Rules](#10-review-system-rules)
11. [Version History Rules](#11-version-history-rules)
12. [Rendering & Export Rules](#12-rendering--export-rules)
13. [Auto-Save & Synchronization Rules](#13-auto-save--synchronization-rules)
14. [API Design Rules](#14-api-design-rules)
15. [Security Rules](#15-security-rules)
16. [Testing Rules](#16-testing-rules)
17. [Infrastructure & Deployment Rules](#17-infrastructure--deployment-rules)
18. [Configuration Rules](#18-configuration-rules)
19. [Notification Rules](#19-notification-rules)
20. [Media & File Upload Rules](#20-media--file-upload-rules)
21. [Migration Rules](#21-migration-rules)
22. [Code Organization Rules](#22-code-organization-rules)
23. [Naming Conventions](#23-naming-conventions)
24. [Error Handling Rules](#24-error-handling-rules)

---

## 1. Architecture Invariants

> These are non-negotiable architectural principles. They MUST NOT be violated regardless of feature requirements.

- **RULE-A01:** The structured document model and separation of editing, storage, review, and rendering MUST remain architectural invariants. No feature can merge these concerns.
- **RULE-A02:** Every journal MUST be represented as a structured collection of independent blocks (block-based document model), never as one large HTML string.
- **RULE-A03:** The same canonical document model MUST be used by the editor, preview, auto-save, versioning, review, and all export renderers. There must be no separately maintained document content.
- **RULE-A04:** The browser/client MUST NEVER connect directly to MongoDB. All persistence goes through authenticated backend APIs.
- **RULE-A05:** Application services MUST be stateless. No user state may be stored in server memory. All persistent information lives in MongoDB, Redis, or object storage.
- **RULE-A06:** Binary media (images, generated PDFs, generated DOCX files) MUST NEVER be stored directly inside MongoDB. Media blocks store references to externally managed assets in object storage.
- **RULE-A07:** The backend follows a layered architecture: API Layer → Service Layer → Repository Layer → MongoDB. Routes MUST NOT contain business logic. Business logic MUST NOT contain database queries.
- **RULE-A08:** Editing, storage, review, versioning, rendering, and export MUST remain separated concerns. No single module or service should merge multiple of these responsibilities.

---

## 2. Core Design Philosophy

- **RULE-P01:** A journal is NOT plain text. A journal is a structured academic document. All code must treat it as such.
- **RULE-P02:** The system is NOT a journal editor. It is a reusable academic document platform where journals are one document type. All design decisions must consider future document types.
- **RULE-P03:** Students must NEVER be required to learn or write LaTeX, HTML, or any publishing syntax directly.
- **RULE-P04:** Teachers MUST NOT directly modify student journal content. Teachers interact through the Review System only, preserving document integrity.
- **RULE-P05:** Cover pages MUST be generated automatically from verified student profile and classroom information — never manually typed by students.

---

## 3. Document Model Rules

- **RULE-D01:** Every document block MUST have a stable unique identifier (`id`) that persists across editing sessions, reordering, auto-save cycles, and version history.
- **RULE-D02:** Every document block MUST store its block type, content, position, and required metadata.
- **RULE-D03:** The document model MUST separate content from presentation-specific rendering logic.
- **RULE-D04:** The document model MUST support future block types without requiring a complete document-schema redesign.
- **RULE-D05:** Every structured journal document MUST maintain an explicit `schemaVersion` field for safe migrations.
- **RULE-D06:** Media blocks MUST store references to externally stored binary assets, not embed binary data in the document.
- **RULE-D07:** Block content at the application boundary is represented as structured JSON. When persisted in MongoDB, it is stored as BSON. Both representations must be semantically equivalent.
- **RULE-D08:** The `blockOrder` (or block array order) is the canonical ordering mechanism. Position must not rely on fragile index-based assumptions.

---

## 4. Database Rules (MongoDB)

### General

- **RULE-DB01:** MongoDB is the primary persistent document database. All structured application data lives in MongoDB.
- **RULE-DB02:** MongoDB's flexible document model does NOT mean the application is schema-less. Predictable structures MUST be maintained through Pydantic/application models, collection validation, explicit `schemaVersion` fields, and controlled migration logic.
- **RULE-DB03:** Every MongoDB collection MUST have appropriate indexes defined and version-controlled as infrastructure code.

### Document Modeling

- **RULE-DB04:** **Embed** data when it is owned by one parent, normally loaded with the parent, and remains within safe document-size limits (e.g., journal blocks inside the journal document).
- **RULE-DB05:** **Reference** (separate collection) data that grows independently, is queried independently, has its own lifecycle, or is high-volume (comments, revisions, notifications, audit logs).
- **RULE-DB06:** The current journal state (metadata + ordered blocks) MUST be stored as one structured document in the `journals` collection for efficient loading.
- **RULE-DB07:** Immutable revision history MUST be stored in a dedicated `journal_versions` collection, NOT embedded in the journal document.
- **RULE-DB08:** Review comments MUST be stored in a dedicated `comments` collection, NOT embedded inside the journal document.
- **RULE-DB09:** Approval records MUST be stored in a dedicated `approvals` collection and reference both journal ID and approved revision ID.
- **RULE-DB10:** Audit events MUST be stored in a dedicated append-oriented `audit_logs` collection.
- **RULE-DB11:** Notifications MUST be stored in a dedicated `notifications` collection.

### Collections Summary

```
MongoDB
├── users
├── profiles (or embedded in users)
├── classrooms
├── classroom_memberships
├── assignments
├── journals
│   └── document { schemaVersion, metadata, blocks[] }
├── journal_versions
├── comments
├── approvals
├── notifications
└── audit_logs
```

### Indexing Strategy

| Collection | Required Indexes |
|------------|-----------------|
| users | Unique: `email` |
| classrooms | Unique: `joinCode` |
| classroom_memberships | Compound unique: `classroomId + studentId` |
| assignments | `classroomId` |
| journals | `assignmentId`, `studentId`, compound `assignmentId + studentId` |
| journal_versions | Unique: `journalId + revisionNumber`, `journalId + createdAt` |
| comments | `journalId + blockId`, `journalId + status` |
| notifications | `userId + isRead` |
| audit_logs | `entity + entityId`, `timestamp` |

### Transactions

- **RULE-DB12:** Single-document atomic updates MUST be preferred whenever the data model allows them.
- **RULE-DB13:** Multi-document transactions MUST only be used when atomicity across multiple collections is genuinely required (e.g., submission + immutable revision creation, approval + audit record creation).

### Identifiers

- **RULE-DB14:** The platform MAY use MongoDB `ObjectId` internally but MUST expose stable string identifiers through APIs. Identifier strategy must be consistent across API contracts, document references, comments, versions, review anchors, and audit events.

---

## 5. Backend Rules (FastAPI / Python)

- **RULE-BE01:** The backend MUST use FastAPI with Python.
- **RULE-BE02:** Request/response validation MUST use Pydantic models. Only validated data may reach the service layer.
- **RULE-BE03:** API routes MUST be intentionally thin — parse request, call service, return response. No business logic in routes.
- **RULE-BE04:** All business logic MUST live inside service classes (Service Layer).
- **RULE-BE05:** All database operations MUST live inside repository classes (Repository Layer). Services MUST NOT contain raw MongoDB queries.
- **RULE-BE06:** The API layer MUST NEVER return raw MongoDB documents. Database-specific representations are normalized before leaving the repository boundary.
- **RULE-BE07:** The application MUST maintain a shared MongoDB client per backend process with driver connection pooling, NOT create a new connection per request.
- **RULE-BE08:** Connection configuration (MongoDB URI, database name, timeouts, TLS, pool limits) MUST be loaded from environment-based settings.
- **RULE-BE09:** Repository/serialization layer MUST convert MongoDB `_id` values into API-safe strings.
- **RULE-BE10:** The backend MUST use the official MongoDB Python driver (PyMongo) with asynchronous support where appropriate.

### Backend Folder Structure

```
backend/
├── app/
│   ├── api/              # API routes (thin controllers)
│   ├── core/             # Configuration, security, constants
│   ├── models/           # Database/document models
│   ├── schemas/          # Pydantic request/response schemas
│   ├── repositories/     # MongoDB data access layer
│   ├── services/         # Business logic layer
│   ├── middleware/        # Authentication, CORS, etc.
│   ├── dependencies/     # Dependency injection
│   ├── utils/            # Shared utilities
│   ├── renderers/        # PDF, DOCX, Print rendering
│   ├── workers/          # Celery background tasks
│   ├── notifications/    # Notification service
│   └── main.py           # Application entry point
├── tests/
├── migrations/           # Versioned migration scripts
├── scripts/              # Seed data, admin scripts
├── Dockerfile
└── requirements.txt
```

### Repository Structure

```
repositories/
├── user_repository.py
├── classroom_repository.py
├── assignment_repository.py
├── journal_repository.py
├── version_repository.py
├── comment_repository.py
├── approval_repository.py
├── notification_repository.py
└── audit_log_repository.py
```

---

## 6. Frontend Rules (Next.js / TypeScript)

- **RULE-FE01:** The frontend MUST use Next.js (App Router) with TypeScript.
- **RULE-FE02:** Styling MUST use Tailwind CSS.
- **RULE-FE03:** UI components MUST use shadcn/ui as the component library.
- **RULE-FE04:** Client state management MUST use Zustand.
- **RULE-FE05:** Server state / data fetching MUST use TanStack Query (React Query).
- **RULE-FE06:** Form handling MUST use React Hook Form with Zod validation.
- **RULE-FE07:** Drag and drop MUST use React DnD or dnd-kit.
- **RULE-FE08:** The frontend MUST NEVER make direct database connections. All data flows through authenticated backend APIs.
- **RULE-FE09:** The client-side Document Store is an in-memory state layer. It is the immediate source of truth during an active editing session. The persisted MongoDB journal document is the durable server-side source of truth after successful synchronization.

---

## 7. Authentication & Authorization Rules

- **RULE-AUTH01:** Authentication MUST use JWT tokens stored in HTTP-only cookies.
- **RULE-AUTH02:** Authentication MUST be validated centrally via Next.js Middleware, NOT checked individually in every page.
- **RULE-AUTH03:** Every request MUST pass through an authentication pipeline: JWT Cookie Present? → Validate JWT → Load User → Verify Role → Verify Profile → Allow Access.
- **RULE-AUTH04:** Every account MUST verify email ownership via OTP before activation.
- **RULE-AUTH05:** Passwords MUST be hashed before storage. Never stored in plaintext.
- **RULE-AUTH06:** Profile validation MUST occur after authentication. Users with incomplete profiles MUST be redirected to profile setup. Dashboard access requires complete profile.
- **RULE-AUTH07:** Role-Based Access Control (RBAC) MUST enforce that students cannot access teacher features and teachers cannot access student-only features.
- **RULE-AUTH08:** Authorization MUST answer "What are you allowed to do?" after authentication answers "Who are you?"
- **RULE-AUTH09:** Students MUST NOT access other students' private journals.
- **RULE-AUTH10:** Teachers MUST only access classrooms and submissions for which they have authorization.

---

## 8. Editor Rules

- **RULE-ED01:** The block-based editor MUST use Lexical or BlockNote as the underlying rich text / block editor engine.
- **RULE-ED02:** Every editor interaction MUST provide near-immediate visual feedback.
- **RULE-ED03:** The editor layout MUST be intentionally minimal to avoid distracting students while writing.
- **RULE-ED04:** Students MUST be able to insert blocks via toolbar buttons OR slash commands (type `/`).
- **RULE-ED05:** Every block MUST be independently insertable, movable, duplicatable, deletable, collapsible, renderable, exportable, commentable, versionable, and reusable.
- **RULE-ED06:** Drag-and-drop reordering MUST update only block positions; block content MUST remain untouched.
- **RULE-ED07:** The editor MUST display a visible save/sync status (e.g., "Saved • Revision 15 • Synced").
- **RULE-ED08:** Every modification MUST immediately update the live preview.
- **RULE-ED09:** The internal document representation MUST remain independent of one specific visual editor library, allowing future editor library changes without rewriting the document model.

---

## 9. Mathematical Writing Rules

- **RULE-MATH01:** Students MUST be able to write mathematical expressions through a Visual Equation Builder — no LaTeX knowledge required.
- **RULE-MATH02:** The visual editor generates LaTeX internally. Students MUST NEVER interact with LaTeX directly.
- **RULE-MATH03:** Equations MUST be rendered using KaTeX.
- **RULE-MATH04:** The rendering pipeline is: Visual Formula → Document Model → LaTeX → KaTeX Renderer → PDF Renderer. Every renderer receives the same mathematical document model.
- **RULE-MATH05:** Mathematical expressions MUST preserve their structure during editing, review, versioning, preview, and export.
- **RULE-MATH06:** Inline equations MUST behave like characters inside paragraphs while maintaining mathematical formatting.
- **RULE-MATH07:** Display equations MUST be independent document blocks.
- **RULE-MATH08:** Equation blocks MUST store both `latex` and `mathml` in their data field for interoperability.
- **RULE-MATH09:** The Smart Recognition Engine MUST NOT disrupt normal typing. It should suggest/convert recognizable patterns (e.g., `sqrt(x)` → √x) non-intrusively.

---

## 10. Review System Rules

- **RULE-REV01:** The review layer MUST exist independently of the document content. Comments MUST NEVER alter the original student content.
- **RULE-REV02:** Teachers MUST review individual document blocks, not the entire document as one file.
- **RULE-REV03:** Comments MUST be stored in the dedicated MongoDB `comments` collection, NOT embedded in the journal document.
- **RULE-REV04:** Comments MUST reference `journalId` and `blockId` using stable identifiers so feedback remains associated with correct content even when blocks are reordered.
- **RULE-REV05:** Suggestions MUST be non-destructive: accepting a suggestion triggers a student-authorized document update; rejecting changes only the suggestion state.
- **RULE-REV06:** Comments MUST support replies (threaded discussions). Replies reference a parent comment or thread identifier.
- **RULE-REV07:** The backend MUST validate teacher authorization before creating, updating, resolving, or deleting review annotations.
- **RULE-REV08:** When a teacher opens a journal, the editor MUST switch to Review Mode with annotation tools (comments, suggestions, highlights, approval controls).

---

## 11. Version History Rules

- **RULE-VH01:** Every meaningful modification MUST create a new immutable revision. Previous versions MUST NEVER be modified after creation.
- **RULE-VH02:** Revisions MUST be stored in the `journal_versions` MongoDB collection, NOT embedded in the current journal document.
- **RULE-VH03:** Not every keystroke creates a permanent revision. Auto-save protects active work; revision history records meaningful milestones.
- **RULE-VH04:** The system MUST use a hybrid snapshot + delta strategy. Full snapshots at key milestones (creation, submission, approval, every N revisions); deltas for intermediate changes.
- **RULE-VH05:** Restoring an older revision MUST create a new revision rather than overwriting history.
- **RULE-VH06:** Restore operations MUST validate the selected revision against the current document schema.
- **RULE-VH07:** Where the current journal update and revision creation must succeed together, the backend MUST use a MongoDB transaction.
- **RULE-VH08:** Revision reconstruction MUST work from the nearest preceding full snapshot + subsequent deltas.
- **RULE-VH09:** If an older revision uses an earlier document schema, the migration layer MUST convert it for display WITHOUT modifying the immutable stored record.
- **RULE-VH10:** Revision metadata MUST include: Revision ID, Journal ID, Revision Number, Parent Revision ID, Author ID, Timestamp, Status, Schema Version, and Changed Blocks.

---

## 12. Rendering & Export Rules

- **RULE-RN01:** The Rendering Engine MUST consume the canonical document model, NOT raw MongoDB BSON objects. The backend converts stored representations first.
- **RULE-RN02:** For draft previews, the renderer uses the current journal document from `journals`. For final approved exports, the renderer MUST use the exact immutable revision referenced by the approval record.
- **RULE-RN03:** The system MUST NEVER generate a final approved PDF from an arbitrary newer draft. Approved Revision = Rendered Final Document = Downloaded Final Academic Output.
- **RULE-RN04:** Each block type MUST have its own renderer. The modular rendering strategy enables independent development of new block types.
- **RULE-RN05:** Mathematical expressions MUST preserve correct formatting during PDF generation.
- **RULE-RN06:** Long-running exports (PDF, DOCX) MUST be processed asynchronously via background workers (Celery), NOT blocking API requests.
- **RULE-RN07:** Generated export binary files MUST be stored in object storage. Only metadata (journal ID, revision ID, format, status, storage reference) goes in MongoDB.
- **RULE-RN08:** Export failures MUST return meaningful diagnostics, never silently generate corrupted documents.
- **RULE-RN09:** Institutional layout rules (margins, fonts, headers, footers) MUST be configurable, NOT hardcoded into student-authored content.

---

## 13. Auto-Save & Synchronization Rules

- **RULE-AS01:** Auto-save MUST operate in the background without interrupting typing. No manual Save button required.
- **RULE-AS02:** Only changed/dirty blocks should be synchronized (incremental sync), NOT the entire journal after every keystroke.
- **RULE-AS03:** Updates MUST use stable block IDs to target specific blocks.
- **RULE-AS04:** Optimistic concurrency or revision numbers MUST be used to prevent stale auto-save requests from silently overwriting newer changes.
- **RULE-AS05:** The client MUST track dirty blocks and send them through the synchronization API with a `clientRevision` number.
- **RULE-AS06:** If a revision conflict occurs (stale revision number), the backend MUST return a 409 Conflict response — never silently overwrite.
- **RULE-AS07:** Failed synchronization attempts MUST be safely retryable.
- **RULE-AS08:** The system MUST support local recovery mechanisms (e.g., localStorage/IndexedDB) for unsynchronized draft changes where technically feasible.

---

## 14. API Design Rules

- **RULE-API01:** All APIs MUST follow RESTful conventions.
- **RULE-API02:** All APIs MUST be versioned (e.g., `/api/v1/`). Versioning prevents breaking existing clients.
- **RULE-API03:** Every API response MUST use a consistent envelope format:
  - Success: `{ "success": true, "data": { ... } }`
  - Error: `{ "success": false, "error": { "code": "...", "message": "...", "details": null } }`
- **RULE-API04:** Error codes MUST be structured and predictable: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `JOURNAL_NOT_FOUND`, `INVALID_WORKFLOW_STATE`, `REVISION_CONFLICT`, `UPLOAD_FAILED`, `EXPORT_FAILED`.
- **RULE-API05:** Resources MUST be identified using unique IDs.
- **RULE-API06:** Incremental block updates MUST use: `PATCH /api/v1/journals/{journalId}/blocks/{blockId}` with `clientRevision` for conflict detection.
- **RULE-API07:** Submission validation MUST verify required metadata, document integrity, and current workflow state before changing status.

### Core API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/v1/journals | List journals |
| POST | /api/v1/journals | Create journal |
| GET | /api/v1/journals/{id} | Retrieve journal |
| PATCH | /api/v1/journals/{id} | Update journal |
| DELETE | /api/v1/journals/{id} | Delete journal |
| PATCH | /api/v1/journals/{id}/blocks/{blockId} | Update specific block |
| POST | /api/v1/journals/{id}/submit | Submit journal |
| POST | /api/v1/journals/{id}/comments | Add review comment |
| POST | /api/v1/journals/{id}/request-changes | Request changes |
| POST | /api/v1/journals/{id}/approve | Approve journal |
| POST | /api/v1/journals/{id}/exports | Generate PDF/DOCX (async) |

---

## 15. Security Rules

- **RULE-SEC01:** All traffic MUST use HTTPS/TLS in production.
- **RULE-SEC02:** Passwords MUST be hashed (bcrypt or equivalent). Never plaintext.
- **RULE-SEC03:** JWT tokens for authentication. HTTP-only, secure cookies.
- **RULE-SEC04:** Application secrets (MongoDB URI, JWT secret, API keys, storage credentials) MUST be stored in environment variables / secret stores, NEVER committed to Git.
- **RULE-SEC05:** MongoDB connections MUST use authentication, TLS in production, least-privilege database users, and network access restrictions.
- **RULE-SEC06:** MongoDB deployment MUST NOT expose unrestricted database ports to the public internet.
- **RULE-SEC07:** Rate limiting MUST be enforced on authentication and upload endpoints.
- **RULE-SEC08:** Upload validation MUST enforce supported file types and size limits.
- **RULE-SEC09:** Sensitive document content, passwords, access tokens, and secrets MUST NOT be written to logs.
- **RULE-SEC10:** Audit logs MUST be append-oriented and protected from unauthorized modification.
- **RULE-SEC11:** Nginx MUST set secure HTTP headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.).
- **RULE-SEC12:** CORS MUST be configured to allow only the frontend origin.

---

## 16. Testing Rules

- **RULE-TEST01:** Unit tests MUST cover service-layer business rules, permission checks, workflow state transitions, document validation, and error mapping.
- **RULE-TEST02:** Repository tests MUST verify MongoDB queries, atomic updates, pagination, index-dependent access, and ObjectId conversion. Use an isolated test database.
- **RULE-TEST03:** Integration tests MUST verify FastAPI routes with real service dependencies, MongoDB persistence, auth, submission workflows, and review workflows.
- **RULE-TEST04:** API contract tests MUST verify request validation, response schemas, HTTP status codes, and structured error formats.
- **RULE-TEST05:** End-to-end tests MUST cover critical user journeys: Register → Join Classroom → Create Journal → Auto-Save → Submit → Teacher Review → Request Changes → Resubmit → Approve → Generate PDF.
- **RULE-TEST06:** Rendering tests MUST verify mathematical equations, tables, images, page breaks, headers/footers, and institution templates.
- **RULE-TEST07:** Migration tests MUST verify older document schema versions can be upgraded without losing block IDs, mathematical semantics, comments, review anchors, or revision relationships.
- **RULE-TEST08:** Security tests MUST verify unauthorized access is rejected, students cannot access other students' journals, invalid tokens are rejected, and rate limits work.
- **RULE-TEST09:** Automated tests MUST run in CI before deployment.

---

## 17. Infrastructure & Deployment Rules

- **RULE-INF01:** The platform MUST be deployed using Docker containers (Docker Compose for development, container orchestration for production).
- **RULE-INF02:** Each service MUST run in its own container: Frontend, Backend, Redis, MongoDB, Celery Worker, Nginx.
- **RULE-INF03:** Nginx MUST serve as the public gateway (HTTPS termination, reverse proxy, load balancing, static assets, compression, security headers).
- **RULE-INF04:** For production, MongoDB MUST use a replica set or managed HA cluster for redundancy and failover.
- **RULE-INF05:** Background workers (Celery) MUST handle: PDF generation, DOCX generation, email delivery, notification dispatch, scheduled cleanup.
- **RULE-INF06:** Redis MUST serve as: API cache, session cache, Celery task broker, rate limiter.
- **RULE-INF07:** Long-running tasks MUST NEVER block API requests. They MUST be queued to background workers.
- **RULE-INF08:** Each service MUST be independently scalable. Scale backend during exams, workers during PDF generation, Redis during peak activity.
- **RULE-INF09:** A failure in one service MUST NOT stop the entire platform (fault isolation).

---

## 18. Configuration Rules

- **RULE-CFG01:** Application configuration MUST be separate from source code, loaded from environment variables or secret stores.
- **RULE-CFG02:** Development, testing, staging, and production MUST use separate configuration values and data stores.
- **RULE-CFG03:** Required configuration MUST be validated during application startup. Invalid deployments MUST fail early.
- **RULE-CFG04:** Production credentials MUST support secure rotation without requiring source-code changes.

### Required Configuration Categories

- Environment name
- Frontend URL, Backend URL
- MongoDB URI, MongoDB database name
- Redis URL
- Object-storage credentials
- JWT/authentication settings
- Email provider configuration
- PDF renderer settings
- Logging level
- CORS configuration
- Upload limits

---

## 19. Notification Rules

- **RULE-NOT01:** Notifications MUST be generated asynchronously via background workers.
- **RULE-NOT02:** Notification types: Assignment Published, Review Completed, Changes Requested, Journal Approved, Comment Added.
- **RULE-NOT03:** Both in-app notifications and email notifications MUST be supported.
- **RULE-NOT04:** Temporary email or notification failures MUST NOT cause journal content loss.

---

## 20. Media & File Upload Rules

- **RULE-MED01:** Images and attachments MUST be uploaded to object storage (S3-compatible / Cloudinary), NEVER stored in MongoDB.
- **RULE-MED02:** The upload flow: Student Upload → Backend Upload API → Object Storage → Secure URL → Stored inside Document Block as reference.
- **RULE-MED03:** Upload validation MUST enforce supported file formats and size restrictions.
- **RULE-MED04:** Profile pictures are optional and follow the same object-storage pattern.
- **RULE-MED05:** Generated exports (PDFs, DOCX files) MUST also be stored in object storage, with only metadata in MongoDB.

---

## 21. Migration Rules

- **RULE-MIG01:** Every structural data transformation MUST be represented by a version-controlled migration script.
- **RULE-MIG02:** Application deployments MUST tolerate older document shapes during staged migrations (backward compatibility).
- **RULE-MIG03:** Structured journal documents MUST contain an explicit `schemaVersion`.
- **RULE-MIG04:** Migration scripts MUST be idempotent — safe to rerun without transforming already-migrated documents twice.
- **RULE-MIG05:** Migrations MUST preserve journal content, stable block IDs, revision history, teacher feedback, approvals, and audit records.
- **RULE-MIG06:** Lazy migration (on document load) and batch migration (background script) are both valid strategies depending on the change scope.
- **RULE-MIG07:** Destructive transformations REQUIRE verified backup and recovery procedures before execution.
- **RULE-MIG08:** Sequential migrations: `v1 → v2 → v3 → v4`. No requirement to migrate directly from any version to the newest.
- **RULE-MIG09:** Seed scripts MUST be idempotent and MUST NOT contain production credentials.

### Migration Workflow

```
Migration Script in Source Control → Automated Tests → Staging Migration → Backup/Recovery Verification → Controlled Production Migration → Post-Migration Validation
```

---

## 22. Code Organization Rules

- **RULE-ORG01:** Frontend and backend MUST be separate codebases within the project.
- **RULE-ORG02:** Each backend directory represents a single architectural concern (see folder structure in Rule BE section).
- **RULE-ORG03:** Each repository owns persistence operations for one primary collection or closely related access pattern.
- **RULE-ORG04:** Each service class encapsulates business logic for one domain area.
- **RULE-ORG05:** Renderers MUST be modular — each block type has its own renderer. New block types get new renderers without modifying existing ones.

---

## 23. Naming Conventions

- **RULE-NC01:** MongoDB collections use `snake_case` (e.g., `classroom_memberships`, `journal_versions`, `audit_logs`).
- **RULE-NC02:** API endpoints use `kebab-case` (e.g., `/request-changes`).
- **RULE-NC03:** Python files, functions, and variables use `snake_case`.
- **RULE-NC04:** Python classes use `PascalCase`.
- **RULE-NC05:** TypeScript/JavaScript files use `camelCase` or `kebab-case` per Next.js conventions.
- **RULE-NC06:** TypeScript/JavaScript types and interfaces use `PascalCase`.
- **RULE-NC07:** Environment variables use `SCREAMING_SNAKE_CASE`.
- **RULE-NC08:** Block type identifiers use `lowercase` (e.g., `heading`, `paragraph`, `equation`, `table`, `image`, `observation`, `result`, `reference`, `code`, `divider`, `pagebreak`).

---

## 24. Error Handling Rules

- **RULE-ERR01:** Every API error MUST return a structured JSON response with `success: false` and an `error` object containing `code` and `message`.
- **RULE-ERR02:** Internal errors MUST NOT leak stack traces, database details, or internal paths to the client.
- **RULE-ERR03:** Errors MUST be logged server-side with structured fields (timestamp, level, service, requestId, event, relevant entity IDs).
- **RULE-ERR04:** Correlation IDs MUST follow operations across services (API → Background Task → Worker) for distributed tracing.
- **RULE-ERR05:** Background worker failures MUST be retryable with configurable retry policies and dead-letter/failure handling.

---

## Logging Rules

- **RULE-LOG01:** Application logs MUST use structured fields (JSON format), not unstructured text.
- **RULE-LOG02:** Access logs MUST record HTTP method, route, response status, response time, and correlation ID.
- **RULE-LOG03:** Audit logs MUST record security-sensitive and academically important operations (submissions, approvals, mark changes, restores, membership changes).
- **RULE-LOG04:** Background worker logs MUST record task ID, type, start/completion time, retry count, and failure reason.
- **RULE-LOG05:** Personally sensitive information MUST be minimized in logs.

---

## Monitoring Rules

- **RULE-MON01:** Monitoring MUST cover: API latency, error rate, throughput, MongoDB query latency, MongoDB connection usage, Redis health, queue depth, worker failures, PDF generation duration, object-storage failures, CPU/memory utilization.
- **RULE-MON02:** Alerts MUST focus on actionable conditions, not unnecessary noise.
- **RULE-MON03:** MongoDB indexes MUST be monitored for usage, size, and slow queries.

---

## Backup Rules

- **RULE-BAK01:** MongoDB MUST have automated scheduled backups with a defined retention policy.
- **RULE-BAK02:** Backups MUST be encrypted.
- **RULE-BAK03:** Restore processes MUST be tested. A backup is NOT reliable until restoration has been tested.
- **RULE-BAK04:** Binary media in object storage requires a separate backup/versioning policy.

---

**End of Project Rules**
