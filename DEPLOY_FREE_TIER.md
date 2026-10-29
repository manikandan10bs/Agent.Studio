# 🚀 Free-Tier Production Deployment Guide: Agent.Studio

This guide walks you through deploying **AGENT.STUDIO** completely for free across industry-standard cloud providers:
* **Frontend:** [Vercel](https://vercel.com) (Free Hobby Tier)
* **Backend:** [Render](https://render.com) (Free Web Service Tier)
* **Database & Document Storage:** [Supabase](https://supabase.com) (Free Tier: 500MB PostgreSQL + 1GB Storage)
* **LLM Gateways:** Google Gemini API, GroqCloud, OpenRouter, and Mistral AI (Free Tiers)

---

## 🏗️ Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │          Vercel (Frontend SPA)         │
                      │      https://<your-app>.vercel.app     │
                      └──────────────────┬─────────────────────┘
                                         │
                         HTTPS API Calls │ (CORS: allow_origin_regex)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │          Render (FastAPI Backend)      │
                      │   https://<your-backend>.onrender.com  │
                      └──────────┬──────────────────┬──────────┘
                                 │                  │
                PostgreSQL Pooler│                  │ S3-compatible REST
                (Vector & RAG)   │                  │ (Uploaded PDFs/DOCX)
                                 ▼                  ▼
                      ┌────────────────────────────────────────┐
                      │          Supabase Cloud                │
                      │  - PostgreSQL 16 (Users, Agents, RAG)  │
                      │  - Storage Bucket: 'agent-documents'   │
                      └────────────────────────────────────────┘
```

---

## 📋 Phase 1: Set Up Supabase (Database & Document Storage)

Supabase provides a persistent PostgreSQL database and cloud object storage so your agents, users, chat logs, and vector embeddings survive Render's free-tier restarts.

1. **Create Project:**
   * Go to [https://supabase.com](https://supabase.com) and sign in.
   * Click **New Project**.
   * Name: `agent-studio`
   * Set a strong database password (e.g. `AgentStudioSecure2026!`). Note this down.
   * Select a region closest to your Render deployment (e.g. `US East / North Virginia`).
   * Select the **Free Tier** ($0/month) and click **Create new project**.

2. **Get Database Connection String (`DATABASE_URL`):**
   * Go to **Project Settings** (gear icon) → **Database**.
   * Scroll down to **Connection string** → click the **URI** tab.
   * Switch the dropdown from *Direct* to **Transaction Pooler** (recommended for serverless/Render) or **Session Pooler**:
     ```text
     postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
     ```
   * Replace `[YOUR-PASSWORD]` with your actual database password. This is your `DATABASE_URL`.

3. **Get Supabase Storage Credentials (Optional, for persistent original files):**
   * Go to **Project Settings** → **API**.
   * Note down:
     * **Project URL** (e.g. `https://xxxx.supabase.co`) -> `SUPABASE_URL`
     * **service_role (secret) key** -> `SUPABASE_SERVICE_ROLE_KEY`
   * In the Supabase left sidebar, click **Storage** → **New bucket** → Name it `agent-documents` → Keep it private → Click **Save bucket**.

---

## 🖥️ Phase 2: Deploy Backend on Render

Render hosts your FastAPI backend with automatic health checks (`/api/health`) and port binding.

1. **Create Web Service:**
   * Go to [https://dashboard.render.com](https://dashboard.render.com).
   * Click **New +** → **Web Service**.
   * Choose **Build and deploy from a Git repository**.
   * Connect your GitHub account and select `manikandan10bs/Agent.Studio`.

2. **Configure Service Details:**
   * **Name:** `agent-studio-backend`
   * **Region:** Same as Supabase (e.g. `Oregon` or `Ohio`)
   * **Branch:** `main`
   * **Root Directory:** `backend`
   * **Runtime:** `Python 3`
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   * **Instance Type:** `Free` (0.1 CPU, 512 MB RAM)

3. **Configure Environment Variables on Render:**
   In the **Environment Variables** section, add:

   | Variable Key | Value Example / Description |
   |---|---|
   | `PYTHON_VERSION` | `3.11.9` |
   | `DATABASE_URL` | Your Supabase connection string (`postgresql://postgres.xxx:pass@aws-0-xx.pooler.supabase.com:6543/postgres`) |
   | `SECRET_KEY` | Generate a random 32+ character string for JWT tokens |
   | `ENCRYPTION_MASTER_KEY` | Generate a random 32+ character string for AES-256 API key encryption |
   | `DEFAULT_ADMIN_EMAIL` | `admin@agent.studio` (or your email) |
   | `DEFAULT_ADMIN_PASSWORD` | Strong password for your initial Super Admin login |
   | `GEMINI_API_KEY` | Your Google Gemini API key |
   | `GROQ_API_KEY` | Your Groq API key |
   | `OPENROUTER_API_KEY` | Your OpenRouter API key |
   | `MISTRAL_API_KEY` | Your Mistral API key |
   | `SUPABASE_URL` | Your Supabase Project URL (`https://xxxx.supabase.co`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase `service_role` secret key |
   | `SUPABASE_STORAGE_BUCKET` | `agent-documents` |

4. **Deploy:**
   * Click **Create Web Service**.
   * Render will install dependencies and start the app.
   * Once live, note your backend URL:
     `https://agent-studio-backend.onrender.com`
   * Verify by visiting: `https://agent-studio-backend.onrender.com/api/health` (should return `{"status":"healthy", ...}`).

---

## ⚡ Phase 3: Deploy Frontend on Vercel

Vercel hosts the React SPA with instant global CDN caching and automatic SPA fallback routing.

1. **Import Repository:**
   * Go to [https://vercel.com/new](https://vercel.com/new).
   * Connect your GitHub account and import `manikandan10bs/Agent.Studio`.

2. **Configure Project:**
   * **Framework Preset:** `Vite`
   * **Root Directory:** Click **Edit** and select `frontend`.
   * **Build Command:** `npm run build` (detected automatically)
   * **Output Directory:** `dist` (detected automatically)

3. **Add Environment Variable:**
   Expand **Environment Variables** and add:

   | Variable Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://agent-studio-backend.onrender.com` *(your Render backend URL)* |

4. **Deploy:**
   * Click **Deploy**.
   * Vercel will build and deploy the React application in ~45 seconds.
   * You will receive a URL such as `https://agent-studio.vercel.app`.

5. **Link Vercel to Render CORS (Final Touch):**
   * Copy your Vercel deployment URL (e.g. `https://agent-studio.vercel.app`).
   * Go back to Render Dashboard → `agent-studio-backend` → **Environment**.
   * Add/update:
     `FRONTEND_URL` = `https://agent-studio.vercel.app`
   * Render will automatically reload with the new CORS domain.

---

## 🧪 Phase 4: Final Verification Checklist

- [ ] **Health Check:** `https://your-backend.onrender.com/api/health` returns `HTTP 200` with `status: healthy`.
- [ ] **Admin Login:** Visit `https://your-app.vercel.app/login` and log in with your `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD`.
- [ ] **Provider Keys:** Navigate to `/admin?tab=providers` to verify that Gemini, Groq, OpenRouter, and Mistral indicate active connections.
- [ ] **Agent Creation:** In `/studio`, test the **Create an Agent** page. Verify that the identity fields and Advance Configuration card respond cleanly.
- [ ] **Document RAG:** Attach a document (PDF or TXT) to an agent. Verify chunk indexing completes and query the document in Live Preview. Check that citations appear with verified snippets.
- [ ] **Cold Start Awareness:** On Render's free tier, services spin down after 15 minutes of inactivity. When accessed again, the first request may take 30–50 seconds to wake up. Subsequent requests respond in milliseconds.
