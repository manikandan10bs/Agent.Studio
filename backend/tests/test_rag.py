import json
from app.services.rag.extractor import ExtractedSection
from app.services.rag.chunker import chunk_text
from app.services.rag.embedding import LocalFastEmbedder, get_embedding_adapter
from app.services.rag.retriever import cosine_similarity, retrieve_agent_chunks

def test_chunking_logic():
    long_text = (
        "AGENT.STUDIO is a next-generation platform for building AI agents. "
        "It supports four major providers: Gemini, Groq, OpenRouter, and Mistral. "
        "The RAG engine extracts and indexes documents with precision vector search. "
        "Creators can test their agents in the real-time live preview panel. "
        "Published agents can be accessed by visitors through the public explore gallery."
    ) * 4

    sections = [ExtractedSection(text=long_text, page_number=1)]
    chunks = chunk_text(sections, "overview.txt", chunk_size=300, chunk_overlap=60)
    
    assert len(chunks) > 1
    for c in chunks:
        assert c.metadata["source"] == "overview.txt"
        assert c.metadata["page"] == 1
        assert len(c.content) > 0

def test_local_embedding_and_similarity():
    embedder = LocalFastEmbedder()
    vec1 = embedder.get_embedding("Artificial Intelligence and autonomous agents")
    vec2 = embedder.get_embedding("Autonomous AI agents and machine intelligence")
    vec3 = embedder.get_embedding("Cooking traditional Italian pasta recipes")

    sim_related = cosine_similarity(vec1, vec2)
    sim_unrelated = cosine_similarity(vec1, vec3)

    assert sim_related > sim_unrelated
    assert sim_related > 0.5
