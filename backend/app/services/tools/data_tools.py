import io
import re
import ast
import math
import operator
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, Any, Optional, List
import pandas as pd
from app.services.tools.registry import BaseTool, ToolExecutionResult
from app.services.tools.utils import resolve_safe_file_path, save_output_file

# ====================================================================
# Safe AST Calculator Engine
# ====================================================================
SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

SAFE_FUNCTIONS = {
    "abs": abs,
    "round": round,
    "sqrt": math.sqrt,
    "ceil": math.ceil,
    "floor": math.floor,
    "min": min,
    "max": max,
    "log": math.log,
    "log10": math.log10,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "pi": math.pi,
    "e": math.e,
}

def safe_eval_ast(node: ast.AST) -> float:
    if isinstance(node, ast.Constant):  # Numbers
        if isinstance(node.value, (int, float)):
            return node.value
        raise ValueError(f"Unsupported constant type: {type(node.value)}")

    elif isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in SAFE_OPERATORS:
            raise ValueError(f"Unsupported operator: {op_type.__name__}")
        left = safe_eval_ast(node.left)
        right = safe_eval_ast(node.right)
        if op_type in (ast.Div, ast.FloorDiv, ast.Mod) and right == 0:
            raise ZeroDivisionError("Division by zero in mathematical expression.")
        if op_type == ast.Pow and abs(right) > 1000:
            raise ValueError("Exponent too large (max power limit is 1000).")
        return SAFE_OPERATORS[op_type](left, right)

    elif isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in SAFE_OPERATORS:
            raise ValueError(f"Unsupported unary operator: {op_type.__name__}")
        return SAFE_OPERATORS[op_type](safe_eval_ast(node.operand))

    elif isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name):
            raise ValueError("Unsupported function call.")
        func_name = node.func.id.lower()
        if func_name not in SAFE_FUNCTIONS:
            raise ValueError(f"Function '{func_name}' is not permitted. Allowed: {list(SAFE_FUNCTIONS.keys())}")
        fn = SAFE_FUNCTIONS[func_name]
        if not callable(fn):
            raise ValueError(f"'{func_name}' is a constant, not a function.")
        args = [safe_eval_ast(arg) for arg in node.args]
        return fn(*args)

    elif isinstance(node, ast.Name):
        name = node.id.lower()
        if name in ("pi", "e"):
            return SAFE_FUNCTIONS[name]
        raise ValueError(f"Variable '{node.id}' is undefined.")

    raise ValueError(f"Unsupported expression element: {type(node).__name__}")


# ====================================================================
# 6. Calculator Tool
# ====================================================================
class CalculatorTool(BaseTool):
    id = "calculator"
    name = "Calculator"
    description = "Computes mathematical expressions securely without unrestricted eval. Supports addition, subtraction, multiplication, division, percentages, exponents, roots, and common math functions."
    category = "Data Utilities"
    icon = "Calculator"
    timeout_seconds = 5
    permission_required = "creator"

    input_schema = {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "Mathematical expression (e.g. '250 * 1.4', '(350 - 250) / 250 * 100', 'sqrt(144) + 15%', '2 ^ 8')."
            }
        },
        "required": ["expression"]
    }

    output_schema = {
        "type": "object",
        "properties": {
            "expression": {"type": "string"},
            "result": {"type": "number"},
            "formatted": {"type": "string"}
        }
    }

    async def execute(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> ToolExecutionResult:
        expr = params.get("expression")
        if not expr or not isinstance(expr, str) or not expr.strip():
            return ToolExecutionResult(success=False, tool_id=self.id, error="Missing required parameter 'expression'.")

        raw_expr = expr.strip()

        # Preprocessing: convert ^ to ** for power
        processed = raw_expr.replace("^", "**")

        # Convert percentages like 15% to (15/100.0) and "of" to *
        processed = re.sub(r'\bof\b', '*', processed, flags=re.IGNORECASE)
        processed = re.sub(r'(\d+(?:\.\d+)?)\s*%', r'(\1 / 100.0)', processed)

        # Disallow dangerous substrings
        for bad in ["__", "import", "eval", "exec", "open", "os", "sys", "class", "globals", "locals"]:
            if bad in processed.lower():
                return ToolExecutionResult(success=False, tool_id=self.id, error="Security violation: Forbidden keyword in expression.")

        try:
            tree = ast.parse(processed, mode="eval")
            calc_result = safe_eval_ast(tree.body)

            # Format result
            if isinstance(calc_result, float) and calc_result.is_integer():
                formatted_res = str(int(calc_result))
            elif isinstance(calc_result, float):
                formatted_res = f"{round(calc_result, 6):.6g}"
            else:
                formatted_res = str(calc_result)

            return ToolExecutionResult(
                success=True,
                tool_id=self.id,
                data={
                    "expression": raw_expr,
                    "result": calc_result,
                    "formatted": formatted_res
                },
                output_preview=f"Result: {raw_expr} = {formatted_res}"
            )
        except ZeroDivisionError:
            return ToolExecutionResult(success=False, tool_id=self.id, error="Calculation error: Division by zero.")
        except Exception as e:
            return ToolExecutionResult(success=False, tool_id=self.id, error=f"Invalid mathematical expression: {str(e)}")


# ====================================================================
# 7. Date & Time Tool
# ====================================================================
class DateTimeTool(BaseTool):
    id = "datetime_tool"
    name = "Date & Time"
    description = "Provides current date/time, calculates date differences, adds/subtracts time units, formats timestamps, and performs timezone conversions using zoneinfo."
    category = "Data Utilities"
    icon = "Clock"
    timeout_seconds = 5
    permission_required = "creator"

    input_schema = {
        "type": "object",
        "properties": {
            "operation": {
                "type": "string",
                "enum": ["current_time", "difference", "add_subtract", "convert_timezone"],
                "description": "Operation: 'current_time', 'difference', 'add_subtract', or 'convert_timezone'."
            },
            "date1": {
                "type": "string",
                "description": "Base date/time string (e.g. '2026-10-31', '2026-10-31 15:30:00')."
            },
            "date2": {
                "type": "string",
                "description": "Comparison date/time string (for 'difference')."
            },
            "amount": {
                "type": "number",
                "description": "Number of units to add or subtract (e.g. 5, -3)."
            },
            "unit": {
                "type": "string",
                "enum": ["days", "hours", "minutes", "weeks"],
                "description": "Time unit: 'days', 'hours', 'minutes', or 'weeks'."
            },
            "direction": {
                "type": "string",
                "enum": ["add", "subtract"],
                "description": "Direction for calculation: 'add' or 'subtract'."
            },
            "from_timezone": {
                "type": "string",
                "description": "Source timezone name (e.g. 'UTC', 'America/New_York', 'Asia/Kolkata')."
            },
            "to_timezone": {
                "type": "string",
                "description": "Target timezone name for conversion."
            }
        }
    }

    output_schema = {
        "type": "object",
        "properties": {
            "operation": {"type": "string"},
            "result": {"type": "string"},
            "details": {"type": "object"}
        }
    }

    def _parse_date(self, s: str, tz_name: Optional[str] = None) -> datetime:
        s = s.strip()
        tz = ZoneInfo(tz_name) if tz_name else timezone.utc
        
        # Try fromisoformat
        try:
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=tz)
            return dt
        except Exception:
            pass

        # Try common formats
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"):
            try:
                dt = datetime.strptime(s, fmt)
                return dt.replace(tzinfo=tz)
            except ValueError:
                continue

        raise ValueError(f"Could not parse date string '{s}'. Supported formats: YYYY-MM-DD, YYYY-MM-DD HH:MM:SS.")

    async def execute(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> ToolExecutionResult:
        op_raw = (params.get("operation") or "current_time").lower()
        if op_raw in ("now", "current_time", "current"):
            op = "current_time"
        elif op_raw in ("diff", "difference", "compare"):
            op = "difference"
        elif op_raw in ("add_subtract", "add", "subtract", "calculate"):
            op = "add_subtract"
        elif op_raw in ("convert_timezone", "convert_tz", "timezone"):
            op = "convert_timezone"
        else:
            op = op_raw

        # 1. Current Time
        if op == "current_time":
            tz_str = params.get("timezone") or params.get("to_timezone") or params.get("from_timezone") or "UTC"
            try:
                tz = ZoneInfo(tz_str)
            except Exception:
                tz = timezone.utc
                tz_str = "UTC"

            now = datetime.now(tz)
            return ToolExecutionResult(
                success=True,
                tool_id=self.id,
                data={
                    "timezone": tz_str,
                    "iso": now.isoformat(),
                    "formatted": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
                    "date": now.strftime("%Y-%m-%d"),
                    "time": now.strftime("%H:%M:%S"),
                    "day_of_week": now.strftime("%A")
                },
                output_preview=f"Current time in {tz_str}: {now.strftime('%Y-%m-%d %H:%M:%S %Z')} ({now.strftime('%A')})"
            )

        # 2. Difference
        if op == "difference":
            d1_str = params.get("date1")
            d2_str = params.get("date2")
            if not d1_str or not d2_str:
                return ToolExecutionResult(success=False, tool_id=self.id, error="Missing 'date1' or 'date2' for difference.")

            try:
                dt1 = self._parse_date(d1_str)
                dt2 = self._parse_date(d2_str)
            except Exception as e:
                return ToolExecutionResult(success=False, tool_id=self.id, error=str(e))

            diff = dt2 - dt1
            total_seconds = int(diff.total_seconds())
            days = diff.days
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60

            return ToolExecutionResult(
                success=True,
                tool_id=self.id,
                data={
                    "date1": dt1.isoformat(),
                    "date2": dt2.isoformat(),
                    "days": days,
                    "days_difference": abs(days),
                    "total_hours": hours,
                    "total_minutes": total_seconds // 60,
                    "total_seconds": total_seconds
                },
                output_preview=f"Difference between {d1_str} and {d2_str}: {abs(days)} days ({abs(hours)} hours)."
            )

        # 3. Add / Subtract
        if op == "add_subtract":
            d1_str = params.get("date1") or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            amount = params.get("amount")
            unit = (params.get("unit") or "days").lower()
            if amount is None:
                if "days" in params:
                    amount = params["days"]
                    unit = "days"
                elif "hours" in params:
                    amount = params["hours"]
                    unit = "hours"
                else:
                    amount = 0
            direction = (params.get("direction") or "add").lower()

            try:
                dt1 = self._parse_date(d1_str)
            except Exception as e:
                return ToolExecutionResult(success=False, tool_id=self.id, error=str(e))

            multiplier = -1 if direction == "subtract" else 1
            delta = timedelta()
            if unit == "days": delta = timedelta(days=amount * multiplier)
            elif unit == "hours": delta = timedelta(hours=amount * multiplier)
            elif unit == "minutes": delta = timedelta(minutes=amount * multiplier)
            elif unit == "weeks": delta = timedelta(weeks=amount * multiplier)
            else:
                return ToolExecutionResult(success=False, tool_id=self.id, error=f"Unsupported unit '{unit}'. Use days, hours, minutes, weeks.")

            new_dt = dt1 + delta
            formatted_res = new_dt.strftime("%Y-%m-%d") if (" " not in d1_str and "T" not in d1_str) else new_dt.isoformat()
            return ToolExecutionResult(
                success=True,
                tool_id=self.id,
                data={
                    "original_date": dt1.isoformat(),
                    "operation": f"{direction} {amount} {unit}",
                    "result_date": formatted_res,
                    "iso": new_dt.isoformat(),
                    "formatted": new_dt.strftime("%Y-%m-%d %H:%M:%S %Z")
                },
                output_preview=f"{direction.capitalize()}ed {amount} {unit} to {d1_str} -> {new_dt.strftime('%Y-%m-%d %H:%M:%S')}"
            )

        # 4. Convert Timezone
        if op == "convert_timezone":
            d1_str = params.get("date1") or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            from_tz = params.get("from_timezone") or "UTC"
            to_tz = params.get("to_timezone") or "UTC"

            try:
                dt1 = self._parse_date(d1_str, from_tz)
                target_tz = ZoneInfo(to_tz)
                converted = dt1.astimezone(target_tz)
            except Exception as e:
                return ToolExecutionResult(success=False, tool_id=self.id, error=f"Timezone conversion failed: {str(e)}")

            return ToolExecutionResult(
                success=True,
                tool_id=self.id,
                data={
                    "from_timezone": from_tz,
                    "to_timezone": to_tz,
                    "original": dt1.strftime("%Y-%m-%d %H:%M:%S %Z"),
                    "converted": converted.strftime("%Y-%m-%d %H:%M:%S %Z"),
                    "converted_iso": converted.isoformat()
                },
                output_preview=f"Converted {d1_str} from {from_tz} to {to_tz}: {converted.strftime('%Y-%m-%d %H:%M:%S %Z')}"
            )

        return ToolExecutionResult(success=False, tool_id=self.id, error=f"Unknown datetime operation '{op}'.")


# ====================================================================
# 10. Data Cleaner Tool
# ====================================================================
class DataCleanerTool(BaseTool):
    id = "data_cleaner"
    name = "Data Cleaner"
    description = "Cleans and standardizes tabular datasets (CSV / Excel). Identifies missing values, removes duplicates, normalizes whitespace, standardizes column headers, and exports cleaned files."
    category = "Data Processing"
    icon = "Sparkles"
    timeout_seconds = 30
    permission_required = "creator"

    input_schema = {
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "File name or path of the CSV or Excel file to clean."
            },
            "remove_duplicates": {
                "type": "boolean",
                "description": "Remove duplicate rows (default true)."
            },
            "fill_missing": {
                "type": "string",
                "enum": ["none", "drop", "zero", "mean"],
                "description": "Strategy for missing values: 'none', 'drop' (drop rows), 'zero', or 'mean'."
            },
            "normalize_whitespace": {
                "type": "boolean",
                "description": "Trim leading/trailing spaces and collapse internal multiple spaces in text (default true)."
            },
            "standardize_column_names": {
                "type": "boolean",
                "description": "Convert column names to lower_snake_case and strip special characters (default true)."
            }
        },
        "required": ["file_path"]
    }

    output_schema = {
        "type": "object",
        "properties": {
            "rows_before": {"type": "integer"},
            "rows_after": {"type": "integer"},
            "duplicates_removed": {"type": "integer"},
            "missing_values_handled": {"type": "object"},
            "preview": {"type": "array"},
            "download_url": {"type": "string"}
        }
    }

    async def execute(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> ToolExecutionResult:
        file_path = params.get("file_path")
        csv_content = params.get("csv_content") or params.get("content")

        if not file_path and not csv_content:
            return ToolExecutionResult(success=False, tool_id=self.id, error="Missing required parameter 'file_path' or 'csv_content'.")

        is_excel = False
        try:
            if file_path:
                abs_path = resolve_safe_file_path(file_path)
                is_excel = abs_path.lower().endswith((".xlsx", ".xls"))
                if is_excel:
                    df = pd.read_excel(abs_path)
                else:
                    df = pd.read_csv(abs_path, on_bad_lines="skip")
            else:
                df = pd.read_csv(io.StringIO(csv_content), on_bad_lines="skip")
        except Exception as e:
            return ToolExecutionResult(success=False, tool_id=self.id, error=f"Could not read dataset: {str(e)}")

        rows_before = len(df)
        cols_before = list(df.columns.astype(str))

        # Count missing before
        missing_counts = df.isnull().sum().to_dict()

        # 1. Remove duplicates
        if params.get("remove_duplicates", True):
            df = df.drop_duplicates()
        duplicates_removed = rows_before - len(df)

        # 2. Normalize whitespace in string columns
        if params.get("normalize_whitespace", True):
            for col in df.select_dtypes(include=["object"]).columns:
                df[col] = df[col].astype(str).str.strip().replace(r'\s+', ' ', regex=True)

        # 3. Handle missing values
        fill_strategy = (params.get("fill_missing") or "none").lower()
        if fill_strategy == "drop":
            df = df.dropna()
        elif fill_strategy == "zero":
            for col in df.select_dtypes(include=["number"]).columns:
                df[col] = df[col].fillna(0)
            df = df.fillna("")
        elif fill_strategy == "mean":
            for col in df.select_dtypes(include=["number"]).columns:
                mean_val = df[col].mean()
                df[col] = df[col].fillna(mean_val)
            df = df.fillna("")

        # 4. Standardize column names
        renamed_cols = {}
        if params.get("standardize_column_names", True):
            new_cols = []
            for c in df.columns:
                std = re.sub(r'[^a-zA-Z0-9]+', '_', str(c).strip().lower()).strip('_')
                new_cols.append(std or "col")
            df.columns = new_cols
            renamed_cols = dict(zip(cols_before, new_cols))

        # Export cleaned file
        out_buf = io.BytesIO()
        ext = ".xlsx" if is_excel else ".csv"
        if is_excel:
            df.to_excel(out_buf, index=False, engine="openpyxl")
        else:
            df.to_csv(out_buf, index=False)

        _, download_url = save_output_file(out_buf.getvalue(), prefix="cleaned_dataset", ext=ext)

        preview = f"Cleaned dataset: {rows_before} -> {len(df)} rows. {duplicates_removed} duplicate(s) removed. Missing handled: {fill_strategy}."
        return ToolExecutionResult(
            success=True,
            tool_id=self.id,
            data={
                "rows_before": rows_before,
                "rows_after": len(df),
                "original_row_count": rows_before,
                "cleaned_row_count": len(df),
                "duplicates_removed": duplicates_removed,
                "missing_values_detected": missing_counts,
                "columns": list(df.columns),
                "column_mappings": renamed_cols,
                "preview": df.head(10).to_dict(orient="records"),
                "download_url": download_url
            },
            download_url=download_url,
            output_preview=preview
        )


# ====================================================================
# 11. Duplicate Finder Tool
# ====================================================================
class DuplicateFinderTool(BaseTool):
    id = "duplicate_finder"
    name = "Duplicate Finder"
    description = "Scans datasets for duplicate rows or duplicates across selected columns. Computes duplicate percentages and exports duplicates and unique records separately."
    category = "Data Processing"
    icon = "Copy"
    timeout_seconds = 25
    permission_required = "creator"

    input_schema = {
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "File name or path of the CSV or Excel file."
            },
            "columns": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional list of column names to check for duplicates (defaults to all columns)."
            }
        },
        "required": ["file_path"]
    }

    output_schema = {
        "type": "object",
        "properties": {
            "total_rows": {"type": "integer"},
            "duplicate_count": {"type": "integer"},
            "unique_count": {"type": "integer"},
            "duplicate_percentage": {"type": "number"},
            "duplicate_download_url": {"type": "string"},
            "unique_download_url": {"type": "string"}
        }
    }

    async def execute(self, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> ToolExecutionResult:
        file_path = params.get("file_path")
        csv_content = params.get("csv_content") or params.get("content")
        if not file_path and not csv_content:
            return ToolExecutionResult(success=False, tool_id=self.id, error="Missing required parameter 'file_path' or 'csv_content'.")

        is_excel = False
        try:
            if file_path:
                abs_path = resolve_safe_file_path(file_path)
                is_excel = abs_path.lower().endswith((".xlsx", ".xls"))
                if is_excel:
                    df = pd.read_excel(abs_path)
                else:
                    df = pd.read_csv(abs_path, on_bad_lines="skip")
            else:
                df = pd.read_csv(io.StringIO(csv_content), on_bad_lines="skip")
        except Exception as e:
            return ToolExecutionResult(success=False, tool_id=self.id, error=f"Could not read dataset: {str(e)}")

        subset = params.get("columns")
        valid_subset = None
        if subset and isinstance(subset, list):
            valid_subset = [c for c in subset if c in df.columns]

        dup_mask = df.duplicated(subset=valid_subset, keep=False)
        duplicates_df = df[dup_mask]
        uniques_df = df.drop_duplicates(subset=valid_subset, keep="first")

        total = len(df)
        dup_count = len(df[df.duplicated(subset=valid_subset, keep="first")])
        pct = round((dup_count / total * 100), 2) if total > 0 else 0.0

        # Export duplicates file
        ext = ".xlsx" if is_excel else ".csv"
        dup_buf = io.BytesIO()
        uniq_buf = io.BytesIO()

        if is_excel:
            duplicates_df.to_excel(dup_buf, index=False, engine="openpyxl")
            uniques_df.to_excel(uniq_buf, index=False, engine="openpyxl")
        else:
            duplicates_df.to_csv(dup_buf, index=False)
            uniques_df.to_csv(uniq_buf, index=False)

        _, dup_url = save_output_file(dup_buf.getvalue(), prefix="duplicate_records", ext=ext)
        _, uniq_url = save_output_file(uniq_buf.getvalue(), prefix="unique_records", ext=ext)

        preview = f"Found {dup_count} duplicate rows ({pct}%) out of {total} total records."
        return ToolExecutionResult(
            success=True,
            tool_id=self.id,
            data={
                "total_rows": total,
                "duplicate_count": dup_count,
                "duplicate_row_count": dup_count,
                "unique_count": len(uniques_df),
                "unique_record_count": len(uniques_df),
                "duplicate_percentage": pct,
                "checked_columns": valid_subset or list(df.columns),
                "duplicate_preview": duplicates_df.head(10).to_dict(orient="records"),
                "duplicates_download_url": dup_url,
                "uniques_download_url": uniq_url
            },
            download_url=dup_url,
            output_preview=preview
        )
