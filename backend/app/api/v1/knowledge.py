import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.models.knowledge import KnowledgeBase, Document, DocumentChunk
from app.models.agent import Agent
from app.models.user import User
from app.schemas.knowledge import KnowledgeBaseCreate, KnowledgeBaseOut, DocumentOut
from app.api.deps import get_current_user, log_audit
from app.services.rag.rag_service import process_document_sync

router = APIRouter()

ALLOWED_EXTENSIONS = {"pdf", "txt", "docx", "md"}
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB

@router.get("/knowledge-bases", response_model=List[KnowledgeBaseOut])
def list_knowledge_bases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "admin":
        kbs = db.query(KnowledgeBase).all()
    else:
        kbs = db.query(KnowledgeBase).filter(KnowledgeBase.creator_id == current_user.id).all()
    return kbs

@router.post("/knowledge-bases", response_model=KnowledgeBaseOut, status_code=status.HTTP_201_CREATED)
def create_knowledge_base(
    kb_in: KnowledgeBaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    kb = KnowledgeBase(
        creator_id=current_user.id,
        name=kb_in.name,
        description=kb_in.description
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    return kb

@router.get("/knowledge-bases/{kb_id}/documents", response_model=List[DocumentOut])
def get_kb_documents(
    kb_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found.")
    if current_user.role != "admin" and kb.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized.")
    return kb.documents

@router.get("/agents/{agent_id}/documents", response_model=List[DocumentOut])
def get_agent_documents(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if current_user.role != "admin" and agent.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized.")

    documents = []
    for kb in agent.knowledge_bases:
        documents.extend(kb.documents)
    return documents

@router.post("/agents/{agent_id}/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_agent_document(
    agent_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if current_user.role != "admin" and agent.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized.")

    # Get or create associated knowledge base
    if not agent.knowledge_bases:
        kb = KnowledgeBase(
            creator_id=current_user.id,
            name=f"{agent.name} Knowledge Base",
            description=f"Knowledge base for {agent.name}"
        )
        db.add(kb)
        db.flush()
        agent.knowledge_bases.append(kb)
        db.commit()
    else:
        kb = agent.knowledge_bases[0]

    filename = file.filename or "uploaded_document"
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type .{ext}. Supported formats: PDF, TXT, DOCX"
        )

    # Prepare storage directory
    os.makedirs(settings.STORAGE_DIR, exist_ok=True)
    saved_filename = f"{kb.id}_{int(os.path.getmtime(settings.STORAGE_DIR) if os.path.exists(settings.STORAGE_DIR) else 1)}_{filename}"
    file_path = os.path.join(settings.STORAGE_DIR, saved_filename)

    with open(file_path, "wb") as buffer:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="File exceeds max allowable size of 25MB.")
        buffer.write(content)

    doc = Document(
        knowledge_base_id=kb.id,
        filename=filename,
        file_type=ext,
        file_size=len(content),
        storage_path=file_path,
        status="uploading"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Process immediately
    process_document_sync(doc.id, db)
    agent.capability_rag = True
    db.commit()
    db.refresh(doc)

    log_audit(db, "UPLOAD_DOCUMENT", "document", str(doc.id), user=current_user, details={"filename": filename})
    return doc

@router.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    kb = doc.knowledge_base
    if current_user.role != "admin" and kb.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized.")

    if os.path.exists(doc.storage_path):
        try:
            os.remove(doc.storage_path)
        except Exception:
            pass

    db.delete(doc)
    db.commit()
    log_audit(db, "DELETE_DOCUMENT", "document", str(document_id), user=current_user)
    return {"message": "Document deleted successfully"}
