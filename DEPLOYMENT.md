# AGENT.STUDIO Deployment Guide 🚀

This document covers all options for deploying **AGENT.STUDIO** into production:
1. **Local & On-Premise Production Server** (Windows / Linux / macOS)
2. **Containerized Deployment** (Docker & Docker Compose)
3. **Cloud PaaS Deployment** (Render, Railway, Fly.io)
4. **Publishing & Deploying Individual AI Agents** (Creator & Public Gallery workflow)

---

## 1. Local & On-Premise Production Server

AGENT.STUDIO includes a **single-port unified production architecture**. The FastAPI backend automatically serves the compiled React SPA (`frontend/dist`) alongside all `/api` endpoints on `http://localhost:8000`.

### Windows 1-Click Launch:
Simply run the included script:
```bat
start_production.bat
```
*(Or in PowerShell: `.\start_production.ps1`)*

This script:
1. Verifies/compiles the React frontend build with Vite.
2. Validates the Python environment and database.
3. Launches Uvicorn on `http://localhost:8000`.

### Linux / macOS Manual Launch:
```bash
# 1. Build Frontend
cd frontend
npm install
npm run build
cd ..

# 2. Start Backend & Unified Server
cd backend
python -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
python init_db.py
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 2. Docker Container Deployment

A multi-stage production [`Dockerfile`](./Dockerfile) builds the frontend with Node 20 and bundles the backend with Python 3.11 in a secure, lightweight container.

### Build and Run with Docker Compose:
```bash
docker compose up --build -d
```

### Build and Run Standalone Container:
```bash
# Build image
docker build -t agent-studio:latest .

# Run container
docker run -d \
  -p 8000:8000 \
  -v $(pwd)/uploads:/app/uploads \
  -e SECRET_KEY="your-production-secret-jwt-key" \
  -e ENCRYPTION_MASTER_KEY="your-32-char-encryption-key" \
  --name agent_studio \
  agent-studio:latest
```

---

## 3. Cloud Platform Deployment (PaaS)

### A. Render (Recommended Free/Starter)
1. Push this repository to GitHub/GitLab.
2. In Render Dashboard, click **New +** → **Blueprint**.
3. Select your repository. Render automatically reads [`render.yaml`](./render.yaml).
4. The service will build via Dockerfile and launch on a secure `https://<your-app>.onrender.com` URL.

### B. Railway
1. Click **New Project** → **Deploy from GitHub repo**.
2. Railway detects [`railway.json`](./railway.json) and [`Dockerfile`](./Dockerfile).
3. Set environment variables (`SECRET_KEY`, `ENCRYPTION_MASTER_KEY`).
4. Click **Deploy**.

### C. Fly.io
```bash
fly launch
fly deploy
```

---

## 4. In-App Agent Deployment Workflow (Publishing)

Once AGENT.STUDIO is running, creators and admins can deploy individual AI agents live:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Agent Studio   │ ───>  │  Test in Live   │ ───>  │  Click "Publish"│
│  (Configure)    │       │     Preview     │       │     Button      │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                                             │
                                                             ▼
                                                    ┌─────────────────┐
                                                    │  Live in Public │
                                                    │     Gallery     │
                                                    │   (/explore)    │
                                                    └─────────────────┘
                                                             │
                                                             ▼
                                                    ┌─────────────────┐
                                                    │ Standalone URL  │
                                                    │  (/chat/:slug)  │
                                                    │ + Embed Iframe  │
                                                    └─────────────────┘
```

1. **Configure Agent**: Set Agent Name, Description, Model Client, and upload Knowledge Base documents (PDF/TXT/DOCX).
2. **Test**: Ask questions in the right-hand **Live Preview** pane to verify document grounding and persona accuracy.
3. **Publish**: Click the **Publish** button in the top action bar or Runtime tab.
4. **Share & Embed**:
   - Direct standalone chat link: `https://<your-domain>/chat/<agent-slug>`
   - Embeddable widget: Click **Share** to copy the responsive HTML iframe:
     ```html
     <iframe
       src="https://<your-domain>/chat/<agent-slug>"
       width="100%"
       height="600"
       frameborder="0"
     ></iframe>
     ```

---

## 5. Security & Provider Credentials

- **Admin Only**: Model API keys (Google Gemini, Groq, OpenRouter, Mistral) are managed strictly by Platform Administrators in `/admin?tab=providers`.
- **Zero Raw Key Exposure**: Raw API keys are encrypted at rest with AES-256-GCM and never sent to client browsers.
- **Creator Simplicity**: Creators configure agents simply by picking an approved model from the dropdown.
