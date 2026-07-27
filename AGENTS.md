# AGENTS.md — eJournal Project Agent Instructions

## 1. Purpose

This file defines how AI coding agents must work on the **eJournal — Journal Management & Review System**.

The repository contains comprehensive product, architecture, design, implementation, and engineering documentation.

The agent is expected to work autonomously by:

1. Understanding the current task.
2. Consulting the relevant project documentation.
3. Inspecting the existing implementation.
4. Loading relevant specialized skills when applicable.
5. Making safe and reversible engineering decisions autonomously.
6. Implementing the task.
7. Testing and validating the result.
8. Asking the user only when a genuinely unresolved decision requires explicit input.

Do not ask the user questions when the answer can reasonably be found or derived from:

* Project documentation
* Existing code
* Established project conventions
* Installed project skills
* Standard engineering practices consistent with this project's architecture

User input is the final fallback, not the default response to uncertainty.

---

# 2. Project Context

The complete project documentation is located in:

`./documents/`

Project-specific agent skills are located in:

`./.agents/skills/`

The project documentation defines **what this product is and how it must behave**.

Skills provide **specialized expertise for implementing and validating that product**.

Skills must never independently redefine product requirements, architecture, or the eJournal design system.

Do not rely only on the current user prompt.

Before implementing a feature, gather the relevant context from the repository.

---

# 3. Core Documentation

The following documents are the primary sources of truth.

## 3.1 Product Requirements

`./documents/PRD.md`

Defines:

* Product requirements
* Functional requirements
* Non-functional requirements
* User roles
* Product behavior
* Core features
* Expected system capabilities

Use this document to determine **WHAT the system must do**.

---

## 3.2 Project Rules

`./documents/RULES.md`

Defines mandatory engineering, product, security, data, and architectural constraints.

These rules are **NON-NEGOTIABLE**.

Any implementation that violates `RULES.md` is incorrect even if it appears to satisfy a feature requirement.

Always inspect applicable rules before implementing a feature.

---

## 3.3 Architecture

`./documents/ARCHITECTURE.md`

Defines the high-level technical architecture and relationships between system components.

Use this document to determine **HOW major parts of the system interact**.

---

## 3.4 Design Specification

`./documents/DESIGN.md`

Defines:

* Visual language
* Design tokens
* Typography
* Colors
* Spacing
* Layout
* Navigation
* Components
* Component behavior
* Interaction states
* Responsive behavior
* Accessibility expectations
* Motion principles
* Loading states
* Empty states
* Error states
* Success states

This is the primary source of truth for eJournal UI/UX.

Skills may improve implementation quality, but they must not silently replace or contradict `DESIGN.md`.

---

## 3.5 Implementation Roadmap

`./documents/PHASES.md`

Defines:

* Implementation phases
* Tasks
* Dependencies
* Deliverables
* Acceptance criteria

Development should follow this roadmap unless the user explicitly requests work outside the current phase.

---

# 4. Detailed Architecture Documentation

The `documents/` directory contains detailed subsystem architecture specifications.

These include areas such as:

* Project overview and system requirements
* User access and authentication
* Classroom and journal workflows
* Block-based document editor
* Mathematical writing system
* Smart mathematical recognition
* Teacher review and annotations
* Version history and approval
* Document rendering and export
* Data architecture and database design
* Backend architecture and APIs
* Infrastructure
* Deployment
* Security
* Technology stack
* Future roadmap

When working on a subsystem, discover and read its corresponding document.

Do not load every architecture document for every small task.

Use progressive context loading:

`Task → Relevant PHASES section → Relevant requirements → Relevant rules → Relevant architecture → Relevant design → Relevant skills`

Broaden context only when required.

---

# 5. Authority and Conflict Resolution

When implementation decisions conflict, use this authority order:

1. `RULES.md`
2. `PRD.md`
3. Relevant detailed architecture document
4. `ARCHITECTURE.md`
5. `DESIGN.md` for UI/UX decisions
6. `PHASES.md` for implementation order
7. Relevant specialized project skills
8. Existing implementation conventions
9. General engineering preference

This priority defines authority, not permission to ignore lower-level sources.

All relevant sources should be followed whenever they do not conflict.

If two documents appear to conflict:

1. Re-read the relevant sections.
2. Determine whether the conflict is real or contextual.
3. Apply the authority order.
4. Prefer the interpretation that preserves product requirements, architectural invariants, security, accessibility, and data integrity.
5. Record any meaningful assumption in the implementation summary.

Ask the user only when the conflict cannot safely be resolved and materially changes product behavior, architecture, security, cost, or data integrity.

---

# 6. Project Skills

Project-specific skills are stored under:

`./.agents/skills/`

Installed design and frontend quality resources include:

* Apple Design Skill
* Emil Kowalski Design Engineering skills
* Impeccable
* Playwright browser/UI testing skill

Skills should be activated according to task relevance.

**Do not load every skill for every task.**

Backend-only, database-only, infrastructure-only, and non-UI tasks generally do not require design skills.

---

# 7. Apple Design Skill

Location:

`./.agents/skills/apple-design-skill/`

Use the Apple Design Skill for:

* Visual hierarchy
* Information hierarchy
* Navigation
* Layout
* Component behavior
* Interaction patterns
* Accessibility
* Feedback
* Forms
* Dialogs
* Menus
* Content presentation
* Platform-quality UX decisions

When using it:

1. Read its `SKILL.md`.
2. Load only HIG references relevant to the current problem.
3. Apply principles to the web rather than blindly copying native Apple interfaces.
4. Respect `DESIGN.md`.

The Apple skill is a **design reference**, not the project's design authority.

Priority:

`DESIGN.md → Apple Design Skill`

Prefer:

* Clarity
* Deference to content
* Strong hierarchy
* Consistency
* Accessibility
* Predictability
* Minimal visual noise
* Responsive layouts
* Appropriate feedback
* Performance

Do not imitate macOS or iOS merely for appearance.

eJournal is a productivity-oriented responsive web application.

---

# 8. Emil Kowalski Design Engineering Skills

Location:

`./.agents/skills/Emil Kowalski — Design Engineering Skill/`

Available specialized skill areas include:

* `animation-vocabulary`
* `apple-design`
* `emil-design-eng`
* `find-animation-opportunities`
* `improve-animations`
* `pick-ui-library`
* `review-animations`

Use these skills primarily for **interaction quality and motion design**.

## Use Emil skills when working on:

* Micro-interactions
* Hover states
* Press states
* Menus
* Popovers
* Dropdowns
* Dialogs
* Sheets
* Tooltips
* Toasts
* Loading transitions
* Drag and drop
* Reordering
* Editor block interactions
* Page transitions
* State transitions
* Motion hierarchy
* Easing
* Timing
* Springs
* Gesture feedback
* Perceived responsiveness

### Skill routing

Use `emil-design-eng` as the primary general design-engineering reference.

Use `animation-vocabulary` when reasoning about or communicating animation behavior.

Use `find-animation-opportunities` when a meaningful interface is functionally complete and could benefit from purposeful motion.

Use `improve-animations` when existing motion feels weak, awkward, excessive, inconsistent, or unpolished.

Use `review-animations` when validating completed motion behavior.

Use `pick-ui-library` only when a UI-library decision is genuinely required and is not already determined by project documentation.

The standalone project Apple Design Skill and `DESIGN.md` take precedence over any overlapping Apple guidance inside this skill collection.

## Motion principles

Motion must improve:

* Comprehension
* Continuity
* Feedback
* Orientation
* Responsiveness

Do not add animation merely for decoration.

Prefer subtle motion.

Prefer performant properties such as:

* `transform`
* `opacity`

Avoid expensive layout-driven animation when an equivalent performant technique exists.

Always respect:

`prefers-reduced-motion`

The journal editor is productivity software.

Animation must never:

* Delay writing
* Distract from content
* Interfere with keyboard workflows
* Make common actions feel slower
* Introduce unnecessary visual movement

---

# 9. Impeccable

The cloned Impeccable repository is located at:

`./.agents/skills/impeccable/`

For agent-compatible Impeccable skill instructions, prefer the implementation located under:

`./.agents/skills/impeccable/.agents/skills/impeccable/`

This contains the relevant skill instructions, references, agents, scripts, detector infrastructure, and supporting resources.

Do not scan every duplicate harness-specific copy of Impeccable unless required.

Avoid loading redundant copies under `.claude`, `.cursor`, `.gemini`, `.github`, `.grok`, `.kiro`, `.opencode`, `.pi`, `.qoder`, `.rovodev`, `.trae`, `.vibe`, etc.

For this project, treat:

`./.agents/skills/impeccable/.agents/skills/impeccable/`

as the preferred Antigravity/agent-compatible Impeccable source.

## Use Impeccable for:

* Frontend design quality
* Design critique
* Visual hierarchy
* Typography
* Color and contrast
* Spatial design
* Responsive design
* Interaction design
* UX writing
* Accessibility review
* Design-system consistency
* UI hardening
* Visual polish
* Detecting generic AI-generated UI patterns
* Frontend optimization
* Final UI audits

## Impeccable should primarily operate as:

**Design-quality reviewer + refinement system**

It should not independently redefine eJournal.

Use it to answer:

> Is the implementation of our design actually high quality?

not:

> What completely different design should this product have?

If an Impeccable recommendation conflicts with `DESIGN.md`, follow `DESIGN.md` unless the recommendation identifies a genuine accessibility, usability, or technical defect.

In that situation, preserve project intent while fixing the defect.

---

# 10. Playwright UI/UX Testing Skill

The cloned Playwright skill repository is located at:

`./.agents/skills/playwright-skill/`

The usable skill implementation is located under:

`./.agents/skills/playwright-skill/skills/playwright-skill/`

Use this skill to validate the **actual running application**.

Source-code inspection alone is not sufficient for meaningful UI completion when browser testing is available.

## Use Playwright for:

* Page loading
* Navigation
* Forms
* Authentication flows
* Classroom flows
* Journal workflows
* Editor workflows
* Teacher review workflows
* Dialogs
* Menus
* Popovers
* Responsive layouts
* Mobile behavior
* Keyboard interactions
* Focus behavior
* Loading states
* Empty states
* Error states
* Success states
* Screenshots
* Visual inspection
* Overflow
* Broken layouts
* Interaction regressions
* Critical end-to-end user journeys

For major UI features, test the actual implementation at relevant viewport sizes.

At minimum consider:

* Mobile
* Tablet/intermediate responsive width
* Desktop

Do not assume a page is responsive because its CSS appears responsive.

Validate actual behavior whenever practical.

---

# 11. Skill Activation Rules

The agent should activate relevant skills automatically.

The user does not need to explicitly request skill usage.

Do NOT ask questions such as:

* "Should I use the Apple skill?"
* "Should I use Impeccable?"
* "Should I use Emil's skill?"
* "Should I test this with Playwright?"

Use the task context to decide.

Examples:

### Backend endpoint

Use:

`Documentation + Architecture + RULES`

No design skill required.

### Database schema

Use:

`PRD + Database Architecture + RULES`

No design skill required.

### Basic UI component

Use:

`DESIGN.md + Apple Design Skill when relevant`

### Major new page

Use:

`DESIGN.md + Apple Design + Impeccable`

Then:

`Implement → Browser Test → Fix`

### Complex interaction

Use:

`DESIGN.md + Apple Design + Emil Design Engineering`

Then:

`Implement → Playwright → Review`

### Motion-heavy interaction

Use:

`DESIGN.md + Emil Design Engineering`

Then:

`Implement → review-animations → Browser Test`

### Existing UI feels weak

Use:

`Impeccable critique/polish + relevant DESIGN.md`

Then fix and re-test.

### Responsive issue

Use:

`DESIGN.md + Impeccable responsive guidance + Playwright`

### Final major frontend milestone

Use:

`Playwright → Impeccable Audit → Emil Motion Review where applicable → Fix → Re-test`

---

# 12. Frontend Implementation Pipeline

For meaningful frontend work, follow this workflow.

## Stage 1 — Understand

Read:

* Current phase/task
* Relevant PRD requirements
* Applicable rules
* Relevant architecture
* Relevant DESIGN.md sections

Inspect existing implementation.

---

## Stage 2 — Design Reasoning

For significant UI:

Consult:

* Apple Design Skill
* Relevant Impeccable guidance

Determine:

* Information hierarchy
* Layout
* Component composition
* Interaction states
* Responsive behavior
* Accessibility behavior

Do not redesign something already explicitly defined in `DESIGN.md`.

---

## Stage 3 — Implement

Build according to:

* Project architecture
* `DESIGN.md`
* Existing design tokens
* Existing component conventions
* Approved project libraries

Prefer reusable design-system primitives over one-off styling.

Do not introduce a new UI library because a skill recommends one if the project stack already defines the library.

---

## Stage 4 — Motion

If meaningful motion exists:

Consult relevant Emil Design Engineering skills.

Determine:

* Whether animation is actually useful
* Duration
* Easing
* Direction
* Interruption behavior
* Reduced-motion behavior

Implement only purposeful motion.

---

## Stage 5 — Browser Validation

Run the relevant application.

Use Playwright where practical.

Validate:

* Rendering
* Navigation
* Interactions
* Responsive behavior
* Forms
* Keyboard behavior
* Focus behavior
* Loading/error/empty states
* Critical workflows

---

## Stage 6 — Design Critique

For significant pages or milestones, use Impeccable.

Check for:

* Weak hierarchy
* Generic AI appearance
* Poor typography
* Inconsistent spacing
* Excessive cards or containers
* Excessive rounded surfaces
* Unnecessary gradients
* Excessive shadows
* Accessibility problems
* Poor responsive behavior
* Interaction ambiguity
* Visual inconsistency
* Unnecessary complexity

---

## Stage 7 — Motion Review

If meaningful animations were introduced or changed, use the relevant Emil animation review skill.

Check:

* Purpose
* Timing
* Easing
* Consistency
* Interruptibility
* Reduced motion
* Performance

---

## Stage 8 — Fix

Fix legitimate findings.

Skills must not cause scope creep.

Do not add unrelated functionality during refinement.

---

## Stage 9 — Re-test

Re-run relevant browser tests after fixes.

A significant frontend task is not complete while known critical or high-impact UI/UX defects remain.

---

# 13. Autonomous Decision-Making

The agent should work autonomously whenever sufficient context exists.

When uncertainty appears:

## Step 1

Inspect the current codebase.

## Step 2

Search project documentation.

## Step 3

Check `RULES.md`.

## Step 4

Check relevant architecture.

## Step 5

For UI/UX questions, check `DESIGN.md`.

## Step 6

Load the relevant specialized skill if useful.

## Step 7

Make a reasonable engineering decision if the decision:

* Is reversible
* Follows project rules
* Follows architecture
* Does not alter core product behavior
* Does not introduce significant security risk
* Does not compromise data integrity
* Does not create meaningful new cost

Record important assumptions in the implementation summary.

---

# 14. When to Ask the User

Do NOT ask the user for:

* Information already in documentation
* Information available in existing code
* Minor implementation decisions
* Routine naming decisions
* Reversible engineering decisions
* Routine UI spacing
* Routine typography decisions covered by DESIGN.md
* Component choices already defined by the project
* Animation details that can be resolved through design guidance
* Standard responsive behavior
* Standard accessibility behavior
* Decisions safely inferable from architecture

Ask the user only when:

* Required product behavior is genuinely undefined
* Authoritative requirements directly conflict
* A major irreversible architectural decision is required
* A security-sensitive decision requires approval
* Required credentials or secrets are missing
* A paid external service must be selected
* A destructive operation requires confirmation
* A decision creates meaningful recurring cost
* Multiple valid choices would produce materially different product behavior and no project source resolves the choice

Before asking, verify that the answer cannot be found in:

1. Existing implementation
2. `RULES.md`
3. `PRD.md`
4. Relevant detailed architecture
5. `ARCHITECTURE.md`
6. `DESIGN.md`
7. `PHASES.md`
8. Relevant installed skills
9. Existing project conventions

Only then request user input.

---

# 15. Implementation Workflow

For every implementation task:

## Before Coding

1. Understand the requested task.
2. Identify the current phase.
3. Read the relevant `PHASES.md` section.
4. Read relevant PRD requirements.
5. Read applicable rules.
6. Read relevant architecture.
7. Read relevant design specification for UI work.
8. Load relevant specialized skills.
9. Inspect existing code.
10. Identify dependencies.
11. Identify acceptance criteria.

Do not begin implementation before gathering enough context to implement correctly.

---

## During Coding

* Implement only the requested task/current phase.
* Preserve working functionality.
* Follow documented architecture.
* Follow project rules.
* Maintain frontend/backend boundaries.
* Avoid unnecessary abstractions.
* Avoid speculative features.
* Avoid premature implementation of future phases.
* Reuse existing components.
* Reuse utilities.
* Maintain type safety.
* Validate data at boundaries.
* Handle errors explicitly.
* Follow security requirements.
* Keep modules focused.
* Keep UI accessible.
* Keep UI responsive.
* Keep interactions performant.

---

## After Coding

Before considering a task complete:

1. Run relevant automated tests.
2. Run linting.
3. Run type checking.
4. Verify build success.
5. Verify phase acceptance criteria.
6. Verify relevant PRD requirements.
7. Verify RULES compliance.
8. Verify architecture.
9. For UI work, verify DESIGN.md.
10. For meaningful UI work, perform browser validation.
11. For significant UI, perform design critique.
12. Review animations when applicable.
13. Fix discovered defects.
14. Re-run affected validation.

Provide a concise implementation summary containing:

* What was implemented
* Major files created or modified
* Tests/checks performed
* Browser/UI validation performed
* Acceptance criteria status
* Important technical decisions
* Assumptions
* Remaining work
* Blockers

---

# 16. Phase-Based Development

Development follows `PHASES.md`.

Do not attempt to build the complete application in one uncontrolled operation.

Use:

`Phase → Subphase → Task → Context → Implementation → Validation → Next Task`

Before beginning a new phase, verify required dependencies from earlier phases.

If development has not started and the user asks to begin, start from the first task of Phase 1.

If the user asks to continue without naming a phase, determine the first incomplete task from the roadmap and repository state.

Do not skip acceptance criteria.

---

# 17. Scope Control

Do not add functionality simply because:

* A skill suggests it
* A library supports it
* It looks impressive
* It is common in similar products

A feature must be justified by:

* PRD
* Architecture
* Current phase
* Explicit user instruction

Future roadmap features should remain future features unless required to prevent an architectural dead end.

Skills are quality tools, not feature generators.

---

# 18. Documentation Maintenance

Project documentation must remain authoritative.

Do not silently change product requirements.

Do not silently change architectural invariants.

Do not modify `RULES.md` merely to accommodate an implementation.

If implementation reveals a minor unspecified technical detail:

1. Make a safe decision.
2. Continue.
3. Record the assumption.

If implementation requires a major product or architectural change:

1. Stop that specific decision.
2. Explain the conflict.
3. Request user input.

Documentation should be updated when an approved implementation decision materially changes architecture, API contracts, or documented behavior.

---

# 19. Security

Security requirements are mandatory.

Never:

* Hardcode secrets
* Commit credentials
* Expose private environment variables to the client
* Store passwords in plaintext
* Bypass authentication for convenience
* Bypass authorization for convenience
* Allow direct browser access to MongoDB
* Trust unvalidated client input
* Disable security controls to make development easier
* Log secrets or sensitive credentials

Use environment variables.

Maintain `.env.example` where applicable.

Follow dedicated infrastructure/security documentation.

---

# 20. Performance

Performance is part of product quality.

For frontend work:

* Avoid unnecessary client-side JavaScript.
* Avoid unnecessary re-renders.
* Lazy-load heavy features where appropriate.
* Keep animations inexpensive.
* Avoid excessive blur and backdrop effects.
* Optimize large images and assets.
* Avoid loading large libraries for trivial functionality.
* Preserve editor responsiveness.
* Avoid blocking the main thread with expensive work.

For backend work:

* Avoid unnecessary database round trips.
* Use documented indexes.
* Keep synchronous request paths lightweight.
* Move expensive asynchronous work to documented background infrastructure where appropriate.

Do not prematurely optimize without evidence, but do not knowingly introduce obvious performance problems.

---

# 21. Accessibility

Accessibility is mandatory, not optional polish.

For UI work verify, where applicable:

* Semantic HTML
* Keyboard navigation
* Visible focus
* Logical focus order
* Appropriate labels
* Accessible form errors
* Dialog focus management
* Color contrast
* Touch target sizing
* Reduced-motion support
* Screen-reader semantics
* Non-color-only status indicators

Accessibility defects discovered during implementation or testing should be treated as product defects.

---

# 22. Definition of Done

A task is complete only when:

* Required functionality is implemented
* Acceptance criteria pass
* Project rules are respected
* Architecture is preserved
* Relevant automated tests pass
* Type checking passes
* Linting passes
* Build succeeds where applicable
* UI follows DESIGN.md where applicable
* Relevant browser validation passes
* Critical accessibility issues are resolved
* Significant design defects identified during review are resolved
* Motion is reviewed when applicable
* No known critical regression remains

Incomplete work must be explicitly identified.

---

# 23. Final UI Quality Gate

Before declaring a **major page, workflow, frontend phase, or the complete frontend** finished:

1. Run the application.
2. Exercise the actual workflow with Playwright where practical.
3. Validate desktop behavior.
4. Validate intermediate responsive behavior.
5. Validate mobile behavior.
6. Validate keyboard interaction.
7. Validate loading, empty, error, and success states.
8. Check accessibility.
9. Run an Impeccable critique/audit.
10. Review meaningful animations using Emil guidance.
11. Compare implementation against `DESIGN.md`.
12. Fix critical and high-impact findings.
13. Re-test affected workflows.

Do not declare UI complete solely because:

* It compiles
* It matches a screenshot
* Components render
* Unit tests pass

UI completion requires actual interaction validation.

---

# 24. Core Operating Principle

The project documentation exists so the agent can work independently.

The skills exist so the agent can apply specialized expertise without requiring repeated user instructions.

When uncertain, follow:

**Inspect → Search Documentation → Check Rules → Check Architecture → Check Design → Load Relevant Skill → Decide → Implement → Test → Critique → Fix → Re-test**

Do not immediately ask the user.

Do not activate every skill unnecessarily.

Do not allow a skill to override the project.

Do not consider code complete merely because it was generated successfully.

The default behavior is:

**Autonomous, documentation-driven, skill-assisted, test-validated implementation.**

User input is the final fallback when the available project context genuinely cannot resolve a required decision.
