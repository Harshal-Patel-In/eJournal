<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# eJournal Frontend — AI Coding Agent Instructions

## 1. Project Overview & Tech Stack
The eJournal frontend is a high-performance, responsive academic web application built with:
- **Framework**: Next.js 16.2.10 (App Router, Turbopack)
- **UI Library**: React 19.2.4
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`), Radix UI primitives (`@radix-ui/react-slot`)
- **State & Data Fetching**: TanStack React Query v5 (`@tanstack/react-query`), Zustand v5
- **Document Editor & Lab Math**: KaTeX v0.18, CodeMirror (`@uiw/react-codemirror`), `@hello-pangea/dnd`
- **Client Archiving**: JSZip v3.10.2 (In-browser streaming ZIP compilation)
- **Package Manager**: **`bun`** (ALWAYS use `bun` for all package management and frontend execution; NEVER use `npm`, `npx`, or `yarn`)

---

## 2. Mandatory Behavioral Rules for Agents

### Rule 1: Explain First, Await Approval Before Modifying Files
- When the user asks a question, requests an explanation, or asks "why is this happening":
  - **DO NOT MODIFY CODE IMMEDIATELY.**
  - Provide a clear, honest, and technically precise explanation first.
  - Await the user's explicit confirmation or directive before touching any file.

### Rule 2: Strict Rules of Hooks (React 19)
- NEVER invoke hooks (`useContext`, `useRef`, `useState`, `useQuery`, `useMutation`, etc.) conditionally, inside loops, or after conditional early returns (`if (!isOpen) return null;`).
- Always declare all hooks at the top level of the component function before any return statements.

### Rule 3: Zero TypeScript Errors Invariant
- Before completing any frontend task, verify type safety:
  ```powershell
  node node_modules/typescript/bin/tsc --noEmit --project tsconfig.json
  ```
- The codebase must pass with **0 type errors**.

---

## 3. UI/UX & Design System Constraints

The primary design specification is documented in [`documents/DESIGN.md`](../documents/DESIGN.md).

### Colors & Contrast
- Respect semantic design tokens:
  - `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-destructive`
  - `text-foreground`, `text-muted-foreground`, `text-primary-foreground`
  - `border-border`, `border-input`, `ring-ring`
- **Never hardcode arbitrary text colors** (e.g. `text-blue-600` or `#2563eb`) on dark buttons or backgrounds that collapse contrast in light or dark modes.
- Buttons must follow standard variant classes (`default`, `outline`, `secondary`, `destructive`, `ghost`). Avoid ad-hoc compound color overrides that break standard Shadcn/Tailwind design tokens.

### Modals & Drawers
- Overlay modals must use `fixed inset-0 z-50 bg-black/70 backdrop-blur-sm`.
- Containers must use `bg-card text-foreground border border-border shadow-2xl rounded-3xl`.
- Close buttons must be accessible with `type="button"` and `cursor-pointer`.

---

## 4. API & Data Handling Conventions

### API Client (`src/lib/api.ts`)
- Use the central `api` wrapper:
  ```typescript
  import { api } from "@/lib/api";
  const data = await api.get<T>("/endpoint");
  ```
- `api.get`, `api.post`, `api.patch`, `api.delete` automatically unpack the backend's standard envelope (`{ success: true, data: ... }`) and throw typed `ApiRequestError` on failures.

### Array Parsing & Defense
- Backend endpoints may return raw arrays or wrapped object responses. Always guard array access:
  ```typescript
  const items = Array.isArray(data) ? data : data?.items || [];
  ```

### Date Formatting
- All dates must be formatted in Indian Standard Time (IST, UTC+5:30) using:
  ```typescript
  import { formatDateIST, formatDateTimeIST } from "@/lib/date";
  ```

---

## 5. Directory Structure & Organization

```
frontend/src/
├── app/                  # Next.js App Router pages and layouts
│   ├── (auth)/           # Authentication pages (login, register, forgot-password)
│   ├── admin/            # Institutional Admin Portal (classrooms, students, integrity, announcements)
│   ├── classroom/        # Teacher/Student course cockpit
│   ├── editor/           # Visual Block-based Document Editor & Lab Math Canvas
│   ├── layout.tsx        # Root layout (Theme provider, QueryClient, Global Announcement banner)
│   └── globals.css       # Global design tokens and utilities
├── components/
│   ├── admin/            # Admin-specific modals (portfolio ZIP export, bulk import, comparison drawer)
│   ├── ui/               # Radix / shadcn atomic primitives (Button, Dialog, Select, Dropdown)
│   ├── notification-bell.tsx # Real-time notification bell (WebSocket-connected)
│   └── announcement-banner.tsx # Global campus announcement broadcast (SSE listener)
└── lib/
    ├── api.ts            # Core API request client with JWT cookie and envelope handling
    ├── date.ts           # IST timezone formatting utilities
    ├── toast.ts          # Centralized toast notification system
    └── utils.ts          # Tailwind cn helper
```

---

## 6. Real-Time Connections & Lifecycle Hygiene
- **Server-Sent Events (SSE)**: When listening to `/announcements/stream`, always ensure `eventSource.close()` is called in the `useEffect` cleanup return.
- **WebSockets**: When opening `/notifications/ws`, always disconnect on component unmount to prevent lingering TCP connections.
- **Client-Side ZIP Generation**: Use `JSZip` to compile evaluation sheets and HTML journals entirely in browser memory (`URL.createObjectURL(zipBlob)`), avoiding server CPU/disk timeouts.
