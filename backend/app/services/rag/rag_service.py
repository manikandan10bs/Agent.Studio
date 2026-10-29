import os
import json
import logging
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.knowledge import Document, DocumentChunk
from app.services.rag.extractor import extract_text_from_file
from app.services.rag.chunker import chunk_text
from app.services.rag.embedding import get_embedding_adapter
from app.services.rag.retriever import retrieve_agent_chunks, RetrievedChunk

logger = logging.getLogger(__name__)

def process_document_sync(document_id: int, db: Session) -> bool:
    """
    Ingests and processes an uploaded document:
    1. Extracts text and page metadata
    2. Chunks text into overlapping semantic passages
    3. Computes vector embeddings
    4. Persists chunks and embeddings
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        logger.error(f"Document {document_id} not found for processing.")
        return False

    doc.status = "processing"
    doc.error_message = None
    db.commit()

    try:
        path_to_extract = doc.storage_path
        if doc.storage_path.startswith("supabase://") and not os.path.exists(doc.storage_path):
            import asyncio
            from app.services.storage import storage_service
            raw_bytes = asyncio.run(storage_service.get_file_bytes(doc.storage_path))
            temp_local = os.path.join(settings.STORAGE_DIR, f"temp_{doc.id}_{doc.filename}")
            os.makedirs(settings.STORAGE_DIR, exist_ok=True)
            with open(temp_local, "wb") as f:
                f.write(raw_bytes)
            path_to_extract = temp_local

        sections = extract_text_from_file(path_to_extract, doc.file_type)
        chunks = chunk_text(sections, doc.filename)
        
        if not chunks:
            raise ValueError("No extractable chunks found in document.")

        embedder = get_embedding_adapter()

        # Delete old chunks if reprocessing
        db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()

        for chunk in chunks:
            emb = embedder.get_embedding(chunk.content)
            db_chunk = DocumentChunk(
                document_id=doc.id,
                chunk_index=chunk.index,
                content=chunk.content,
                metadata_json=json.dumps(chunk.metadata),
                embedding_json=json.dumps(emb)
            )
            db.add(db_chunk)

        doc.status = "completed"
        doc.chunk_count = len(chunks)
        db.commit()
        db.refresh(doc)
        logger.info(f"Successfully processed document {doc.filename} with {len(chunks)} chunks.")
        return True

    except Exception as e:
        logger.exception(f"Failed processing document {doc.filename}: {str(e)}")
        doc.status = "failed"
        doc.error_message = str(e)
        db.commit()
        return False

def augment_prompt_with_rag(
    system_instructions: str,
    retrieved_chunks: list[RetrievedChunk]
) -> tuple[str, list[dict]]:
    """
    Constructs an augmented system instruction incorporating retrieved RAG evidence.
    Returns (augmented_system_prompt, citation_list).
    """
    citations = [c.to_citation_dict() for c in retrieved_chunks]
    
    if not retrieved_chunks:
        # No documents retrieved: Return base instructions cleanly without forcing negative boilerplate
        return system_instructions, citations

    context_blocks = []
    for i, c in enumerate(retrieved_chunks):
        context_blocks.append(
            f"--- Document: {c.source} (Page {c.page}) ---\n"
            f"{c.content}\n"
        )

    context_str = "\n".join(context_blocks)
    augmented_prompt = (
        f"{system_instructions}\n\n"
        "[KNOWLEDGE BASE EXCERPTS]:\n"
        f"{context_str}\n"
        "[END KNOWLEDGE BASE EXCERPTS]\n\n"
        "Instructions: When answering questions that relate to the knowledge base excerpts above, "
        "use this information to provide accurate answers and cite the source document. "
        "For general inquiries or conversation, answer helpfully and naturally."
    )

    return augmented_prompt, citations
