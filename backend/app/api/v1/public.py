import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.agent import Agent
from app.models.chat import Conversation, Message
from app.schemas.agent import PublicAgentOut
from app.schemas.chat import ChatRequest, ChatResponse, MessageOut, CitationOut
from app.services.chat_service import handle_agent_chat, stream_agent_chat_generator

router = APIRouter()

def serialize_public_agent(agent: Agent) -> PublicAgentOut:
    starters = []
    if agent.conversation_starters:
        try:
            starters = json.loads(agent.conversation_starters)
        except Exception:
            starters = []

    return PublicAgentOut(
        id=agent.id,
        name=agent.name,
        slug=agent.slug,
        description=agent.description or "",
        model_name=agent.base_model.display_name if agent.base_model else None,
        conversation_starters=starters,
        capability_rag=agent.capability_rag,
        capability_streaming=agent.capability_streaming,
        created_at=agent.created_at
    )

@router.get("/agents", response_model=List[PublicAgentOut])
def list_public_agents(
    q: Optional[str] = Query(None, description="Search query by name or description"),
    db: Session = Depends(get_db)
):
    """
    Explore published agents. Visitors cannot view system prompt or private data.
    """
    query = db.query(Agent).filter(
        Agent.status == "published",
        Agent.is_public == True
    )
    if q:
        search_pattern = f"%{q}%"
        query = query.filter(
            (Agent.name.ilike(search_pattern)) | (Agent.description.ilike(search_pattern))
        )
    agents = query.order_by(Agent.updated_at.desc()).all()
    return [serialize_public_agent(a) for a in agents]

@router.get("/agents/{slug}", response_model=PublicAgentOut)
def get_public_agent(
    slug: str,
    db: Session = Depends(get_db)
):
    agent = db.query(Agent).filter(
        Agent.slug == slug,
        Agent.status == "published",
        Agent.is_public == True
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Published agent not found.")
    return serialize_public_agent(agent)

@router.post("/agents/{slug}/chat")
async def chat_with_public_agent(
    slug: str,
    chat_data: ChatRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    agent = db.query(Agent).filter(
        Agent.slug == slug,
        Agent.status == "published",
        Agent.is_public == True
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Published agent not found.")

    if chat_data.stream and agent.capability_streaming:
        return StreamingResponse(
            stream_agent_chat_generator(
                agent_id=agent.id,
                user_message=chat_data.message,
                conversation_id=chat_data.conversation_id,
                user_id=None,
                is_demo=False,
                db=db
            ),
            media_type="text/event-stream"
        )
    else:
        conv, msg, citations = await handle_agent_chat(
            agent_id=agent.id,
            user_message=chat_data.message,
            conversation_id=chat_data.conversation_id,
            user_id=None,
            is_demo=False,
            db=db
        )
        return {
            "conversation_id": conv.id,
            "message": {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at
            },
            "citations": citations
        }
