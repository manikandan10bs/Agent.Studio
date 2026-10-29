import os
from typing import List, Dict, Any
from pypdf import PdfReader
from docx import Document as DocxDocument

class ExtractedSection:
    def __init__(self, text: str, page_number: int = 1):
        self.text = text
        self.page_number = page_number

def extract_text_from_file(file_path: str, file_type: str) -> List[ExtractedSection]:
    """
    Extracts text and page metadata from PDF, DOCX, or TXT file.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found at path: {file_path}")

    sections: List[ExtractedSection] = []
    normalized_type = file_type.lower().replace(".", "")

    if normalized_type == "pdf":
        reader = PdfReader(file_path)
        for idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            text = text.strip()
            if text:
                sections.append(ExtractedSection(text=text, page_number=idx + 1))

    elif normalized_type == "docx":
        doc = DocxDocument(file_path)
        full_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        if full_text.strip():
            sections.append(ExtractedSection(text=full_text, page_number=1))

    elif normalized_type in ("txt", "md", "csv", "json"):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read().strip()
            if content:
                sections.append(ExtractedSection(text=content, page_number=1))
    else:
        raise ValueError(f"Unsupported document format: {file_type}. Supported: pdf, docx, txt")

    if not sections:
        raise ValueError("Document appears to be empty or contains no extractable text.")

    return sections
