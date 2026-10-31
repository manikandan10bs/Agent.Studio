import re
import asyncio
import logging
from typing import Dict, Any, Optional, List
import httpx
from bs4 import BeautifulSoup

from app.services.tools.registry import BaseTool, ToolExecutionResult
from app.services.tools.utils import is_ssrf_safe_url

logger = logging.getLogger(__name__)

# ====================================================================
# Web Search Tool
# ====================================================================
class WebSearchTool(BaseTool):
    id = "web_search"
    name = "Web Search"
    description = "Searches the live web using query keywords to find up-to-date web pages, documentation, news, and references."
    category = "Web & Search"
    icon = "Search"
    timeout_seconds = 20
    permission_required = "creator"

    input_schema = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search keywords or question to look up on the web."
            },
            "max_results": {
                "type": "integer",
                "description": "Maximum number of search results to retrieve (default: 5, max: 10)."
            }
        },
        "required": ["query"]
    }

    output_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "total_results": {"type": "integer"},
            "results": {
                "type": "array",
                "items": {"type": "object"},
                "description": "List of search results containing title, url, and snippet."
            }
        }
    }

    async def execute(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> ToolExecutionResult:
        query = str(params.get("query", "")).strip()
        if not query:
            return ToolExecutionResult(
                success=False,
                tool_id=self.id,
                error="Parameter 'query' cannot be empty."
            )

        max_results = min(max(int(params.get("max_results", 5) or 5), 1), 10)
        results: List[Dict[str, str]] = []

        # 1. Try DDGS
        try:
            from ddgs import DDGS
            def _run_ddgs():
                with DDGS() as ddgs:
                    return list(ddgs.text(query, max_results=max_results))

            raw_results = await asyncio.to_thread(_run_ddgs)
            for item in raw_results:
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("href", ""),
                    "snippet": item.get("body", "")
                })
        except Exception as e:
            logger.warning(f"DDGS search failed: {e}. Attempting fallback...")

        # 2. Fallback to DuckDuckGo Instant API if DDGS returned nothing
        if not results:
            try:
                async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                    resp = await client.get(
                        "https://api.duckduckgo.com/",
                        params={"q": query, "format": "json", "no_html": "1", "skip_disambig": "0"},
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        abstract = data.get("AbstractText", "")
                        abstract_url = data.get("AbstractURL", "")
                        if abstract:
                            results.append({
                                "title": data.get("Heading", query),
                                "url": abstract_url or "https://duckduckgo.com/?q=" + query,
                                "snippet": abstract
                            })
                        for topic in data.get("RelatedTopics", [])[:max_results]:
                            if isinstance(topic, dict) and "Text" in topic:
                                results.append({
                                    "title": topic.get("FirstURL", "").split("/")[-1].replace("_", " ") or query,
                                    "url": topic.get("FirstURL", ""),
                                    "snippet": topic.get("Text", "")
                                })
            except Exception as e:
                logger.error(f"Fallback search failed: {e}")

        if not results:
            return ToolExecutionResult(
                success=True,
                tool_id=self.id,
                data={"query": query, "total_results": 0, "results": []},
                output_preview=f"No web results found for query: '{query}'."
            )

        preview_lines = [f"Web search results for '{query}':"]
        for idx, r in enumerate(results[:5], 1):
            preview_lines.append(f"{idx}. {r['title']} - {r['url']}\n   {r['snippet']}")

        return ToolExecutionResult(
            success=True,
            tool_id=self.id,
            data={
                "query": query,
                "total_results": len(results),
                "results": results[:max_results]
            },
            output_preview="\n\n".join(preview_lines)
        )


# ====================================================================
# Web Fetch Tool
# ====================================================================
class WebFetchTool(BaseTool):
    id = "web_fetch"
    name = "Web Fetch"
    description = "Fetches a web page by URL, parses HTML content, strips ads and scripts, and extracts readable text and metadata."
    category = "Web & Search"
    icon = "Globe"
    timeout_seconds = 20
    permission_required = "creator"

    input_schema = {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "Public HTTP or HTTPS website URL to fetch and extract content from."
            },
            "max_characters": {
                "type": "integer",
                "description": "Maximum characters of text content to return (default: 4000, max: 15000)."
            }
        },
        "required": ["url"]
    }

    output_schema = {
        "type": "object",
        "properties": {
            "url": {"type": "string"},
            "title": {"type": "string"},
            "content": {"type": "string"},
            "content_length": {"type": "integer"}
        }
    }

    async def execute(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> ToolExecutionResult:
        url = str(params.get("url", "")).strip()
        if not url:
            return ToolExecutionResult(
                success=False,
                tool_id=self.id,
                error="Parameter 'url' cannot be empty."
            )

        if not url.startswith("http://") and not url.startswith("https://"):
            url = f"https://{url}"

        # Enforce SSRF protection
        is_safe, msg, _ = is_ssrf_safe_url(url)
        if not is_safe:
            return ToolExecutionResult(
                success=False,
                tool_id=self.id,
                error=f"Security check failed: {msg}"
            )

        max_chars = min(max(int(params.get("max_characters", 4000) or 4000), 100), 15000)

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            }

            async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, verify=False) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code >= 400:
                    return ToolExecutionResult(
                        success=False,
                        tool_id=self.id,
                        error=f"Web server returned HTTP {resp.status_code}: {resp.reason_phrase}"
                    )

                html_content = resp.text

            # Parse HTML and extract clean text
            soup = BeautifulSoup(html_content, "html.parser")

            # Remove unwanted tags
            for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg", "form"]):
                tag.decompose()

            title = soup.title.string.strip() if soup.title and soup.title.string else ""

            # Extract body text
            text = soup.get_text(separator="\n")
            # Normalize whitespace
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            cleaned_text = "\n".join(lines)

            truncated = cleaned_text[:max_chars]
            if len(cleaned_text) > max_chars:
                truncated += f"\n... [Truncated at {max_chars} characters]"

            output_preview = f"Title: {title or 'Untitled Page'}\nURL: {url}\nLength: {len(cleaned_text)} characters\n\nPreview:\n{truncated[:500]}..."

            return ToolExecutionResult(
                success=True,
                tool_id=self.id,
                data={
                    "url": url,
                    "title": title or "Untitled",
                    "content": truncated,
                    "content_length": len(cleaned_text),
                    "status_code": resp.status_code
                },
                output_preview=output_preview
            )
        except Exception as e:
            logger.exception(f"Error fetching web page {url}: {e}")
            return ToolExecutionResult(
                success=False,
                tool_id=self.id,
                error=f"Failed to fetch content from {url}: {str(e)}"
            )
