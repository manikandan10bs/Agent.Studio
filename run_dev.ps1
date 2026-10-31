# ===================================================
#     AGENT.STUDIO - Dual Dev Launcher (PowerShell)
# ===================================================
$WorkspaceRoot = $PSScriptRoot

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   Starting AGENT.STUDIO (Backend & Frontend)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Start Backend in a dedicated terminal window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$WorkspaceRoot\backend'; & '$WorkspaceRoot\venv\Scripts\Activate.ps1'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

# 2. Start Frontend in a dedicated terminal window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$WorkspaceRoot\frontend'; npm run dev"

Write-Host "`nBackend starting on:  http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Frontend starting on: http://localhost:5173" -ForegroundColor Green
Write-Host "Opening browser..." -ForegroundColor Yellow

Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"
