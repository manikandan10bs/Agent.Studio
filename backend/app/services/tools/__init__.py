from app.services.tools.registry import registry, BaseTool, ToolExecutionResult
from app.services.tools.document_tools import (
    PdfExtractorTool,
    DocxReaderTool,
    ExcelProcessorTool,
    CsvProcessorTool,
    JsonParserTool,
)
from app.services.tools.data_tools import (
    CalculatorTool,
    DateTimeTool,
    DataCleanerTool,
    DuplicateFinderTool,
)
from app.services.tools.utility_tools import (
    ChartGeneratorTool,
    UrlValidatorTool,
)
from app.services.tools.ai_tools import (
    TextSummarizerTool,
)
from app.services.tools.web_tools import (
    WebSearchTool,
    WebFetchTool,
)

# Register the Tools
CORE_TOOLS = [
    # 1. Documents & Files
    PdfExtractorTool(),
    DocxReaderTool(),
    ExcelProcessorTool(),
    CsvProcessorTool(),
    JsonParserTool(),
    # 2. Data Processing
    DataCleanerTool(),
    DuplicateFinderTool(),
    # 3. Data Utilities
    CalculatorTool(),
    DateTimeTool(),
    # 4. Validation & Utilities
    ChartGeneratorTool(),
    UrlValidatorTool(),
    # 5. Web & Search
    WebSearchTool(),
    WebFetchTool(),
    # 6. Gemini AI Tools
    TextSummarizerTool(),
]

for tool in CORE_TOOLS:
    registry.register(tool)

__all__ = [
    "registry",
    "BaseTool",
    "ToolExecutionResult",
    "CORE_TOOLS",
]
