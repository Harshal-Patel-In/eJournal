# eJournal — Journal Management & Review System

An academic document platform for creating, reviewing, and managing structured scientific journals using a block-based visual editor with intelligent mathematical writing capabilities.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python, Pydantic |
| Database | MongoDB Atlas |
| Cache | Redis |
| State | Zustand (client), TanStack Query (server) |
| Editor | Lexical / BlockNote |
| Math | KaTeX |
| Infrastructure | Docker, Nginx, Bun, uv |

## Project Structure

```
├── frontend/          # Next.js application
├── backend/           # FastAPI application
├── nginx/             # Reverse proxy configuration
├── docker-compose.yml # Service orchestration
├── documents/         # Project documentation
└── .env.example       # Required environment variables
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (frontend runtime)
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Docker](https://www.docker.com/) & Docker Compose
- MongoDB Atlas account (free tier)

### Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your MongoDB Atlas URI and other secrets
3. Start all services:
   ```bash
   docker-compose up
   ```
4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000/api/v1/health

### Local Development (without Docker)

**Frontend:**
```bash
cd frontend
bun install
bun dev
```

**Backend:**
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

## Documentation

All project documentation is in the `documents/` directory:

- `PRD.md` — Product requirements
- `RULES.md` — Engineering constraints
- `ARCHITECTURE.md` — System architecture
- `DESIGN.md` — UI/UX design system
- `PHASES.md` — Implementation roadmap
