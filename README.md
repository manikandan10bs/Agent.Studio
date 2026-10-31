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

## 7. Running Backend Tests (25 Passing)

All 25 backend unit and integration tests verify authentication, ownership boundaries, AES-256-GCM credential encryption, vector retrieval, text chunking, and the 12 core tools:

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
tests/test_tools.py::test_registry_contains_12_tools PASSED
tests/test_tools.py::test_calculator_tool_operations PASSED
tests/test_tools.py::test_datetime_tool_operations PASSED
tests/test_tools.py::test_url_validator_and_ssrf_protection PASSED
tests/test_tools.py::test_json_parser_tool PASSED
tests/test_tools.py::test_csv_processor_tool PASSED
tests/test_tools.py::test_data_cleaner_and_duplicate_finder PASSED
tests/test_tools.py::test_chart_generator_tool PASSED
tests/test_tools.py::test_pdf_and_docx_tools PASSED
tests/test_tools.py::test_excel_processor_tool PASSED
tests/test_tools.py::test_api_list_tools PASSED
tests/test_tools.py::test_api_toggle_tool_permission PASSED
tests/test_tools.py::test_api_test_tool_endpoint PASSED
tests/test_tools.py::test_api_download_nonexistent_and_traversal PASSED

======================= 25 passed in 2.89s =======================
```

---

## 8. The 12 Core AI Agent Tools Ecosystem

AGENT.STUDIO incorporates exactly **12 production-grade Python tools** organized across 5 distinct categories, with zero reliance on paid external APIs (utilizing local Python libraries and the existing Google Gemini API integration):

### 1. Documents & Files
1. **PDF Extractor** (`pdf_extractor`): Upload PDF documents, extract text page-by-page preserving page numbers and metadata with PyMuPDF (`pymupdf`), handling password-protected or empty documents gracefully.
2. **Word Document Reader** (`docx_reader`): Read DOCX files with `python-docx`, extracting structured headings, body paragraphs, and tabular records.
3. **Excel Processor** (`excel_processor`): Inspect XLSX workbooks with `openpyxl` & `pandas`, discover worksheets, view column schemas, filter, sort, aggregate, and generate downloadable Excel outputs.
4. **CSV Processor** (`csv_processor`): Process CSV files with automatic delimiter/encoding detection, data previews, column filtering, and filtered file downloads.
5. **JSON Parser** (`json_parser`): Validate JSON syntax with exact line and column error indicators, extract nested fields via dot-notation, and filter arrays of objects.

### 2. Data Processing
6. **Data Cleaner** (`data_cleaner`): Detect missing values, drop duplicate rows, normalize whitespace, standardize column headers into `lower_snake_case`, and export cleaned datasets.
7. **Duplicate Finder** (`duplicate_finder`): Scan tabular datasets for duplicates across all or specified columns, calculate duplicate percentages, and export duplicates and unique records separately.

### 3. Data Utilities
8. **Calculator** (`calculator`): Safe Python AST mathematical evaluation (without unrestricted `eval`) supporting addition, subtraction, multiplication, division, powers, percentages (e.g. `25% of 200`), roots, and mathematical functions with division-by-zero protection.
9. **Date & Time** (`datetime_tool`): Current time lookup, date arithmetic (add/subtract days, hours, weeks), difference calculations, and timezone conversion using Python `datetime` and `zoneinfo`.

### 4. Validation & Utilities
10. **Chart Generator** (`chart_generator`): Generate bar, line, pie, and scatter plots using `matplotlib` (`Agg` headless backend) from Excel/CSV files or JSON arrays. Returns both a direct download link and an inline base64 image preview.
11. **URL Validator** (`url_validator`): Validate URL syntax, schemes, and hostnames. Enforces **strict SSRF protection** (blocks loopback `127.0.0.1`, `localhost`, RFC-1918 private subnets `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, AWS/cloud metadata IPs `169.254.169.254`, and file/gopher schemes) before making live accessibility checks.

### 5. Gemini AI Tools
12. **Text Summarizer** (`text_summarizer`): Powered by the Google Gemini API to generate structured executive summaries (short, medium, detailed), key takeaways, and action items from text, uploaded PDFs, DOCX, or tabular analysis.

### Creator & Admin Experience
- **Tools Marketplace (`/tools` / `/studio?view=tools`)**: Discover all 12 tools, filter by category, search by keyword, view schema configurations, and test tools interactively with live input forms. Administrators have global toggle switches to enable/disable tools platform-wide.
- **Agent Builder Integration (`Tools & Capabilities` Sub-tab)**: Creators can enable multiple tools for their custom agent. Disabled tools show "Disabled by Admin". Tool selections are versioned and stored with agent drafts and published snapshots.
- **Gemini Autonomous Function Calling**: Gemini models automatically invoke enabled tools in multi-turn conversation loops (up to 3 tool calls per response), with real-time execution pills, timing telemetry, and download buttons in the chat interface.

---

## 9. Database & Production Deployment (Docker Compose)

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
