import json
import math
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.agent import Agent
from app.models.knowledge import KnowledgeBase, Document, DocumentChunk
from app.services.rag.embedding import get_embedding_adapter

class RetrievedChunk:
    def __init__(self, content: str, score: float, source: str, page: int, chunk_id: int):
        self.content = content
        self.score = score
        self.source = source
        self.page = page
        self.chunk_id = chunk_id

    def to_citation_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "page": self.page,
            "score": round(self.score, 3),
            "snippet": self.content[:150] + "..." if len(self.content) > 150 else self.content
        }

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)

def retrieve_agent_chunks(
    agent_id: int,
    query: str,
    top_k: int = 5,
    min_score: float = 0.12,
    db: Optional[Session] = None
) -> List[RetrievedChunk]:
    """
    Search chunks across only the knowledge bases authorized for this agent.
    """
    if not db or not query.strip():
        return []

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent or not agent.knowledge_bases:
        return []

    # Get all document IDs for this agent's knowledge bases
    kb_ids = [kb.id for kb in agent.knowledge_bases]
    doc_ids = [
        d.id for d in db.query(Document.id)
        .filter(Document.knowledge_base_id.in_(kb_ids), Document.status == "completed")
        .all()
    ]
    if not doc_ids:
        return []

    # Query embedding
    embedder = get_embedding_adapter()
    query_vector = embedder.get_embedding(query)

    # Fetch candidate chunks
    chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).all()
    scored_chunks: List[RetrievedChunk] = []

    for c in chunks:
        if not c.embedding_json:
            continue
        try:
            chunk_vec = json.loads(c.embedding_json)
            score = cosine_similarity(query_vector, chunk_vec)
            if score >= min_score:
                meta = json.loads(c.metadata_json or "{}")
                scored_chunks.append(RetrievedChunk(
                    content=c.content,
                    score=score,
                    source=meta.get("source", "Document"),
                    page=meta.get("page", 1),
                    chunk_id=c.id
                ))
        except Exception:
            continue

    # Sort descending by score
    scored_chunks.sort(key=lambda x: x.score, reverse=True)
    return scored_chunks[:top_k]
