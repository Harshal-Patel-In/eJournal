FROM python:3.12-slim-bookworm

# Copy uv binary from official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy lock and project files
COPY pyproject.toml uv.lock ./

# Install dependencies using uv sync (frozen configuration)
RUN uv sync --frozen --no-cache

# Copy the rest of the application code
COPY . .

# Expose backend port
EXPOSE 8000

# Set environment
ENV ENVIRONMENT=development
ENV PYTHONUNBUFFERED=1

# Start the application with hot-reloading enabled
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
