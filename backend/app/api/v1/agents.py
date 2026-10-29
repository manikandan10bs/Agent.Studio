import json
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.agent import Agent, AgentVersion
from app.models.provider import Model
from app.models.knowledge import KnowledgeBase
from app.models.user import User
from app.schemas.agent import AgentCreate, AgentUpdate, AgentOut
from app.api.deps import get_current_user, log_audit

router = APIRouter()

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    return re.sub(r'[-\s]+', '-', text)

def serialize_agent(agent: Agent) -> AgentOut:
    starters = []
    if agent.conversation_starters:
        try:
            starters = json.loads(agent.conversation_starters)
        except Exception:
            starters = []

    return AgentOut(
        id=agent.id,
        creator_id=agent.creator_id,
        name=agent.name,
        slug=agent.slug,
        description=agent.description or "",
        base_model_id=agent.base_model_id,
        base_model_name=agent.base_model.display_name if agent.base_model else None,
        provider_name=agent.base_model.provider.name if agent.base_model and agent.base_model.provider else None,
        system_instructions=agent.system_instructions or "",
        conversation_starters=starters,
        capability_rag=agent.capability_rag,
        capability_memory=agent.capability_memory,
        capability_streaming=agent.capability_streaming,
        status=agent.status,
        current_version=agent.current_version,
        is_public=agent.is_public,
        created_at=agent.created_at,
        updated_at=agent.updated_at
    )

@router.get("", response_model=List[AgentOut])
def list_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "admin":
        agents = db.query(Agent).order_by(Agent.updated_at.desc()).all()
    else:
        agents = db.query(Agent).filter(Agent.creator_id == current_user.id).order_by(Agent.updated_at.desc()).all()
    return [serialize_agent(a) for a in agents]

@router.post("", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
def create_agent(
    agent_in: AgentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    base_slug = slugify(agent_in.name) or "agent"
    slug = base_slug
    idx = 1
    while db.query(Agent).filter(Agent.slug == slug).first():
        slug = f"{base_slug}-{idx}"
        idx += 1

    # Verify model if provided
    if agent_in.base_model_id:
        model = db.query(Model).filter(Model.id == agent_in.base_model_id, Model.is_enabled == True).first()
        if not model:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected model is either invalid or currently disabled."
            )

    agent = Agent(
        creator_id=current_user.id,
        name=agent_in.name,
        slug=slug,
        description=agent_in.description,
        base_model_id=agent_in.base_model_id,
        system_instructions=agent_in.system_instructions,
        conversation_starters=json.dumps(agent_in.conversation_starters or []),
        capability_rag=agent_in.capability_rag,
        capability_memory=agent_in.capability_memory,
        capability_streaming=agent_in.capability_streaming,
        status="draft",
        current_version=1,
        is_public=False
    )
    db.add(agent)
    db.flush()

    # Automatically associate or create a default knowledge base for the agent
    kb = KnowledgeBase(
        creator_id=current_user.id,
        name=f"{agent.name} Knowledge Base",
        description=f"Knowledge files for {agent.name}"
    )
    db.add(kb)
    db.flush()
    agent.knowledge_bases.append(kb)

    # Save initial version 1
    v1 = AgentVersion(
        agent_id=agent.id,
        version_number=1,
        name=agent.name,
        description=agent.description,
        model_identifier=agent.base_model.model_identifier if agent.base_model else None,
        system_instructions=agent.system_instructions,
        conversation_starters=agent.conversation_starters,
        capabilities=json.dumps({
            "rag": agent.capability_rag,
            "memory": agent.capability_memory,
            "streaming": agent.capability_streaming
        })
    )
    db.add(v1)
    db.commit()
    db.refresh(agent)

    log_audit(db, "CREATE_AGENT", "agent", str(agent.id), user=current_user)
    return serialize_agent(agent)

@router.get("/{agent_id}", response_model=AgentOut)
def get_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    
    # Ownership boundary
    if current_user.role != "admin" and agent.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this agent.")

    return serialize_agent(agent)

@router.patch("/{agent_id}", response_model=AgentOut)
def update_agent(
    agent_id: int,
    agent_update: AgentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    
    if current_user.role != "admin" and agent.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this agent.")

    # If updating published agent, transition status to draft
    if agent.status == "published":
        agent.status = "draft"
        agent.current_version += 1

    if agent_update.name is not None:
        agent.name = agent_update.name
    if agent_update.description is not None:
        agent.description = agent_update.description
    if agent_update.base_model_id is not None:
        model = db.query(Model).filter(Model.id == agent_update.base_model_id, Model.is_enabled == True).first()
        if not model:
            raise HTTPException(status_code=400, detail="Selected model is invalid or disabled.")
        agent.base_model_id = model.id
    if agent_update.system_instructions is not None:
        agent.system_instructions = agent_update.system_instructions
    if agent_update.conversation_starters is not None:
        agent.conversation_starters = json.dumps(agent_update.conversation_starters)
    if agent_update.capability_rag is not None:
        agent.capability_rag = agent_update.capability_rag
    if agent_update.capability_memory is not None:
        agent.capability_memory = agent_update.capability_memory
    if agent_update.capability_streaming is not None:
        agent.capability_streaming = agent_update.capability_streaming

    db.commit()
    db.refresh(agent)
    log_audit(db, "UPDATE_AGENT", "agent", str(agent.id), user=current_user)
    return serialize_agent(agent)

@router.post("/{agent_id}/test", response_model=AgentOut)
def test_agent_configuration(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Validates agent configuration and transitions status from 'draft' to 'tested'.
    """
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if current_user.role != "admin" and agent.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized.")

    if not agent.base_model_id:
        raise HTTPException(status_code=400, detail="Please select a Base Model before testing.")

    if agent.status == "draft":
        agent.status = "tested"
        db.commit()
        db.refresh(agent)

    return serialize_agent(agent)

@router.post("/{agent_id}/publish", response_model=AgentOut)
def publish_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Validates and publishes the agent, taking a new version snapshot.
    """
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if current_user.role != "admin" and agent.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized.")

    if not agent.name or len(agent.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Agent name is required to publish.")
    if not agent.base_model_id:
        raise HTTPException(status_code=400, detail="A valid Base Model must be selected to publish.")
    if not agent.base_model or not agent.base_model.is_enabled:
        raise HTTPException(status_code=400, detail="Selected base model is disabled.")

    # Create version record
    new_version_num = agent.current_version
    version_snapshot = AgentVersion(
        agent_id=agent.id,
        version_number=new_version_num,
        name=agent.name,
        description=agent.description,
        model_identifier=agent.base_model.model_identifier,
        system_instructions=agent.system_instructions,
        conversation_starters=agent.conversation_starters,
        capabilities=json.dumps({
            "rag": agent.capability_rag,
            "memory": agent.capability_memory,
            "streaming": agent.capability_streaming
        })
    )
    db.add(version_snapshot)

    agent.status = "published"
    agent.is_public = True
    db.commit()
    db.refresh(agent)

    log_audit(db, "PUBLISH_AGENT", "agent", str(agent.id), user=current_user)
    return serialize_agent(agent)

@router.post("/{agent_id}/unpublish", response_model=AgentOut)
def unpublish_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if current_user.role != "admin" and agent.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized.")

    agent.status = "unpublished"
    agent.is_public = False
    db.commit()
    db.refresh(agent)

    log_audit(db, "UNPUBLISH_AGENT", "agent", str(agent.id), user=current_user)
    return serialize_agent(agent)

@router.delete("/{agent_id}")
def delete_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if current_user.role != "admin" and agent.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this agent.")

    db.delete(agent)
    db.commit()
    log_audit(db, "DELETE_AGENT", "agent", str(agent_id), user=current_user)
    return {"message": "Agent deleted successfully"}
