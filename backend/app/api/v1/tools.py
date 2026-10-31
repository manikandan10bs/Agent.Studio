import os
import json
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.models.user import User
from app.models.tool import SystemTool, ToolExecutionLog
from app.schemas.tool import ToolOut, ToolToggleRequest, ToolTestRequest, ToolExecutionResult
from app.api.deps import get_current_user, log_audit
from app.services.tools import registry
from app.services.tools.utils import OUTPUT_DIR, resolve_safe_file_path

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("", response_model=List[ToolOut])
def list_tools(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search by name or description"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List the 12 core tools with their admin-managed availability status.
    """
    db_tools = {st.id: st for st in db.query(SystemTool).all()}
    result = []

    for tool in registry.list_tools():
        db_record = db_tools.get(tool.id)
        is_enabled = db_record.is_enabled if db_record else True

        if category and tool.category.lower() != category.lower():
            continue
        if search:
            s = search.lower()
            if s not in tool.name.lower() and s not in tool.description.lower() and s not in tool.category.lower():
                continue

        result.append(ToolOut(
            id=tool.id,
            name=tool.name,
            description=tool.description,
            category=tool.category,
            icon=tool.icon,
            is_enabled=is_enabled,
            config_schema=tool.input_schema,
            created_at=db_record.created_at if db_record else None,
            updated_at=db_record.updated_at if db_record else None
        ))

    return result

@router.patch("/{tool_id}/toggle", response_model=ToolOut)
def toggle_tool_status(
    tool_id: str,
    toggle_req: ToolToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin-only endpoint to enable or disable a tool globally.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only platform administrators can enable or disable tools globally.")

    tool_def = registry.get(tool_id)
    if not tool_def:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_id}' not found.")

    st = db.query(SystemTool).filter(SystemTool.id == tool_id).first()
    if not st:
        st = SystemTool(
            id=tool_def.id,
            name=tool_def.name,
            description=tool_def.description,
            category=tool_def.category,
            icon=tool_def.icon,
            is_enabled=toggle_req.is_enabled,
            config_schema=json.dumps(tool_def.input_schema)
        )
        db.add(st)
    else:
        st.is_enabled = toggle_req.is_enabled

    db.commit()
    db.refresh(st)
    log_audit(db, "TOGGLE_TOOL", "tool", tool_id, user=current_user, details={"is_enabled": st.is_enabled})

    return ToolOut(
        id=tool_def.id,
        name=tool_def.name,
        description=tool_def.description,
        category=tool_def.category,
        icon=tool_def.icon,
        is_enabled=st.is_enabled,
        config_schema=tool_def.input_schema,
        created_at=st.created_at,
        updated_at=st.updated_at
    )

@router.post("/upload-test-file")
async def upload_tool_test_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a file to test document or data tools (CSV, XLSX, PDF, DOCX, JSON).
    """
    os.makedirs(settings.STORAGE_DIR, exist_ok=True)
    clean_name = os.path.basename(file.filename or "uploaded_test_file")
    saved_filename = f"test_{int(time.time())}_{clean_name}"
    file_path = os.path.join(settings.STORAGE_DIR, saved_filename)

    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds maximum allowable size of 25MB.")

    with open(file_path, "wb") as f:
        f.write(content)

    return {
        "filename": saved_filename,
        "original_filename": clean_name,
        "file_size": len(content),
        "file_path": file_path
    }

@router.post("/{tool_id}/test", response_model=ToolExecutionResult)
async def test_tool_execution(
    tool_id: str,
    test_req: ToolTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Execute a tool test directly from the Tools Marketplace or Agent Builder.
    """
    tool_def = registry.get(tool_id)
    if not tool_def:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_id}' not found.")

    st = db.query(SystemTool).filter(SystemTool.id == tool_id).first()
    if st and not st.is_enabled and current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail=f"Tool '{tool_def.name}' is currently disabled by the platform administrator."
        )

    context = {
        "db": db,
        "current_user": current_user,
        "is_test": True
    }

    result = await registry.execute_tool(tool_id, test_req.parameters, context=context)

    # Log execution
    log_entry = ToolExecutionLog(
        tool_id=tool_id,
        user_id=current_user.id,
        input_params_json=json.dumps(test_req.parameters, default=str)[:1000],
        output_summary_json=json.dumps(result.data or {}, default=str)[:1000] if result.success else None,
        execution_time_ms=result.execution_time_ms,
        status="success" if result.success else "failed",
        error_message=result.error
    )
    db.add(log_entry)
    db.commit()

    return result

@router.get("/download/{filename}")
def download_tool_output(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """
    Download a generated file (chart PNG, cleaned Excel, CSV).
    """
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid file path. Path traversal is not permitted.")

    clean_name = os.path.basename(filename)
    file_path = os.path.join(OUTPUT_DIR, clean_name)

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Requested file not found or has expired.")

    media_type = "application/octet-stream"
    if clean_name.endswith(".png"): media_type = "image/png"
    elif clean_name.endswith(".xlsx"): media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif clean_name.endswith(".csv"): media_type = "text/csv"
    elif clean_name.endswith(".json"): media_type = "application/json"

    return FileResponse(
        file_path,
        media_type=media_type,
        filename=clean_name
    )
