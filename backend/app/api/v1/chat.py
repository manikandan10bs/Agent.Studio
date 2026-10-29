import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.agent import Agent
from app.models.chat import Conversation, Message
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse, MessageOut, ConversationOut, CitationOut
from app.api.deps import get_current_user
from app.services.chat_service import handle_agent_chat, stream_agent_chat_generator

router = APIRouter()

def serialize_message(m: Message) -> MessageOut:
    citations = []
    if m.citations_json:
        try:
            cit_data = json.loads(m.citations_json)
            for c in cit_data:
                citations.append(CitationOut(
                    source=c.get("source", "Document"),
                    page=c.get("page", 1),
                    score=c.get("score", 0.0),
                    snippet=c.get("snippet", "")
                ))
        except Exception:
            citations = []

    return MessageOut(
        id=m.id,
        conversation_id=m.conversation_id,
        role=m.role,
        content=m.content,
        citations=citations,
        latency_ms=m.latency_ms,
        token_usage=m.token_usage,
        created_at=m.created_at
    )

@router.post("/agents/{agent_id}/chat")
async def chat_with_agent(
    agent_id: int,
    chat_data: ChatRequest,
    is_demo: bool = Query(False, description="Flag for Studio demo mode"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    if current_user.role != "admin" and agent.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to test this agent.")

    if chat_data.stream and agent.capability_streaming:
        return StreamingResponse(
            stream_agent_chat_generator(
                agent_id=agent.id,
                user_message=chat_data.message,
                conversation_id=chat_data.conversation_id,
                user_id=current_user.id,
                is_demo=is_demo,
                db=db
            ),
            media_type="text/event-stream"
        )
    else:
        try:
            conv, msg, citations = await handle_agent_chat(
                agent_id=agent.id,
                user_message=chat_data.message,
                conversation_id=chat_data.conversation_id,
                user_id=current_user.id,
                is_demo=is_demo,
                db=db
            )
            return ChatResponse(
                conversation_id=conv.id,
                message=serialize_message(msg),
                citations=[CitationOut(**c) for c in citations]
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/conversations", response_model=List[ConversationOut])
def list_conversations(
    agent_id: Optional[int] = None,
    is_demo: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Conversation).filter(Conversation.user_id == current_user.id)
    if agent_id:
        query = query.filter(Conversation.agent_id == agent_id)
    if is_demo is not None:
        query = query.filter(Conversation.is_demo == is_demo)

    conversations = query.order_by(Conversation.updated_at.desc()).all()
    results = []
    for c in conversations:
        results.append(ConversationOut(
            id=c.id,
            agent_id=c.agent_id,
            title=c.title,
            is_demo=c.is_demo,
            created_at=c.created_at,
            updated_at=c.updated_at,
            messages=[serialize_message(m) for m in c.messages]
        ))
    return results

@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageOut])
def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if current_user.role != "admin" and conv.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized.")

    return [serialize_message(m) for m in conv.messages]

@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if current_user.role != "admin" and conv.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized.")

    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted"}
