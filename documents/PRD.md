# Product Requirements Document (PRD)
## Journal Management & Review System
### A Modern Block-Based Academic Document Platform

**Version:** 1.0  
**Status:** Complete  
**Architecture Style:** Block-Based Academic Document Platform

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Vision](#2-vision)
3. [Objectives](#3-objectives)
4. [Target Users & Actors](#4-target-users--actors)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Core Design Philosophy](#7-core-design-philosophy)
8. [Assumptions & Constraints](#8-assumptions--constraints)
9. [Use Case Architecture](#9-use-case-architecture)
10. [Document Block Types](#10-document-block-types)
11. [Mathematical Writing System Requirements](#11-mathematical-writing-system-requirements)
12. [Review & Annotation Requirements](#12-review--annotation-requirements)
13. [Version History & Approval Requirements](#13-version-history--approval-requirements)
14. [Rendering & Export Requirements](#14-rendering--export-requirements)
15. [Technology Stack](#15-technology-stack)
16. [Third-Party Libraries](#16-third-party-libraries)
17. [Glossary](#17-glossary)

---

## 1. Project Overview

The Journal Management & Review System is a modern academic platform that digitizes the complete lifecycle of practical journals — from creation to submission, review, approval, and archival.

Traditional journal systems usually rely on plain text editors, uploaded Word documents, or PDF files. These approaches create several problems:

- Students repeatedly format documents manually.
- Mathematical equations are difficult to write.
- Teachers cannot annotate individual sections precisely.
- Version history is unavailable.
- Exported PDFs often differ from what students see while editing.
- Rich academic content such as tables, equations, diagrams, and figures becomes difficult to manage.

This system solves these problems by treating every journal as a **structured document composed of independent blocks** instead of one large text document.

Each paragraph, heading, equation, image, table, observation, and result becomes its own document component.

This approach enables:

- Professional document editing
- Intelligent mathematical writing
- Reliable auto-save
- Block-level commenting
- Version history
- Identical rendering across Web, PDF, DOCX, and Print
- Future collaborative editing

The result is an academic writing experience comparable to modern document editors while remaining simple enough for students who have never used LaTeX or professional publishing software.

---

## 2. Vision

The vision of this project is to replace traditional handwritten practical journals and basic rich-text editors with a professional academic document platform that enables students to create high-quality journals through an intuitive visual interface.

Instead of asking students to learn document formatting or LaTeX syntax, the system should provide intelligent tools that allow them to focus entirely on the academic content.

At the same time, teachers should receive a structured review environment where every section of the document can be reviewed, commented on, and evaluated independently.

The long-term vision extends beyond practical journals. The underlying document architecture should support additional academic document types such as:

- Laboratory Reports
- Assignments
- Research Papers
- Mini Projects
- Capstone Reports
- Thesis Documents
- Technical Documentation
- Academic Portfolios

Rather than building a journal editor, this project builds a **reusable academic document platform** where journals are simply one document type.

---

## 3. Objectives

### 3.1 Student Objectives

- Create journals using an intuitive visual editor.
- Write mathematical expressions without learning LaTeX.
- Insert tables, diagrams, images, code blocks, and scientific content easily.
- Save work automatically.
- Recover drafts after accidental browser closure.
- Generate university-ready PDF documents.
- Submit journals digitally.
- Track review progress.

### 3.2 Teacher Objectives

- Publish practical assignments.
- Review journals directly inside the browser.
- Annotate specific document blocks.
- Add remarks.
- Assign marks.
- Approve submissions.
- Export reports and gradebooks.

### 3.3 System Objectives

- Reduce manual paperwork.
- Eliminate repetitive formatting.
- Maintain document consistency.
- Support structured academic writing.
- Produce identical rendering across multiple export formats.
- Enable future collaborative editing.
- Maintain complete revision history.
- Scale efficiently for large educational institutions.

---

## 4. Target Users & Actors

### 4.1 Primary Actors

| Actor | Description |
|-------|-------------|
| **Student** | Creates, edits, submits, and downloads journals |
| **Teacher** | Creates classrooms, publishes practicals, reviews and approves journals |

### 4.2 Future Actors

- Administrator
- Department Coordinator
- External Examiner
- Lab Assistant

### 4.3 External Systems

| System | Purpose |
|--------|---------|
| Email / OTP Service | Sends OTPs and workflow notifications |
| Cloud Media Storage (Cloudinary / S3-compatible) | Uploads and retrieves media assets |
| Document Export Services | Generates PDF, DOCX, and print-ready output |

---

## 5. Functional Requirements

The functional requirements define the capabilities that the Journal Management & Review System must provide to students, teachers, and the platform itself. The requirements are intentionally written independently of a specific UI implementation so that the architecture can evolve without changing the expected system behavior.

### 5.1 Authentication & Profile Requirements

- **FR-01:** The system shall allow students and teachers to register using a valid email address.
- **FR-02:** The system shall verify newly registered email addresses using OTP verification.
- **FR-03:** The system shall allow verified users to authenticate securely.
- **FR-04:** The system shall maintain authenticated sessions securely.
- **FR-05:** The system shall enforce role-based access control for students and teachers.
- **FR-06:** The system shall require users to complete mandatory academic profile information before accessing protected academic features.
- **FR-07:** Student profile information shall support automatic generation of journal metadata and cover-page information.
- **FR-08:** Teacher profile information shall be associated with classrooms, practicals, reviews, and approvals.

#### Required Student Profile Fields

- Full Name
- Enrollment Number
- Department
- Semester
- Division
- College
- University
- Profile Picture (Optional)

#### Required Teacher Profile Fields

- Full Name
- Faculty ID
- Department
- Designation
- College
- University
- Profile Picture (Optional)

### 5.2 Classroom & Practical Requirements

- **FR-09:** Teachers shall be able to create and manage classrooms.
- **FR-10:** The system shall generate a unique join code for each classroom (e.g., `CS401-7F2A`).
- **FR-11:** Students shall be able to join classrooms using valid join codes.
- **FR-12:** The system shall prevent invalid or unauthorized classroom enrollment.
- **FR-13:** Teachers shall be able to publish practical assignments to classrooms.
- **FR-14:** A practical assignment shall support a practical number, title, aim, instructions, deadline, maximum marks, references, and additional notes.
- **FR-15:** Students shall be able to view practical assignments published to classrooms in which they are enrolled.
- **FR-16:** The system shall associate every student journal with its student, classroom, teacher, and practical assignment.

#### Classroom Entity Data

- Subject Information
- Department
- Semester
- Teacher Information
- Student Roster (via membership collection)
- Practical Assignments
- Submission Progress
- Review Progress
- Marks
- Notifications

### 5.3 Journal Creation & Visual Editor Requirements

- **FR-17:** Students shall be able to create a journal from a published practical assignment.
- **FR-18:** The system shall automatically generate journal cover information using verified student, classroom, subject, teacher, and practical metadata.
- **FR-19:** Students shall be able to create documents using a visual block-based editor.
- **FR-20:** Students shall be able to insert new document blocks.
- **FR-21:** Students shall be able to edit, duplicate, delete, and rearrange document blocks.
- **FR-22:** Students shall be able to drag and drop blocks to change document order.
- **FR-23:** The editor shall support headings and section titles.
- **FR-24:** The editor shall support rich-text paragraphs and text highlighting.
- **FR-25:** The editor shall support ordered and unordered lists.
- **FR-26:** The editor shall support tables with configurable rows and columns.
- **FR-27:** The editor shall support image upload, captions, alignment, and resizing.
- **FR-28:** The editor shall support mathematical equations and calculations.
- **FR-29:** The editor shall support code blocks for programming practicals.
- **FR-30:** The editor shall support observation, result, reference, divider, and page-break blocks.
- **FR-31:** Where required by a practical template, the editor architecture shall support structured interactive components such as selectable options or radio-button-style inputs without coupling them to the final static PDF representation.
- **FR-32:** The editor shall provide a live representation of the structured journal while the student is writing.

#### Editor Components

| Component | Responsibility |
|-----------|---------------|
| Toolbar | Formatting operations |
| Slash Menu | Insert new blocks (type `/` to open) |
| Block Renderer | Display blocks |
| Block Editor | Edit block content |
| Drag Engine | Rearranging blocks |
| Preview Renderer | Live preview |
| Auto Save Manager | Incremental synchronization |
| Version Manager | Create revisions |
| Comment Layer | Teacher annotations |

### 5.4 Mathematical Writing Requirements

- **FR-33:** Students shall be able to write mathematical calculations and formulas without requiring knowledge of LaTeX.
- **FR-34:** The system shall provide a visual equation builder.
- **FR-35:** The mathematical editor shall provide common formula templates such as fractions, roots, powers, subscripts, integrals, summations, limits, matrices, vectors, and piecewise expressions.
- **FR-36:** The mathematical editor shall provide a scientific symbol library (α, β, γ, δ, θ, π, μ, σ, Ω, ∞, ±, ×, ÷, ≈, ≠, ≤, ≥, √, ∫, ∑, ∂, ∇, °, →, ←, ⇌).
- **FR-37:** The mathematical editor shall support inline mathematics inside paragraphs.
- **FR-38:** The mathematical editor shall support standalone display equations.
- **FR-39:** The system should support assisted mathematical input and recognition for common expressions (Smart Mathematical Recognition Engine).
- **FR-40:** The system shall internally preserve a standardized mathematical representation (LaTeX + MathML) suitable for deterministic rendering.
- **FR-41:** Students shall not be required to directly edit internal LaTeX syntax.
- **FR-42:** Mathematical expressions shall preserve their structure during editing, review, versioning, preview, and export.

#### Formula Templates

| Template | Purpose |
|----------|---------|
| Fraction | a/b |
| Root | √x |
| Power | x² |
| Subscript | xᵢ |
| Integral | ∫ |
| Sigma | Σ |
| Matrix | Matrix Notation |
| Limit | lim |
| Vector | Vector Notation |
| Piecewise | Conditional Functions |
| Determinant | Matrix Determinant |

#### Smart Recognition Examples

| Student Types | System Produces |
|---------------|----------------|
| `sqrt(x)` | √x |
| `x^2` | x² |
| `x_1` | x₁ |
| `1/2` | ½ or Fraction template |
| `sum` | Σ |
| `int` | ∫ |
| `pi` | π |
| `theta` | θ |
| `alpha` | α |
| `<=` | ≤ |

### 5.5 Structured Document Storage Requirements

- **FR-43:** Journal content shall be stored as structured block-based JSON rather than as one large HTML string.
- **FR-44:** Every document block shall have a stable unique identifier.
- **FR-45:** Every document block shall store its block type, content, position, and required metadata.
- **FR-46:** The document model shall separate content from presentation-specific rendering logic.
- **FR-47:** The document model shall support future block types without requiring a complete document-schema redesign.
- **FR-48:** Media blocks shall store references to externally stored binary assets instead of embedding large binary data directly in the structured document.

#### Example Journal JSON Structure

```json
{
  "schemaVersion": 1,
  "journalId": "journal_123",
  "classroomId": "classroom_123",
  "assignmentId": "assignment_123",
  "studentId": "student_123",
  "status": "draft",
  "blockOrder": ["block_001", "block_002"],
  "blocks": [
    {
      "id": "block_001",
      "type": "heading",
      "content": { "text": "Experiment" },
      "metadata": { "createdAt": "2026-07-19T10:00:00Z" }
    },
    {
      "id": "block_002",
      "type": "paragraph",
      "content": { "text": "Objective of the experiment" },
      "metadata": { "createdAt": "2026-07-19T10:01:00Z" }
    }
  ]
}
```

#### Equation Block JSON Example

```json
{
  "id": "block_eq_001",
  "type": "equation",
  "displayMode": true,
  "data": {
    "latex": "\\frac{a+b}{\\sqrt{x}}",
    "mathml": "<math>...</math>"
  },
  "metadata": {
    "createdAt": "2026-07-19T10:00:00Z",
    "updatedAt": "2026-07-19T10:05:00Z"
  }
}
```

### 5.6 Auto-Save, Recovery & Version Requirements

- **FR-49:** The editor shall automatically save student work while the document is being edited.
- **FR-50:** Auto-save shall operate without requiring students to manually press a Save button after every change.
- **FR-51:** The system shall support incremental synchronization of modified document blocks.
- **FR-52:** The system shall provide a visible save or synchronization status.
- **FR-53:** The system shall support local recovery mechanisms for unsynchronized draft changes where technically feasible.
- **FR-54:** The system shall maintain document revision history.
- **FR-55:** Revisions shall record relevant metadata including author, timestamp, and modified content.
- **FR-56:** Authorized users shall be able to inspect previous revisions.
- **FR-57:** The system shall support comparison between relevant document revisions.
- **FR-58:** Restoring an older revision shall create a new revision rather than deleting or rewriting existing history.

#### Revision Creation Triggers

- Student explicitly creates a checkpoint.
- A defined inactivity interval is reached.
- The journal is submitted.
- The student resubmits after requested changes.
- A restore operation occurs.
- A significant grouped edit threshold is reached.

#### Hybrid Snapshot + Delta Strategy

- Full snapshots are created at: initial creation, submission, approval, every N revisions, migration boundaries.
- Intermediate revisions store changed blocks or operations (deltas).
- This balances storage efficiency with reliable reconstruction performance.

### 5.7 Submission, Review & Approval Requirements

- **FR-59:** Students shall be able to preview a journal before submission.
- **FR-60:** Students shall be able to submit completed journals digitally.
- **FR-61:** Submitted journals shall become read-only unless changes are requested or the journal is reopened through the defined workflow.
- **FR-62:** Teachers shall be able to view journals submitted to their classrooms.
- **FR-63:** Teachers shall be able to review submitted journals inside the browser.
- **FR-64:** Teachers shall be able to attach comments to specific document blocks.
- **FR-65:** Teachers shall be able to highlight or annotate relevant content without directly overwriting the student's original work.
- **FR-66:** Teachers shall be able to create suggestions and request corrections.
- **FR-67:** Teachers shall be able to approve journals.
- **FR-68:** Teachers shall be able to assign marks and final remarks.
- **FR-69:** Students shall be able to view teacher feedback.
- **FR-70:** Students shall be able to revise journals when changes are requested.
- **FR-71:** Review and approval actions shall remain traceable through the journal lifecycle.

#### Review Annotation Types

| Annotation | Purpose |
|------------|---------|
| Comment | General feedback |
| Suggestion | Proposed improvement |
| Highlight | Draw attention to content |
| Warning | Indicates an issue |
| Approval | Marks content as correct |
| Question | Requests clarification |

#### Review Status Indicators per Block

| Status | Meaning |
|--------|---------|
| Pending | Awaiting review |
| Reviewed | Teacher has examined the block |
| Changes Requested | Student must revise |
| Approved | No further changes required |
| Resolved | Feedback addressed |

#### Approval States (Journal-Level)

| Status | Description |
|--------|-------------|
| Draft | Student is editing |
| Submitted | Awaiting review |
| Under Review | Teacher reviewing |
| Changes Requested | Student must revise |
| Resubmitted | Updated after corrections |
| Approved | Final acceptance |
| Archived | Completed journal |

### 5.8 Rendering & Export Requirements

- **FR-72:** The system shall render structured journal documents for web preview.
- **FR-73:** The system shall generate professionally formatted PDF documents.
- **FR-74:** Mathematical expressions shall preserve correct formatting during PDF generation.
- **FR-75:** Tables, images, headings, captions, page breaks, headers, footers, and academic formatting shall be preserved during export.
- **FR-76:** The PDF output shall follow configured academic or institutional formatting rules.
- **FR-77:** The rendering architecture shall support DOCX output.
- **FR-78:** The rendering architecture shall support print-oriented output.
- **FR-79:** Exported output should remain visually consistent with the approved document preview.
- **FR-80:** The rendering system shall consume the same structured document model used by the editor rather than relying on separately maintained document content.

#### Rendering Pipeline Stages

1. **Document Validation** — Missing metadata, invalid blocks, broken references, missing images, invalid equations
2. **Layout Engine** — Margins, font sizes, page orientation, line spacing, section spacing, header/footer positions
3. **Block Rendering** — Each block type has its own renderer
4. **Page Composition** — Page breaks, margin handling, overflow detection, header/footer placement, page numbering
5. **Export Rendering** — Final output generation (PDF, DOCX, Print)

#### Approved Revision Export Integrity

Final academic exports must be revision-specific. The system must never generate a final approved PDF from an arbitrary newer draft. The approved revision equals the rendered final document equals the downloaded final academic output.

### 5.9 Notification & Reporting Requirements

- **FR-81:** The system shall notify relevant users when important workflow events occur.
- **FR-82:** Students shall be notified when teachers add review feedback or request changes.
- **FR-83:** Students shall be notified when a journal is approved or marks are published.
- **FR-84:** Teachers shall be notified of relevant new submissions.
- **FR-85:** Teachers shall be able to view submission and review progress for their classrooms.
- **FR-86:** Teachers shall be able to export marks, gradebooks, or academic reports where applicable.

#### Notification Types

- Assignment published
- Review completed
- Changes requested
- Journal approved
- Comment added

---

## 6. Non-Functional Requirements

### 6.1 Usability

- The editor should be usable by students who have no knowledge of LaTeX, HTML, or professional publishing software.
- Common document operations should be discoverable through visual controls, toolbars, menus, slash commands, or keyboard shortcuts.
- Mathematical writing should prioritize visual interaction and natural input.
- Drag-and-drop reordering should provide immediate visual feedback.
- Save, synchronization, submission, review, and approval states should be clearly visible.
- The platform should minimize repetitive academic formatting work.

### 6.2 Performance

- Normal editor interactions should provide near-immediate visual feedback.
- Auto-save operations should execute in the background without interrupting typing.
- Frequently accessed document and classroom data should be retrieved efficiently through appropriate indexing and caching.
- Only changed document content should be synchronized when incremental updates are possible.
- Long-running operations such as complex PDF generation should execute outside the normal interactive request path where appropriate.

### 6.3 Reliability & Data Integrity

- Student work should be protected against accidental browser closure through local recovery and server-side synchronization strategies.
- Failed synchronization attempts should be safely retryable.
- Submitted and approved document states must not be silently overwritten.
- Revision history should preserve recoverable document states.
- Restoring an older revision must not destroy existing history.
- Critical workflow operations should be auditable.

### 6.4 Security

- Authentication credentials and sensitive information must be transmitted over HTTPS.
- Passwords must never be stored in plaintext.
- Protected resources must enforce authentication and role-based authorization.
- Students must not be able to modify another student's journal.
- Teachers must only access classrooms and submissions for which they have authorization.
- Application secrets must be stored through environment-based configuration rather than committed to source control.
- Uploaded content must be validated according to supported file type and size policies.

### 6.5 Scalability

- Stateless application services should support horizontal scaling.
- Structured document storage should support incremental block updates.
- Binary media should remain separated from primary structured application data.
- Background processing should be scalable independently from interactive application services.
- The architecture should support future institutional growth without redesigning the document model.

### 6.6 Maintainability

- Editing, storage, review, versioning, rendering, and export concerns should remain separated.
- New document block types should be addable without redesigning the entire document schema.
- New export targets should be implementable through dedicated renderer adapters.
- Business logic should remain independent of presentation components.
- Internal document representation should remain independent of one specific visual editor library.

### 6.7 Compatibility

- The web application should support current versions of major modern browsers.
- Exported PDF documents should render consistently across common PDF readers and operating systems.
- The document model should remain independent of a single browser rendering engine where possible.
- Mathematical content should use standardized internal representations suitable for multiple output targets.

### 6.8 Accessibility

- Interactive controls should support keyboard navigation where practical.
- Form fields and editor controls should expose accessible labels.
- Color should not be the only mechanism used to communicate review or workflow status.
- Important editor actions should have understandable textual labels or accessible descriptions.

### 6.9 Availability & Recovery

- The system should degrade gracefully when non-critical services are temporarily unavailable.
- Temporary media, email, or notification failures should not cause journal content loss.
- Database and media backup strategies should support disaster recovery.
- Background operations should support retry mechanisms where appropriate.

### 6.10 Rendering Consistency

- The same structured document model should drive editor preview and export rendering.
- Mathematical expressions must preserve semantic structure across supported output formats.
- Institutional layout rules should be configurable rather than hardcoded into student-authored content.
- Export failures should return meaningful diagnostics rather than silently generating corrupted documents.

---

## 7. Core Design Philosophy

> **A journal is not plain text. A journal is a structured academic document.**

This philosophy changes the architecture of the entire application. Instead of storing documents as large HTML strings or fixed database fields, every document is composed of independent reusable blocks.

Each block knows:
- what it represents
- how it should be edited
- how it should be rendered
- how it should be exported
- how it should be reviewed

---

## 8. Assumptions & Constraints

### 8.1 Assumptions

- Users have access to a modern web browser.
- Users have internet access for server synchronization, classroom operations, submission, review, and server-side exports.
- Students and teachers have valid email addresses for account verification.
- Teachers are responsible for publishing accurate practical assignment information.
- Student academic profile information is verified or entered accurately enough to generate document metadata.
- Institution-specific journal formatting rules can be represented through configurable templates and rendering rules.
- Uploaded images and media use supported file formats and comply with configured size restrictions.
- The initial system primarily targets structured academic journals and practical reports.

### 8.2 Constraints

- Initial deployment may operate within free-tier or low-cost cloud service limits.
- Large binary assets must not be stored directly inside the primary structured database.
- Mathematical input must remain simple enough for students who do not know LaTeX.
- PDF generation must preserve academic formatting and mathematical notation.
- Submitted documents must maintain revision and review integrity.
- Teacher review must not directly and silently overwrite student-authored content.
- Real-time multi-user collaboration is considered a future capability and is not required for the initial release.
- Offline editing may initially be limited to local draft recovery and later expanded into full synchronization.
- Final implementation technologies may evolve, but the structured document model and separation of editing, storage, review, and rendering must remain architectural invariants.

---

## 9. Use Case Architecture

### 9.1 Use Case Access Matrix

| Use Case | Student | Teacher |
|----------|:-------:|:-------:|
| Register & Verify Account | ✓ | ✓ |
| Complete Profile | ✓ | ✓ |
| Join Classroom | ✓ | — |
| Create Classroom | — | ✓ |
| View Practical Assignments | ✓ | ✓ |
| Publish Practical Assignment | — | ✓ |
| Create & Edit Journal | ✓ | — |
| Write Mathematical Content | ✓ | — |
| Preview Journal | ✓ | ✓ |
| Export Own Journal | ✓ | — |
| Submit Journal | ✓ | — |
| Review Journal | — | ✓ |
| Add Block-Level Comments | — | ✓ |
| Request Changes | — | ✓ |
| Revise After Changes Requested | ✓ | — |
| Approve Journal | — | ✓ |
| Assign Marks | — | ✓ |
| View Feedback & Marks | ✓ | ✓ |
| Export Classroom Reports | — | ✓ |

### 9.2 Student Capabilities

Students **can**:
- Register an account, verify email using OTP, complete profile
- Join classrooms, view practical assignments
- Create journals, edit draft journals
- Insert mathematical equations, tables, upload diagrams
- Generate PDF, generate DOCX
- Submit journals, track submission status
- Read teacher comments, view obtained marks

Students **cannot**:
- Modify submitted journals (without workflow reopening)
- Publish practicals
- Review journals
- Access teacher dashboards
- Export classroom reports

### 9.3 Teacher Capabilities

Teachers **can**:
- Register account, complete profile
- Create classrooms, generate classroom codes
- Publish practical assignments
- View student submissions, review journals
- Add remarks, comment on individual document blocks
- Assign marks, approve journals
- Export gradebooks, generate reports

Teachers **cannot**:
- Edit student journal content directly
- Submit journals as students

Teachers interact through the **Review System**, preserving document integrity.

### 9.4 Student Document Lifecycle

```
Draft → Editing → AutoSave → Editing → Preview → Submitted → UnderReview → Approved → Archived
                                                                    ↓
                                                            Rejected → Editing (revision cycle)
```

---

## 10. Document Block Types

The first version of the editor supports the following block types:

| Block | Purpose |
|-------|---------|
| Heading | Section Titles |
| Paragraph | Rich Text |
| Equation | Mathematical Expressions (display mode) |
| Inline Equation | Mathematical expressions inside paragraphs |
| Table | Experimental Data |
| Image | Diagrams (with captions, alignment, resizing) |
| Observation | Experimental Observations |
| Result | Results |
| Reference | Citations |
| Code | Programming Practical |
| Divider | Section Separator |
| Page Break | PDF Formatting |

The architecture allows unlimited future block types. Adding a new block type generally does not require a traditional database schema migration. Developers register a new renderer and editor component for the new block type.

Every inserted block immediately receives:
- Unique ID
- Block Type
- Position
- Metadata
- Creation Timestamp

---

## 11. Mathematical Writing System Requirements

### 11.1 Design Principles

1. **Zero LaTeX Knowledge Required** — Students should never be forced to learn LaTeX syntax.
2. **Visual Before Syntax** — Every equation is created visually; the editor converts visual representation into LaTeX internally.
3. **Identical Rendering Everywhere** — The equation displayed inside the editor must look exactly the same in Web Editor, Print Preview, PDF, and DOCX.
4. **Fast Academic Writing** — Students should spend time solving problems rather than searching for symbols.

### 11.2 Mathematical Editor Components

| Component | Responsibility |
|-----------|---------------|
| Equation Toolbar | Quick access to operations |
| Scientific Keyboard | Frequently used symbols |
| Formula Templates | Common mathematical patterns |
| Equation Canvas | Visual equation workspace |
| Symbol Search | Find symbols by name |
| Autocomplete | Smart input assistance |
| LaTeX Generator | Internal representation |
| Equation Renderer | Display using KaTeX |

### 11.3 Smart Recognition Engine

The platform introduces a Smart Mathematical Recognition Engine that continuously analyzes text being typed and intelligently converts recognizable mathematical expressions into properly formatted mathematical notation. This allows students to write naturally while the system performs automatic formatting in the background.

### 11.4 Inline vs Display Equations

- **Inline Equations**: Behave like characters inside a paragraph while maintaining mathematical formatting.
- **Display Equations**: Independent standalone blocks that can be moved, commented, reviewed, versioned, and exported independently.

---

## 12. Review & Annotation Requirements

### 12.1 Review Principles

1. **Contextual Feedback** — Feedback is attached to the exact content it refers to (specific blocks).
2. **Non-Destructive Review** — Teachers never modify the student's original work; they provide suggestions, comments, highlights, and approval status.
3. **Traceable Revisions** — Every review and revision remains available in document history.
4. **Faster Iteration** — Students immediately know what changed, where it changed, who requested the change, and whether the issue has been resolved.

### 12.2 Block-Level Review

Every document block can be reviewed independently. Because each block has its own unique identifier, comments remain attached even if blocks are reordered.

### 12.3 Threaded Discussions

Comments support replies, enabling conversations between students and teachers. Each discussion remains associated with its corresponding document block.

### 12.4 Suggestion Workflow

Suggestions allow teachers to recommend changes rather than directly editing content:
- Accepting a suggestion triggers a normal student-authorized document update.
- Rejecting a suggestion changes the suggestion state but does not modify the journal content.

---

## 13. Version History & Approval Requirements

### 13.1 Version Management Principles

1. **Never Lose Work** — Every saved revision should remain recoverable.
2. **Immutable History** — Previous versions should never be modified after they are created.
3. **Incremental Storage** — Only the changed blocks should be stored instead of duplicating the entire journal.
4. **Complete Audit Trail** — Every revision records: Author, Timestamp, Modified Blocks, Review Status, Approval State.
5. **Safe Recovery** — Students should be able to restore earlier versions without risking data loss.

### 13.2 Approval Workflow

- Approval is always associated with a specific immutable revision.
- After approval, any workflow that permits further editing must create a newer revision and require a new approval state rather than silently carrying forward the previous approval.
- Approval records are stored independently in MongoDB and reference both the journal ID and approved revision ID.

### 13.3 Audit Trail Events

| Event | Recorded |
|-------|----------|
| Journal Created | ✓ |
| Revision Saved | ✓ |
| Submitted | ✓ |
| Teacher Review | ✓ |
| Comment Added | ✓ |
| Suggestion Added | ✓ |
| Approval | ✓ |
| Restore | ✓ |
| Archive | ✓ |

---

## 14. Rendering & Export Requirements

### 14.1 Rendering Principles

1. **Single Source of Truth** — The same structured document model drives editor preview and export rendering.
2. **Consistent Output** — Every exported document remains visually identical across Web, PDF, DOCX, and Print.
3. **Reusable Components** — Every renderer reuses common rendering logic whenever possible.
4. **Extensible Architecture** — New export formats should be added without modifying existing rendering logic.

### 14.2 Asset Resolution

- MongoDB stores structured document content and references.
- Object storage contains binary assets (uploaded images, diagrams, generated PDF files, generated DOCX files).
- The renderer resolves asset references securely before composing the final output.

### 14.3 Export Metadata Tracking

An export record may track:
- Journal ID
- Revision ID
- Export format
- Generation status
- Object-storage reference
- Created timestamp
- Expiration or retention metadata

---

## 15. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | Web Application |
| Language (Frontend) | TypeScript | Type-safe Development |
| Styling | Tailwind CSS | UI Styling |
| UI Components | shadcn/ui | Accessible Components |
| Rich Text | Lexical / BlockNote | Block-based Document Editor |
| State Management | Zustand | Client State |
| Backend | FastAPI | REST API |
| Language (Backend) | Python | Backend Services |
| Validation | Pydantic | Request & Response Validation |
| Database Driver | PyMongo (Async API) | MongoDB Connectivity & Data Access |
| Data Modeling | Pydantic | Application & Document Validation |
| Data Migration | Versioned Python Migration Scripts | MongoDB Data & Document Schema Evolution |
| Database | MongoDB | Primary Document Database |
| Cache | Redis | Caching & Task Broker |
| Background Jobs | Celery | Asynchronous Tasks |
| File Storage | S3-Compatible Storage / Cloudinary | Images & PDFs |
| Authentication | JWT | User Authentication |
| PDF Rendering | ReportLab / WeasyPrint | Document Export |
| Mathematics | KaTeX | Equation Rendering |
| Containerization | Docker | Deployment |
| Reverse Proxy | Nginx | Traffic Management |
| Version Control | Git | Source Control |

---

## 16. Third-Party Libraries

| Library | Purpose |
|---------|---------|
| Lexical / BlockNote | Rich Block Editor |
| KaTeX | Mathematical Rendering |
| React Hook Form | Form Handling |
| Zod | Frontend Validation |
| TanStack Query | Server State |
| React DnD / dnd-kit | Drag & Drop |
| ReportLab / WeasyPrint | PDF Generation |
| Pillow | Image Processing |
| Celery | Background Jobs |
| PyMongo | MongoDB Driver & Data Access |

---

## 17. Glossary

| Term | Meaning |
|------|---------|
| **Block** | The smallest independently addressable unit of journal content, such as a paragraph, equation, table, or image. |
| **Block-Based Document** | A document represented as an ordered collection of structured content blocks rather than one large HTML string. |
| **BSON** | MongoDB's binary document representation used to store JSON-like structured data. |
| **Journal** | A student's structured academic practical or laboratory document. |
| **Practical Assignment** | A teacher-published academic task from which a student creates a journal. |
| **Document Model** | The canonical structured representation of a journal used for editing, storage, review, versioning, and rendering. |
| **schemaVersion** | A version identifier stored with structured documents to support controlled document-format evolution. |
| **Revision** | A recoverable historical state or change representation of a journal. |
| **Immutable Version** | A historical journal version that is not modified after creation. |
| **Auto-Save** | Background persistence of student changes without requiring repeated manual save actions. |
| **Incremental Synchronization** | Sending only changed document content or blocks instead of replacing the complete journal after every edit. |
| **Optimistic Concurrency** | A conflict-prevention strategy that verifies revision state before accepting an update. |
| **Review Anchor** | A stable reference connecting teacher feedback to a specific block or content location. |
| **Rendering Engine** | The subsystem that converts the canonical document model into Web Preview, PDF, DOCX, or Print output. |
| **Visual Equation Builder** | A mathematical authoring interface that allows students to construct equations without directly writing LaTeX. |
| **KaTeX** | A mathematical typesetting library used to render mathematical notation. |
| **MongoDB** | The primary document database used to store structured application and journal data. |
| **Collection** | A MongoDB grouping of related documents, conceptually similar to a data container for one domain entity. |
| **ObjectId** | A MongoDB identifier type that may be used internally for document identifiers. |
| **Replica Set** | A MongoDB deployment configuration that maintains multiple data-bearing nodes for redundancy and automatic failover. |
| **PyMongo** | The official MongoDB Python driver used by the backend data-access layer. |
| **Pydantic** | The Python validation and data-modeling library used to define application-level schemas. |
| **Repository Layer** | The backend layer that isolates database queries and persistence operations from business services. |
| **Object Storage** | External storage used for binary assets such as images and generated files. |
| **Redis** | In-memory infrastructure used for caching, rate limiting, and background task brokering. |
| **Celery** | Background task processing system used for asynchronous operations such as document generation and notifications. |
| **C4 Model** | A hierarchical software architecture visualization approach covering system context, containers, components, and optionally code. |
| **RBAC** | Role-Based Access Control used to restrict operations according to user roles and permissions. |
| **Audit Log** | An append-oriented record of important security, review, approval, and academic workflow events. |

---

**End of Product Requirements Document**
