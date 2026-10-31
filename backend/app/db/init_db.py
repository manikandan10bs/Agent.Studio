import json
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserQuota
from app.models.provider import Provider, ProviderCredential, Model
from app.core.security import encrypt_credential, mask_api_key
from app.models.agent import Agent, AgentVersion
from app.models.knowledge import KnowledgeBase

DEFAULT_PROVIDERS = [
    {
        "name": "gemini",
        "display_name": "Google Gemini API",
        "models": [
            {"identifier": "gemini-3.8-flash", "display_name": "Gemini 3.8 Flash", "context": 1000000},
            {"identifier": "gemini-3.8-pro", "display_name": "Gemini 3.8 Pro", "context": 2000000},
            {"identifier": "gemini-2.5-flash", "display_name": "Gemini 2.5 Flash", "context": 1000000},
            {"identifier": "gemini-2.5-pro", "display_name": "Gemini 2.5 Pro", "context": 2000000},
            {"identifier": "gemini-1.5-flash", "display_name": "Gemini 1.5 Flash", "context": 1000000},
            {"identifier": "gemini-1.5-pro", "display_name": "Gemini 1.5 Pro", "context": 2000000},
        ]
    },
    {
        "name": "groq",
        "display_name": "GroqCloud",
        "models": [
            {"identifier": "openai/gpt-oss-20b", "display_name": "GPT-OSS 20B", "context": 128000},
            {"identifier": "openai/gpt-oss-120b", "display_name": "GPT-OSS 120B", "context": 128000},
            {"identifier": "llama-3.3-70b-versatile", "display_name": "Llama 3.3 70B Versatile", "context": 128000},
            {"identifier": "llama-3.1-8b-instant", "display_name": "Llama 3.1 8B Instant", "context": 128000},
            {"identifier": "mixtral-8x7b-32768", "display_name": "Mixtral 8x7B 32k", "context": 32768},
        ]
    },
    {
        "name": "openrouter",
        "display_name": "OpenRouter",
        "models": [
            {"identifier": "anthropic/claude-3.5-sonnet", "display_name": "Claude 3.5 Sonnet", "context": 200000},
            {"identifier": "openai/gpt-4o", "display_name": "GPT-4o", "context": 128000},
            {"identifier": "meta-llama/llama-3.3-70b-instruct", "display_name": "Llama 3.3 70B Instruct", "context": 131072},
        ]
    },
    {
        "name": "mistral",
        "display_name": "Mistral AI",
        "models": [
            {"identifier": "mistral-large-latest", "display_name": "Mistral Large", "context": 128000},
            {"identifier": "mistral-small-latest", "display_name": "Mistral Small", "context": 32000},
            {"identifier": "codestral-latest", "display_name": "Codestral", "context": 32000},
        ]
    }
]

def init_db(db: Session) -> None:
    # 0. Ensure schema migration for SQLite if updating existing DB
    if db.bind and db.bind.dialect.name == "sqlite":
        from sqlalchemy import text
        for col_def in [
            "ALTER TABLE agents ADD COLUMN enabled_tools TEXT DEFAULT '[]'",
            "ALTER TABLE agents ADD COLUMN tools_config TEXT DEFAULT '{}'",
            "ALTER TABLE agent_versions ADD COLUMN enabled_tools TEXT DEFAULT '[]'",
            "ALTER TABLE agent_versions ADD COLUMN tools_config TEXT DEFAULT '{}'",
            "ALTER TABLE messages ADD COLUMN tools_json TEXT DEFAULT '[]'"
        ]:
            try:
                db.execute(text(col_def))
                db.commit()
            except Exception:
                db.rollback()

    # 1. Create Default Admin if not exists
    admin = db.query(User).filter(User.email == settings.DEFAULT_ADMIN_EMAIL).first()
    if not admin:
        admin = User(
            email=settings.DEFAULT_ADMIN_EMAIL,
            full_name=settings.DEFAULT_ADMIN_NAME,
            hashed_password=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.flush()
        
        # Add admin quota
        quota = UserQuota(
            user_id=admin.id,
            monthly_token_limit=10000000,
            tokens_used_this_month=0,
            max_agents=100
        )
        db.add(quota)
        db.commit()
        db.refresh(admin)
    else:
        if admin.role != "admin":
            admin.role = "admin"
            db.commit()

    # 2. Seed Providers and Models
    for prov_data in DEFAULT_PROVIDERS:
        provider = db.query(Provider).filter(Provider.name == prov_data["name"]).first()
        if not provider:
            provider = Provider(
                name=prov_data["name"],
                display_name=prov_data["display_name"],
                is_configured=False
            )
            db.add(provider)
            db.flush()
        
        for m_data in prov_data["models"]:
            model = db.query(Model).filter(Model.model_identifier == m_data["identifier"]).first()
            if not model:
                model = Model(
                    provider_id=provider.id,
                    model_identifier=m_data["identifier"],
                    display_name=m_data["display_name"],
                    context_window=m_data["context"],
                    is_enabled=True,
                    supports_streaming=True,
                    supports_rag=True
                )
                db.add(model)

        # Check if environment key is provided in settings/.env
        env_key_name = f"{prov_data['name'].upper()}_API_KEY"
        env_key = getattr(settings, env_key_name, None)
        if env_key and env_key.strip():
            cred = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).first()
            encrypted = encrypt_credential(env_key.strip())
            hint = mask_api_key(env_key.strip())
            if not cred:
                cred = ProviderCredential(
                    provider_id=provider.id,
                    encrypted_api_key=encrypted,
                    key_hint=hint,
                    is_valid=True
                )
                db.add(cred)
            else:
                cred.encrypted_api_key = encrypted
                cred.key_hint = hint
                cred.is_valid = True
            provider.is_configured = True
    db.commit()

    # 3. Seed initial default demo agent if none exist
    agent_count = db.query(Agent).count()
    if agent_count == 0:
        first_model = db.query(Model).first()
        demo_agent = Agent(
            creator_id=admin.id,
            name="Precision Assistant",
            slug="precision-assistant",
            description="Autonomous precision-engineered AI agent built with AGENT.STUDIO.",
            base_model_id=first_model.id if first_model else None,
            system_instructions=(
                "You are Precision Assistant, an expert AI created with AGENT.STUDIO.\n"
                "You provide clear, accurate, and concise answers based on verified context.\n"
                "- Always ground your answers in provided documentation when available.\n"
                "- If the documentation does not contain the answer, explicitly state that.\n"
                "- Format responses cleanly with markdown and code blocks."
            ),
            conversation_starters=json.dumps([
                "How does AGENT.STUDIO configure precision RAG agents?",
                "What capabilities are currently enabled on this agent?",
                "Can you summarize the attached knowledge documents?"
            ]),
            capability_rag=True,
            capability_memory=True,
            capability_streaming=True,
            enabled_tools=json.dumps([
                "pdf_extractor", "docx_reader", "excel_processor", "csv_processor",
                "json_parser", "data_cleaner", "duplicate_finder", "calculator",
                "datetime_tool", "chart_generator", "url_validator", "text_summarizer"
            ]),
            tools_config=json.dumps({}),
            status="tested",
            current_version=1,
            is_public=True
        )
        db.add(demo_agent)
        db.flush()

        # Create Agent Version 1
        agent_v1 = AgentVersion(
            agent_id=demo_agent.id,
            version_number=1,
            name=demo_agent.name,
            description=demo_agent.description,
            model_identifier=first_model.model_identifier if first_model else "gemini-2.5-flash",
            system_instructions=demo_agent.system_instructions,
            conversation_starters=demo_agent.conversation_starters,
            capabilities=json.dumps({
                "rag": True,
                "memory": True,
                "streaming": True
            }),
            enabled_tools=demo_agent.enabled_tools,
            tools_config=demo_agent.tools_config
        )
        db.add(agent_v1)

        # Create default Knowledge Base for the agent
        kb = KnowledgeBase(
            creator_id=admin.id,
            name="General Knowledge Base",
            description="Default knowledge repository for precision assistant."
        )
        db.add(kb)
        db.flush()
        demo_agent.knowledge_bases.append(kb)
        db.commit()

    # 4. Seed the 12 Core System Tools
    from app.models.tool import SystemTool
    from app.services.tools import registry
    for tool in registry.list_tools():
        existing_tool = db.query(SystemTool).filter(SystemTool.id == tool.id).first()
        if not existing_tool:
            st = SystemTool(
                id=tool.id,
                name=tool.name,
                description=tool.description,
                category=tool.category,
                icon=tool.icon,
                is_enabled=True,
                config_schema=json.dumps(tool.input_schema)
            )
            db.add(st)
        else:
            # Sync description and category while preserving admin's is_enabled switch
            existing_tool.name = tool.name
            existing_tool.description = tool.description
            existing_tool.category = tool.category
            existing_tool.icon = tool.icon
            existing_tool.config_schema = json.dumps(tool.input_schema)
    db.commit()
