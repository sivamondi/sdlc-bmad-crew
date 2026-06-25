# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY crew-app/frontend/package*.json ./
RUN npm ci
COPY crew-app/frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + built frontend ──────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# System deps (for uvicorn standard extras)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY crew-app/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Backend source
COPY crew-app/backend/ ./crew-app/backend/

# BMAD skills (agents + skills directories)
COPY .claude/ ./.claude/

# Copy built frontend into the path FastAPI serves from
COPY --from=frontend-build /app/frontend/dist ./crew-app/frontend/dist

# Anthropic API key — pass at runtime via -e or docker-compose env
ENV ANTHROPIC_API_KEY=""
ENV PORT=8000

EXPOSE 8000

WORKDIR /app/crew-app/backend
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
