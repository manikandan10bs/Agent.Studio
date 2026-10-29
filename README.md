# AGENT.STUDIO — Enterprise AI Agent Builder Platform

![AGENT.STUDIO](https://img.shields.io/badge/Platform-AGENT.STUDIO-00F0FF?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

**AGENT.STUDIO** is a full-stack, enterprise-grade AI Agent Builder platform inspired by premium dark SaaS design aesthetics. It features a three-column dashboard layout, multi-provider LLM gateway (Google Gemini, GroqCloud, OpenRouter, Mistral AI), vector document Retrieval-Augmented Generation (RAG), live chatbot preview with streaming, cryptographic secret management, versioned publishing workflows, and server-side role-based access control.

---

## 1. System Architecture

```
AGENT.STUDIO/
├── backend/
│   ├── app/
│   │   ├── api/                  # REST API v1 endpoints
│   │   │   ├── deps.py           # JWT security, role authorization & audit trail
│   │   │   └── v1/
│   │   │       ├── auth.py       # Login, logout, invitation acceptance
│   │   │       ├── models.py     # Approved model catalog
│   │   │       ├── agents.py     # Agent CRUD, versioning, publish/unpublish
│   │   │       ├── knowledge.py  # Document uploads (PDF, TXT, DOCX) & indexing
│   │   │       ├── chat.py       # Live preview chat & SSE streaming
│   │   │       ├── public.py     # Public gallery & unauthenticated chat
│   │   │       └── admin.py      # Provider credentials, model toggles, audit logs
│   │   ├── core/
│   │   │   ├── config.py         # Pydantic BaseSettings & env configs
│   │   │   └── security.py       # AES-256-GCM encryption, PBKDF2 hashing, JWT
│   │   ├── db/
│   │   │   ├── session.py        # SQLAlchemy engine & session factory
│   │   │   └── init_db.py        # Seed default admin, providers & models
│   │   ├── models/               # SQLAlchemy ORM models
│   │   │   ├── user.py           # User, UserInvitation, UserQuota
│   │   │   ├── provider.py       # Provider, ProviderCredential, Model
│   │   │   ├── agent.py          # Agent, AgentVersion, AgentKnowledgeBase
│   │   │   ├── knowledge.py      # KnowledgeBase, Document, DocumentChunk
│   │   │   ├── chat.py           # Conversation, Message
│   │   │   └── usage.py          # UsageEvent, AuditLog
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   └── services/
│   │       ├── llm/              # Unified multi-provider LLM gateway
│   │       │   ├── base.py       # Abstract BaseLLMAdapter interface
│   │       │   ├── factory.py    # Adapter resolver & credential decryptor
│   │       │   ├── gemini_adapter.py      # Google Gemini API
│   │       │   ├── groq_adapter.py        # GroqCloud
│   │       │   ├── openrouter_adapter.py  # OpenRouter
│   │       │   └── mistral_adapter.py     # Mistral AI
│   │       ├── rag/              # Document Ingestion & Vector Retrieval
│   │       │   ├── extractor.py  # PDF, DOCX, TXT page-aware parser
│   │       │   ├── chunker.py    # Overlapping semantic chunker
│   │       │   ├── embedding.py  # Normalized 384-dim semantic embedder
│   │       │   ├── retriever.py  # Cosine vector similarity search
│   │       │   └── rag_service.py# Context augmentation & prompt grounding
│   │       └── chat_service.py   # Turn execution, SSE streaming & telemetry
│   ├── alembic/                  # Database migration scripts
│   ├── tests/                    # Pytest backend test suite (11 passed)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/common/    # Logo, Toggle, Modal, PromptBuilderModal, ShareModal
│   │   ├── features/
│   │   │   ├── auth/             # LoginPage, AcceptInvitationPage, AuthContext
│   │   │   ├── agents/           # AgentForm (Identity, Instructions, Capabilities, Knowledge)
│   │   │   ├── chat/             # LivePreviewChat (SSE streaming, Markdown, Citations)
│   │   │   ├── admin/            # AdminDashboard (Metrics, Keys, Models, Users, Audit)
│   │   │   └── gallery/          # ExploreGallery & PublicChat
│   │   ├── layouts/              # StudioLayout (3-column SaaS dashboard)
│   │   ├── pages/                # StudioPage
│   │   ├── services/api.ts       # Typed REST API client
│   │   └── types/index.ts        # TypeScript data definitions
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 2. Quick Start: Windows PowerShell

### Prerequisites
- Python 3.10+ (Verified on Python 3.14)
- Node.js 18+ (Verified on Node.js v25)
- Git (optional)

### Step 1: Install & Set Up Backend

Open PowerShell in the workspace root (`c:\Manikandan_N\Agent.Studio`):

```powershell
# 1. Create and activate Python virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# 2. Install backend dependencies
pip install -r backend/requirements.txt email-validator

# 3. Copy example environment
Copy-Item .env.example .env
```

### Step 2: Install & Build Frontend

```powershell
# 1. Navigate to frontend directory
cd frontend

# 2. Install npm packages
npm install

# 3. Build frontend bundle (or run dev server)
npm run build

# Return to root
cd ..
```

### Step 3: Run the Application

You can run both servers simultaneously in two separate PowerShell tabs:

**Terminal 1 — Backend Server:**
```powershell
.\venv\Scripts\Activate.ps1
cd backend
python -m uvicorn app.main:app --port 8000 --reload
```
*Backend runs at: `http://127.0.0.1:8000`*

**Terminal 2 — Frontend Dev Server:**
```powershell
cd frontend
npm run dev
```
*Frontend runs at: `http://127.0.0.1:5173` (with `/api` proxy configured to backend)*

*(Alternatively, the backend automatically serves the compiled frontend build at `http://127.0.0.1:8000`!)*

---

## 3. Initial Sign In & Administrator Setup

The application automatically seeds a secure default administrator on first startup:

- **Login URL**: `http://localhost:5173/login`
- **Email**: `admin@agent.studio`
- **Password**: `Admin@Studio2026`

*A "Fill Default Admin" shortcut button is provided directly on the login screen for instant development access.*

---

## 4. How to Configure the Four LLM Providers

Creators never enter raw API keys. All keys are managed exclusively in the **Admin Portal** (`/admin`), encrypted with **AES-256-GCM** using a master encryption key, and verified in real time:

1. Sign in as Admin and navigate to **Integrations / Admin Portal** (`http://localhost:5173/admin`).
2. Click the **Providers & Models** tab.
3. Locate the provider you wish to configure:

### 1. Google Gemini API
- **Obtain Key**: Visit [Google AI Studio](https://aistudio.google.com/) and create an API key.
- **Save**: Paste your key into the Google Gemini card and click **Save & Test**.
- **Supported Models**: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`, `gemini-1.5-pro`.

### 2. GroqCloud
- **Obtain Key**: Visit [Groq Console](https://console.groq.com/keys) and create an API key.
- **Save**: Paste your key into the GroqCloud card and click **Save & Test**.
- **Supported Models**: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`.

### 3. OpenRouter
- **Obtain Key**: Visit [OpenRouter](https://openrouter.ai/keys) and generate an API key.
- **Save**: Paste your key into the OpenRouter card and click **Save & Test**.
- **Supported Models**: `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`, `meta-llama/llama-3.3-70b-instruct`.

### 4. Mistral AI
- **Obtain Key**: Visit [Mistral Console](https://console.mistral.ai/api-keys/) and create an API key.
- **Save**: Paste your key into the Mistral AI card and click **Save & Test**.
- **Supported Models**: `mistral-large-latest`, `mistral-small-latest`, `codestral-latest`.

### Model Accessibility
Administrators can toggle any specific model **Enabled** or **Disabled** at any time. The Creator Studio model dropdown immediately syncs with only enabled models.

---

## 5. Creator Studio Workflow

Navigate to `http://localhost:5173/studio`:

1. **Agent Identity**: Set the Agent Name, Description, and select an approved Base Model.
2. **Instructions System**: Write system instructions or click **Prompt Builder** to choose from predefined expert personas (Customer Support, Research Analyst, Software Architect, Executive Briefing). Add custom conversation starters.
3. **Core Capabilities**: Toggle Document Knowledge / RAG, Conversation Memory, or Streaming Responses.
4. **Knowledge Configuration**: Drag & drop or upload **PDF**, **DOCX**, or **TXT** files. The backend extracts text, segments it into overlapping semantic chunks, computes 384-dimensional dense embeddings, and stores them in the vector database.
5. **Live Chatbot Preview**: Test your agent in real time on the right-hand preview panel ("Demo Mode"). Answers use vector retrieval to cite exact document sources `[Source: document.pdf, Page: X]` with relevance scores.
6. **Save Draft / Test**: Validate the configuration.
7. **Publish / Share**: Click **Deploy** to publish the agent. A **Share** modal provides the direct web link (`/chat/:slug`) and embeddable iframe snippet.

---

## 6. Public Agent Gallery

- **URL**: `http://localhost:5173/explore`
- Unauthenticated visitors can browse all published agents with real-time search.
- Clicking an agent opens a dedicated chat view (`/chat/:slug`).
- **Security Boundary**: The public endpoint strictly omits system instructions, internal documents, provider API keys, and unpublished drafts.

---

## 7. Running Backend Tests

All 11 backend unit and integration tests verify authentication, ownership boundaries, AES-256-GCM credential encryption, vector retrieval, and text chunking:

```powershell
.\venv\Scripts\Activate.ps1
cd backend
python -m pytest -v
```

Expected output:
```
tests/test_agents.py::test_create_and_manage_agent PASSED
tests/test_agents.py::test_ownership_boundary PASSED
tests/test_auth.py::test_admin_login_success PASSED
tests/test_auth.py::test_login_invalid_password PASSED
tests/test_auth.py::test_get_current_user_me PASSED
tests/test_auth.py::test_invitation_flow PASSED
tests/test_providers.py::test_credential_encryption PASSED
tests/test_providers.py::test_mask_api_key PASSED
tests/test_providers.py::test_unconfigured_provider_error PASSED
tests/test_rag.py::test_chunking_logic PASSED
tests/test_rag.py::test_local_embedding_and_similarity PASSED

======================= 11 passed in 1.00s =======================
```

---

## 8. Database & Production Deployment (Docker Compose)

The project includes dual-mode database support:
1. **Local Development (Default)**: SQLite database (`agent_studio.db`) with fast, zero-dependency 384-dimensional cosine vector search.
2. **Production Container (Docker Compose)**: PostgreSQL 16 with native `pgvector`:

```powershell
docker compose up -d
```

---

## 9. Security Highlights

- **No Public Registration**: Creators are provisioned directly by admins or via single-use, hashed invitation tokens (`/accept-invitation?token=...`).
- **Tenant Isolation**: Creators can strictly access only their private agents and knowledge files.
- **Secrets Management**: Provider credentials are encrypted using authenticated **AES-256-GCM**.
- **Untrusted Document Ingestion**: Ingested document chunks are treated as untrusted context and formatted within explicit delimiters to prevent prompt injection.
- **Fail-Safe Provider Errors**: When a provider key is absent or invalid, the backend outputs clear, actionable diagnostic messages instead of fabricating fake responses.
