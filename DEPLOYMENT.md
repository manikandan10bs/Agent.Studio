# Agent.Studio - Production Deployment Guide
## Firebase Hosting + Google Cloud Run + Cloud Firestore + Gemini API

This document provides complete, step-by-step instructions for deploying **Agent.Studio** to Google Cloud and Firebase using Windows PowerShell.

---

## 1. Architecture Overview

```
                      +---------------------------------------+
                      |           Firebase Hosting            |
                      |   (React 19 + Vite + Tailwind SPA)    |
                      +-------------------+-------------------+
                                          |
                +-------------------------+-------------------------+
                |                                                   |
                v                                                   v
   +--------------------------+                        +--------------------------+
   |  Firebase Authentication |                        |    Firebase Firestore    |
   |   - Email & Password     |                        | - users/{userId}         |
   |   - Google Sign-In       |                        | - users/{userId}/agents  |
   |   - Password Reset       |                        | - users/{userId}/execs   |
   +------------+-------------+                        | - public_agents          |
                | (ID Token)                           +------------+-------------+
                v                                                   ^
   +-------------------------------------------------------+        |
   |              Google Cloud Run Backend                 |        |
   |         (Containerized Python FastAPI)                |--------+
   |  - Token Verification (firebase-admin)                |
   |  - 14 System Tools (Web, Excel, PDF, CSV, RAG)        |
   |  - Non-blocking Multi-Turn Streaming Chat             |
   +---------------------------+---------------------------+
                               |
                               v
   +-------------------------------------------------------+
   |                   AI Integrations                     |
   | - Gemini 2.5 Flash / Pro (Function Calling + RAG)     |
   | - Google Cloud Secret Manager (Zero-leakage API Keys) |
   +-------------------------------------------------------+
```

---

## 2. Prerequisites & Tool Installation

Ensure you have the following installed on your Windows machine:
1. **Google Cloud SDK (`gcloud`)**: [Install gcloud CLI](https://cloud.google.com/sdk/docs/install)
2. **Firebase CLI (`firebase`)**: `npm install -g firebase-tools`
3. **Docker Desktop** (optional if using Cloud Build; recommended for local container testing)

Login to Google Cloud and Firebase from Windows PowerShell:
```powershell
gcloud auth login
gcloud auth application-default login
firebase login
```

---

## 3. Step-by-Step Deployment Instructions

### Step 1: Create or Select Your Google Cloud & Firebase Project
Choose a unique Project ID (e.g., `agent-studio-prod`):
```powershell
$PROJECT_ID = "your-firebase-project-id"
$REGION = "us-central1"

# Set default project for gcloud
gcloud config set project $PROJECT_ID
```

### Step 2: Enable Firebase Authentication
1. Go to the [Firebase Console](https://console.firebase.google.com/) -> Select your project.
2. Navigate to **Build** -> **Authentication** -> Click **Get Started**.
3. Under the **Sign-in method** tab:
   - Enable **Email/Password**.
   - Enable **Google** (configure Support Email).
4. Under **Settings** -> **Authorized domains**, ensure your Firebase hosting domains are listed:
   - `localhost`
   - `$PROJECT_ID.firebaseapp.com`
   - `$PROJECT_ID.web.app`

### Step 3: Create Cloud Firestore Database
1. In Firebase Console, go to **Build** -> **Firestore Database** -> Click **Create database**.
2. Select **Production mode** and choose location `us-central1` (or your nearest region).
3. Deploy Firestore security rules and indexes directly from the repository:
```powershell
firebase deploy --only firestore:rules,firestore:indexes --project $PROJECT_ID
```

### Step 4: Enable Required Google Cloud APIs
Run in PowerShell to activate Cloud Run, Cloud Build, Container Registry, and Secret Manager:
```powershell
gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    secretmanager.googleapis.com `
    firestore.googleapis.com `
    identitytoolkit.googleapis.com `
    --project $PROJECT_ID
```

### Step 5: Store Gemini API Key in Google Secret Manager
Never store API keys in plaintext or commit them to source control. Use Google Secret Manager:
```powershell
# Create Secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic" --project $PROJECT_ID

# Add Secret Version (enter your Gemini API key when prompted)
Write-Host "AIzaSy..." | gcloud secrets versions add GEMINI_API_KEY --data-file=- --project $PROJECT_ID
```

Grant Cloud Run's default service account permission to read secrets:
```powershell
$PROJECT_NUMBER = (gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding GEMINI_API_KEY `
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" `
    --role="roles/secretmanager.secretAccessor" `
    --project $PROJECT_ID
```

### Step 6: Build & Deploy Backend to Google Cloud Run
Deploy the backend using Google Cloud Build (no local Docker daemon required):

```powershell
cd backend

# Deploy to Cloud Run with cost-optimized settings: min-instances=0, 1 vCPU, 512MB RAM
gcloud run deploy agent-studio-backend `
    --source . `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --min-instances 0 `
    --max-instances 5 `
    --memory 512Mi `
    --cpu 1 `
    --timeout 300s `
    --set-env-vars "FIREBASE_PROJECT_ID=$PROJECT_ID,USE_FIRESTORE=true,CORS_ORIGINS=https://$PROJECT_ID.web.app,https://$PROJECT_ID.firebaseapp.com" `
    --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest" `
    --project $PROJECT_ID

cd ..
```
Note the **Service URL** output by Cloud Run (e.g., `https://agent-studio-backend-xxxxx-uc.a.run.app`).

### Step 7: Configure & Build Frontend
1. Retrieve your Web App config from Firebase Console:
   - Go to **Project Settings** -> **General** -> **Your apps** -> Click **Web (`</>`)**.
   - Copy the configuration keys into `frontend/.env.production`.

Create `frontend/.env.production`:
```env
VITE_API_BASE_URL=https://agent-studio-backend-xxxxx-uc.a.run.app/api
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-firebase-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-firebase-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

2. Build the production React frontend:
```powershell
npm --prefix frontend run build
```

### Step 8: Deploy Frontend to Firebase Hosting
Deploy static assets and URL rewrites:
```powershell
# Set Firebase active project
firebase use $PROJECT_ID

# Deploy Firebase Hosting
firebase deploy --only hosting --project $PROJECT_ID
```

---

## 4. Cost Optimization Details

| Component | Free Tier / Low-Cost Allocation | Settings in Agent.Studio |
| :--- | :--- | :--- |
| **Google Cloud Run** | 2 million requests/month free, 360,000 vCPU-seconds free | `--min-instances 0` (scales to zero when idle), `--memory 512Mi`, `--cpu 1`, `--max-instances 5` |
| **Cloud Firestore** | 1 GiB storage, 50,000 reads/day, 20,000 writes/day free | Document caching, single reads for agent execution, subcollection indexing |
| **Firebase Hosting** | 10 GB storage, 360 MB/day transfer free | Immutable caching headers (`Cache-Control: max-age=31536000`) for static JS/CSS |
| **Firebase Auth** | 50,000 monthly active users (MAU) free | ID token caching, client-side session persistence |
| **Secret Manager** | 6 active secret versions free | In-memory secret caching in `app.core.secrets` to prevent repetitive API calls |
| **Gemini API** | Free-tier rate limits on `gemini-2.5-flash` | Optimized system prompts, tool function declarations only when tools are active |

*Note on Billing:* Google Cloud requires a Billing Account to be linked to your project to enable Cloud Run and Secret Manager, but operations within the free-tier allowances incur **$0.00**.

---

## 5. Verification Checklist

1. [x] **Frontend Build**: `npm --prefix frontend run build` completes with 0 errors.
2. [x] **Backend Test Suite**: `pytest backend/tests/ -q` passes 27/27 tests.
3. [x] **Backend Health Check**: `GET /api/health` returns `200 OK` with `status: healthy`.
4. [x] **Firebase Auth**: Supports Email registration, Email login, Google Sign-In popup, and Password Reset.
5. [x] **Firestore Security**: `firestore.rules` enforces user isolation (`request.auth.uid == userId`) and public gallery read.
6. [x] **AI Agent Persistence**: Create, Draft Save, Publish, Quick Test, Edit, and Delete operations synced to Firestore.
7. [x] **Tools & Gemini Execution**: 14 tools (Web Search, Web Fetch, PDF, Excel, Word, CSV, Data Cleaning, Charts) available and callable by Gemini.
