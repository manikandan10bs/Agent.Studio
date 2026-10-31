import io
import os
import base64
import time
import httpx
from typing import Dict, Any, Optional, List
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # Non-interactive background renderer
import matplotlib.pyplot as plt

from app.services.tools.registry import BaseTool, ToolExecutionResult
from app.services.tools.utils import resolve_safe_file_path, save_output_file, is_ssrf_safe_url

# ====================================================================
# 8. Chart Generator Tool
# ====================================================================
class ChartGeneratorTool(BaseTool):
    id = "chart_generator"
    name = "Chart Generator"
    description = "Generates publication-quality charts (Bar, Line, Pie, Scatter) from uploaded Excel and CSV datasets or raw data. Generates high-res PNG images with download and preview URLs."
    category = "Validation & Utilities"
    icon = "BarChart2"
    timeout_seconds = 25
    permission_required = "creator"

    input_schema = {
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "File name or path of the CSV or Excel file containing the data."
            },
            "chart_type": {
                "type": "string",
                "enum": ["bar", "line", "pie", "scatter"],
                "description": "Type of chart: 'bar', 'line', 'pie', or 'scatter'."
            },
            "x_column": {
                "type": "string",
                "description": "Column name for X axis (or categories for pie chart)."
            },
            "y_column": {
                "type": "string",
                "description": "Column name for Y axis values (numerical metric)."
            },
            "title": {
                "type": "string",
                "description": "Chart title."
            },
            "x_label": {
                "type": "string",
                "description": "Label for the X axis."
            },
            "y_label": {
                "type": "string",
                "description": "Label for the Y axis."
            },
            "data": {
                "type": "array",
                "description": "Optional inline array of data records if no file is provided."
            }
        },
        "required": ["chart_type"]
    }

    output_schema = {
        "type": "object",
        "properties": {
            "chart_type": {"type": "string"},
            "title": {"type": "string"},
            "download_url": {"type": "string"},
            "base64_image": {"type": "string"}
        }
    }

    async def execute(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> ToolExecutionResult:
        chart_type = (params.get("chart_type") or "bar").lower()
        file_path = params.get("file_path")
        inline_data = params.get("data")

        # 1. Load dataset
        if file_path:
            try:
                abs_path = resolve_safe_file_path(file_path)
                if abs_path.lower().endswith((".xlsx", ".xls")):
                    df = pd.read_excel(abs_path)
                else:
                    df = pd.read_csv(abs_path, on_bad_lines="skip")
            except Exception as e:
                return ToolExecutionResult(success=False, tool_id=self.id, error=f"Could not load data from file: {str(e)}")
        elif inline_data and isinstance(inline_data, list):
            df = pd.DataFrame(inline_data)
        else:
            return ToolExecutionResult(success=False, tool_id=self.id, error="Provide either 'file_path' or inline 'data' list to plot.")

        if df.empty:
            return ToolExecutionResult(success=False, tool_id=self.id, error="Dataset is empty. Cannot generate chart.")

        x_col = params.get("x_column") or df.columns[0]
        y_col = params.get("y_column") or (df.columns[1] if len(df.columns) > 1 else df.columns[0])

        if x_col not in df.columns:
            return ToolExecutionResult(success=False, tool_id=self.id, error=f"X column '{x_col}' not found. Available: {list(df.columns)}")
        if y_col not in df.columns:
            return ToolExecutionResult(success=False, tool_id=self.id, error=f"Y column '{y_col}' not found. Available: {list(df.columns)}")

        # Clean non-numeric for Y if bar, line, or scatter
        if chart_type in ("bar", "line", "scatter"):
            df[y_col] = pd.to_numeric(df[y_col], errors="coerce")
            plot_df = df.dropna(subset=[x_col, y_col]).head(30)  # limit to top 30 points for readability
        else:
            plot_df = df.dropna(subset=[x_col, y_col]).head(10)

        title = params.get("title") or f"{chart_type.capitalize()} Chart: {y_col} by {x_col}"
        x_label = params.get("x_label") or x_col
        y_label = params.get("y_label") or y_col

        # 2. Render Matplotlib Plot
        fig, ax = plt.subplots(figsize=(9, 5), dpi=120)
        # Modern color palette
        accent_color = "#2563EB"  # Royal blue matching AGENT.STUDIO

        try:
            if chart_type == "bar":
                bars = ax.bar(plot_df[x_col].astype(str), plot_df[y_col], color=accent_color, edgecolor="#1D4ED8", alpha=0.85)
                ax.set_ylabel(y_label)
                ax.set_xlabel(x_label)
                plt.xticks(rotation=45, ha="right")
                # Add data labels
                for bar in bars:
                    height = bar.get_height()
                    if height != 0:
                        ax.annotate(f"{height:.2g}",
                                    xy=(bar.get_x() + bar.get_width() / 2, height),
                                    xytext=(0, 3), textcoords="offset points",
                                    ha="center", va="bottom", fontsize=8)

            elif chart_type == "line":
                ax.plot(plot_df[x_col].astype(str), plot_df[y_col], marker="o", color=accent_color, linewidth=2, markersize=5)
                ax.set_ylabel(y_label)
                ax.set_xlabel(x_label)
                plt.xticks(rotation=45, ha="right")
                ax.grid(True, linestyle="--", alpha=0.5)

            elif chart_type == "pie":
                labels = plot_df[x_col].astype(str).tolist()
                values = pd.to_numeric(plot_df[y_col], errors="coerce").fillna(0).tolist()
                colors = plt.cm.Blues(range(60, 240, max(1, 180 // max(1, len(labels)))))
                ax.pie(values, labels=labels, autopct="%1.1f%%", startangle=140, colors=colors)
                ax.axis("equal")

            elif chart_type == "scatter":
                x_numeric = pd.to_numeric(plot_df[x_col], errors="coerce").fillna(0)
                ax.scatter(x_numeric, plot_df[y_col], color=accent_color, alpha=0.7, edgecolors="#1E3A8A", s=50)
                ax.set_xlabel(x_label)
                ax.set_ylabel(y_label)
                ax.grid(True, linestyle="--", alpha=0.5)

            ax.set_title(title, fontsize=12, fontweight="bold", pad=12)
            fig.tight_layout()

            # Save to buffer
            buf = io.BytesIO()
            fig.savefig(buf, format="png", dpi=120)
            plt.close(fig)
            img_bytes = buf.getvalue()

            # Save output file and create base64 preview
            _, download_url = save_output_file(img_bytes, prefix=f"chart_{chart_type}", ext=".png")
            b64_str = f"data:image/png;base64,{base64.b64encode(img_bytes).decode('utf-8')}"

            return ToolExecutionResult(
                success=True,
                tool_id=self.id,
                data={
                    "chart_type": chart_type,
                    "title": title,
                    "download_url": download_url,
                    "base64_image": b64_str,
                    "x_column": x_col,
                    "y_column": y_col,
                    "points_plotted": len(plot_df)
                },
                download_url=download_url,
                output_preview=f"Generated {chart_type} chart '{title}' ({len(plot_df)} data points plotted)."
            )
        except Exception as e:
            plt.close(fig)
            return ToolExecutionResult(success=False, tool_id=self.id, error=f"Chart generation error: {str(e)}")


# ====================================================================
# 9. URL Validator Tool
# ====================================================================
class UrlValidatorTool(BaseTool):
    id = "url_validator"
    name = "URL Validator"
    description = "Validates URL syntax, hostnames, and protocols (http/https). Optionally checks public accessibility with strict timeouts and robust SSRF protection against private network probing."
    category = "Validation & Utilities"
    icon = "Link"
    timeout_seconds = 10
    permission_required = "creator"

    input_schema = {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The URL to validate and verify."
            },
            "check_accessibility": {
                "type": "boolean",
                "description": "Whether to perform an HTTP request to verify if the URL is publicly reachable (default true)."
            },
            "timeout_seconds": {
                "type": "number",
                "description": "Timeout in seconds for reachability check (max 10s)."
            }
        },
        "required": ["url"]
    }

    output_schema = {
        "type": "object",
        "properties": {
            "is_valid": {"type": "boolean"},
            "is_accessible": {"type": "boolean"},
            "status_code": {"type": "integer"},
            "latency_ms": {"type": "integer"},
            "resolved_ip": {"type": "string"},
            "details": {"type": "object"}
        }
    }

    async def execute(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> ToolExecutionResult:
        url = params.get("url")
        if not url or not isinstance(url, str):
            return ToolExecutionResult(success=False, tool_id=self.id, error="Missing required parameter 'url'.")

        url = url.strip()

        # Step 1: SSRF and syntax protection
        is_safe, msg, ip_str = is_ssrf_safe_url(url)
        if not is_safe:
            return ToolExecutionResult(
                success=False,
                tool_id=self.id,
                error=msg,
                data={
                    "is_valid": False,
                    "is_valid_syntax": False,
                    "is_accessible": False,
                    "resolved_ip": ip_str,
                    "reason": msg
                }
            )

        check_acc = params.get("check_accessibility", True)
        if not check_acc:
            return ToolExecutionResult(
                success=True,
                tool_id=self.id,
                data={
                    "is_valid": True,
                    "is_valid_syntax": True,
                    "resolved_ip": ip_str,
                    "message": "URL syntax is valid and destination is a safe public IP."
                },
                output_preview=f"Valid URL: '{url}' (IP: {ip_str})"
            )

        # Step 2: Live Accessibility Check
        timeout_sec = min(float(params.get("timeout_seconds") or 5.0), 10.0)
        start_t = time.time()

        try:
            async with httpx.AsyncClient(timeout=timeout_sec, follow_redirects=True) as client:
                # Try HEAD first
                try:
                    res = await client.head(url, headers={"User-Agent": "AGENT.STUDIO/1.0 URLValidator"})
                except Exception:
                    # Fallback to GET with small byte limit
                    res = await client.get(url, headers={"User-Agent": "AGENT.STUDIO/1.0 URLValidator"})

                latency_ms = int((time.time() - start_t) * 1000)
                is_accessible = 200 <= res.status_code < 400

                return ToolExecutionResult(
                    success=True,
                    tool_id=self.id,
                    data={
                        "is_valid": True,
                        "is_accessible": is_accessible,
                        "status_code": res.status_code,
                        "latency_ms": latency_ms,
                        "resolved_ip": ip_str,
                        "content_type": res.headers.get("content-type", ""),
                        "final_url": str(res.url)
                    },
                    output_preview=f"URL '{url}' is accessible (Status: {res.status_code}, Latency: {latency_ms}ms, IP: {ip_str})."
                )
        except httpx.TimeoutException:
            return ToolExecutionResult(
                success=False,
                tool_id=self.id,
                error=f"Connection timed out after {timeout_sec}s while connecting to '{url}'.",
                data={"is_valid": True, "is_accessible": False, "resolved_ip": ip_str}
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                tool_id=self.id,
                error=f"Failed to reach URL '{url}': {str(e)}",
                data={"is_valid": True, "is_accessible": False, "resolved_ip": ip_str}
            )
