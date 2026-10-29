# ==========================================
# STAGE 1: Build the React Frontend SPA
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==========================================
# STAGE 2: Python Backend with Unified Serving
# ==========================================
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2 and pdf/document processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt psycopg2-binary email-validator

# Copy Backend application
COPY backend/ ./backend/

# Copy compiled frontend from Stage 1 into frontend/dist for unified serving
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy uploads folder
RUN mkdir -p /app/uploads

ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV FRONTEND_DIST=/app/frontend/dist

EXPOSE 8000

WORKDIR /app/backend

# Initialize DB on first run if needed, then run Uvicorn
CMD ["sh", "-c", "python init_db.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
