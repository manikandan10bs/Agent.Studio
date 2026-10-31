import time
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class ToolExecutionResult(BaseModel):
    success: bool
    tool_id: str
    data: Optional[Any] = None
    error: Optional[str] = None
    execution_time_ms: int = 0
    download_url: Optional[str] = None
    output_preview: Optional[str] = None

class BaseTool(ABC):
    id: str
    name: str
    description: str
    category: str
    icon: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    timeout_seconds: int = 20
    permission_required: str = "creator"

    @abstractmethod
    async def execute(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> ToolExecutionResult:
        """Execute the tool function with the given parameters."""
        pass

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "icon": self.icon,
            "input_schema": self.input_schema,
            "output_schema": self.output_schema,
            "timeout_seconds": self.timeout_seconds,
            "permission_required": self.permission_required,
        }

    def to_gemini_declaration(self) -> Dict[str, Any]:
        """Convert input schema to Gemini function_declaration format."""
        schema_props = self.input_schema.get("properties", {})
        converted_props = {}
        for prop_name, prop_data in schema_props.items():
            prop_type = prop_data.get("type", "string").upper()
            if prop_type == "INT":
                prop_type = "INTEGER"
            elif prop_type == "FLOAT":
                prop_type = "NUMBER"
            elif prop_type == "DICT":
                prop_type = "OBJECT"
            elif prop_type == "LIST":
                prop_type = "ARRAY"
            
            p_dict = {
                "type": prop_type,
                "description": prop_data.get("description", prop_name)
            }
            if "enum" in prop_data:
                p_dict["enum"] = prop_data["enum"]
            converted_props[prop_name] = p_dict

        return {
            "name": self.id,
            "description": self.description,
            "parameters": {
                "type": "OBJECT",
                "properties": converted_props,
                "required": self.input_schema.get("required", [])
            }
        }

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}

    def register(self, tool: BaseTool):
        self._tools[tool.id] = tool
        logger.info(f"Registered tool: {tool.id} ({tool.name})")

    def get(self, tool_id: str) -> Optional[BaseTool]:
        return self._tools.get(tool_id)

    def get_tool(self, tool_id: str) -> Optional[BaseTool]:
        return self.get(tool_id)

    def list_tools(self) -> List[BaseTool]:
        return list(self._tools.values())

    def to_gemini_declarations(self, allowed_tool_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        declarations = []
        for tid, tool in self._tools.items():
            if allowed_tool_ids is None or tid in allowed_tool_ids:
                declarations.append(tool.to_gemini_declaration())
        return declarations

    async def execute_tool(
        self,
        tool_id: str,
        params: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> ToolExecutionResult:
        tool = self.get(tool_id)
        if not tool:
            return ToolExecutionResult(
                success=False,
                tool_id=tool_id,
                error=f"Tool '{tool_id}' not found in registry."
            )

        start = time.time()
        try:
            result = await asyncio.wait_for(
                tool.execute(params, context or {}),
                timeout=tool.timeout_seconds
            )
            result.execution_time_ms = int((time.time() - start) * 1000)
            return result
        except asyncio.TimeoutError:
            latency = int((time.time() - start) * 1000)
            return ToolExecutionResult(
                success=False,
                tool_id=tool_id,
                error=f"Execution timed out after {tool.timeout_seconds} seconds.",
                execution_time_ms=latency
            )
        except Exception as e:
            latency = int((time.time() - start) * 1000)
            logger.exception(f"Error executing tool {tool_id}: {str(e)}")
            return ToolExecutionResult(
                success=False,
                tool_id=tool_id,
                error=str(e),
                execution_time_ms=latency
            )

registry = ToolRegistry()
