import os
import json
import logging
from typing import Dict, Any, Optional, List
from app.services.tools.registry import BaseTool, ToolExecutionResult
from app.services.tools.utils import resolve_safe_file_path
from app.services.llm.base import LLMMessage

logger = logging.getLogger(__name__)

class TextSummarizerTool(BaseTool):
    id = "text_summarizer"
    name = "Text Summarizer"
    description = "AI-powered summarization using Google Gemini. Summarizes raw text, uploaded documents (PDF, DOCX, TXT), or data analysis results into structured key points and action items."
    category = "Gemini AI Tools"
    icon = "Sparkles"
    timeout_seconds = 45
    permission_required = "creator"

    input_schema = {
        "type": "object",
        "properties": {
            "text": {
                "type": "string",
                "description": "Raw text content to summarize."
            },
            "file_path": {
                "type": "string",
                "description": "Optional file name or path of an uploaded document (PDF, DOCX, TXT, CSV) to extract and summarize."
            },
            "summary_type": {
                "type": "string",
                "enum": ["short", "medium", "detailed"],
                "description": "Summary length: 'short' (1-2 sentences), 'medium' (concise paragraph), or 'detailed' (comprehensive multi-section)."
            },
            "extract_key_points": {
                "type": "boolean",
                "description": "Whether to extract a bulleted list of key points (default true)."
            },
            "generate_action_items": {
                "type": "boolean",
                "description": "Whether to generate actionable next steps / recommendations (default true)."
            },
            "focus": {
                "type": "string",
                "description": "Optional specific topic or aspect to focus the summary on."
            }
        }
    }

    output_schema = {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "key_points": {"type": "array", "items": {"type": "string"}},
            "action_items": {"type": "array", "items": {"type": "string"}},
            "original_word_count": {"type": "integer"},
            "summary_word_count": {"type": "integer"}
        }
    }

    async def execute(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> ToolExecutionResult:
        raw_text = (params.get("text") or "").strip()
        file_path = params.get("file_path")

        # 1. If file_path is supplied, extract text from it
        if file_path:
            try:
                abs_path = resolve_safe_file_path(file_path)
                ext = abs_path.lower().split(".")[-1]
                
                if ext == "pdf":
                    try:
                        import fitz
                        doc = fitz.open(abs_path)
                        pages_txt = [page.get_text() for page in doc]
                        raw_text = "\n\n".join(pages_txt).strip()
                        doc.close()
                    except Exception:
                        from pypdf import PdfReader
                        r = PdfReader(abs_path)
                        raw_text = "\n\n".join(p.extract_text() or "" for p in r.pages).strip()

                elif ext in ("docx", "doc"):
                    from docx import Document as DocxDocument
                    doc = DocxDocument(abs_path)
                    raw_text = "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())

                elif ext in ("csv", "txt", "md"):
                    with open(abs_path, "r", encoding="utf-8", errors="ignore") as f:
                        raw_text = f.read().strip()

                elif ext in ("xlsx", "xls"):
                    import pandas as pd
                    df = pd.read_excel(abs_path)
                    raw_text = f"Dataset Columns: {list(df.columns)}\nTotal Rows: {len(df)}\nSample Data:\n{df.head(15).to_string()}"

            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    tool_id=self.id,
                    error=f"Could not extract text from document '{file_path}': {str(e)}"
                )

        if not raw_text:
            return ToolExecutionResult(
                success=False,
                tool_id=self.id,
                error="No text content provided for summarization. Provide 'text' or a valid 'file_path'."
            )

        # Word count
        original_words = len(raw_text.split())

        # Cap length to 25,000 words to stay safely within free-tier quotas and context
        if original_words > 25000:
            raw_text = " ".join(raw_text.split()[:25000])

        summary_type = params.get("summary_type") or "medium"
        extract_points = params.get("extract_key_points", True)
        action_items = params.get("generate_action_items", True)
        focus = params.get("focus")

        # 2. Build Gemini prompt
        system_instruction = (
            "You are an expert executive summarizer in AGENT.STUDIO. "
            "Analyze the provided document or text carefully and output a structured JSON response matching this exact schema:\n"
            "{\n"
            '  "summary": "Clear, concise summary text",\n'
            '  "key_points": ["Point 1", "Point 2", ...],\n'
            '  "action_items": ["Action 1", "Action 2", ...]\n'
            "}\n"
            "Respond ONLY with valid JSON, without any markdown code fences or conversational text."
        )

        user_prompt = f"Length Style: {summary_type}\n"
        if focus:
            user_prompt += f"Focus Topic: {focus}\n"
        user_prompt += f"Include Key Points: {extract_points}\n"
        user_prompt += f"Include Action Items: {action_items}\n\n"
        user_prompt += f"--- TEXT TO SUMMARIZE ---\n{raw_text}\n--- END TEXT ---"

        # 3. Call Gemini
        db = (context or {}).get("db")
        gemini_adapter = None

        if db:
            from app.services.llm.factory import get_llm_adapter
            try:
                gemini_adapter = get_llm_adapter("gemini", db)
            except Exception as e:
                logger.warning(f"Could not get DB adapter for Gemini: {e}")

        if not gemini_adapter:
            from app.core.config import settings
            from app.services.llm.gemini_adapter import GeminiAdapter
            api_key = settings.GEMINI_API_KEY
            if not api_key:
                return ToolExecutionResult(
                    success=False,
                    tool_id=self.id,
                    error="Google Gemini API key is not configured. Please set GEMINI_API_KEY in the Admin Portal or .env."
                )
            gemini_adapter = GeminiAdapter(api_key=api_key)

        try:
            llm_res = await gemini_adapter.generate(
                messages=[LLMMessage(role="user", content=user_prompt)],
                system_prompt=system_instruction,
                temperature=0.3,
                max_tokens=2048
            )
            raw_output = llm_res.content.strip()

            # Clean markdown codeblocks if returned
            if raw_output.startswith("```"):
                raw_output = raw_output.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            data = json.loads(raw_output)
            summary_text = data.get("summary", "")
            summary_words = len(summary_text.split())

            return ToolExecutionResult(
                success=True,
                tool_id=self.id,
                data={
                    "summary": summary_text,
                    "key_points": data.get("key_points", []) if extract_points else [],
                    "action_items": data.get("action_items", []) if action_items else [],
                    "original_word_count": original_words,
                    "summary_word_count": summary_words
                },
                output_preview=f"Summary ({summary_type}, {summary_words} words):\n{summary_text[:200]}..."
            )
        except json.JSONDecodeError:
            # Fallback if Gemini returned raw text instead of JSON
            return ToolExecutionResult(
                success=True,
                tool_id=self.id,
                data={
                    "summary": raw_output,
                    "key_points": [],
                    "action_items": [],
                    "original_word_count": original_words,
                    "summary_word_count": len(raw_output.split())
                },
                output_preview=f"Summary ({summary_type}):\n{raw_output[:200]}..."
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                tool_id=self.id,
                error=f"Gemini summarization failed: {str(e)}"
            )
