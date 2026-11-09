# CLAUDE.md — eJournal Frontend Guidelines

@AGENTS.md

## Core Commands
- **Install packages**: `bun install` or `bun add <package>` (NEVER use npm/yarn)
- **Start dev server**: `bun run dev` (Runs on http://localhost:3000 with Turbopack)
- **Build production**: `bun run build`
- **Typecheck**: `node node_modules/typescript/bin/tsc --noEmit --project tsconfig.json`
- **Lint**: `bun run lint`

## Architecture & Code Conventions
- **Next.js 16 + React 19**: App Router with Server & Client components. Use `"use client";` directive explicitly when using React hooks.
- **Rules of Hooks**: Always declare hooks at the top level of component functions. Never place hooks after conditional returns (`if (!isOpen) return null;`) or inside loops.
- **Styling**: Tailwind CSS v4. Stick to design system tokens (`bg-background`, `bg-card`, `bg-primary`, `text-foreground`, `border-border`). Do not introduce arbitrary text color overrides that ruin contrast in dark/light mode.
- **Data Fetching**: Use `@tanstack/react-query` v5 with the API wrapper from `@/lib/api`. Always guard array parsing (`Array.isArray(data) ? data : data?.items || []`).
- **Dates**: Always format in Indian Standard Time (IST) via `formatDateIST` / `formatDateTimeIST` in `@/lib/date`.

## Critical Workflow Rule
- **Explain first, await approval**: When the user asks a question, wants an explanation, or asks why an error occurred, explain the root cause first and wait for approval before modifying any code.
