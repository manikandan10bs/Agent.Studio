from typing import List, Dict, Any
from app.services.rag.extractor import ExtractedSection

class TextChunk:
    def __init__(self, content: str, index: int, metadata: Dict[str, Any]):
        self.content = content
        self.index = index
        self.metadata = metadata

def chunk_text(
    sections: List[ExtractedSection],
    filename: str,
    chunk_size: int = 600,
    chunk_overlap: int = 120
) -> List[TextChunk]:
    """
    Splits document sections into overlapping chunks preserving sentence and paragraph structure.
    """
    chunks: List[TextChunk] = []
    chunk_idx = 0

    for section in sections:
        text = section.text.strip()
        page_num = section.page_number
        
        # Normalize excessive whitespace
        text = " ".join(text.split())
        
        if len(text) <= chunk_size:
            chunks.append(TextChunk(
                content=text,
                index=chunk_idx,
                metadata={"source": filename, "page": page_num}
            ))
            chunk_idx += 1
            continue

        start = 0
        text_len = len(text)
        while start < text_len:
            end = min(start + chunk_size, text_len)
            
            # If not at the end of text, attempt to break at a sentence or word boundary
            if end < text_len:
                # Look for sentence break within last 100 characters of chunk
                lookback = text[max(start, end - 100):end]
                last_period = lookback.rfind(". ")
                last_newline = lookback.rfind("\n")
                last_space = lookback.rfind(" ")

                if last_period != -1 and (end - 100 + last_period + 2) > start:
                    end = max(start, end - 100) + last_period + 2
                elif last_newline != -1:
                    end = max(start, end - 100) + last_newline + 1
                elif last_space != -1:
                    end = max(start, end - 100) + last_space + 1

            chunk_content = text[start:end].strip()
            if len(chunk_content) > 20:  # Ignore trivial fragments
                chunks.append(TextChunk(
                    content=chunk_content,
                    index=chunk_idx,
                    metadata={"source": filename, "page": page_num}
                ))
                chunk_idx += 1

            # Advance with overlap
            start = max(start + 1, end - chunk_overlap)

    return chunks
