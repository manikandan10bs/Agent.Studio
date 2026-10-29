# ===================================================
#     AGENT.STUDIO - Unified Production Launcher (PS1)
# ===================================================

$WorkspaceRoot = $PSScriptRoot
Set-Location $WorkspaceRoot

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "    AGENT.STUDIO - Unified Production Server" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# Step 1: Check Frontend
Write-Host "`n[1/3] Checking Frontend Production Build..." -ForegroundColor Yellow
if (-not (Test-Path "$WorkspaceRoot\frontend\dist\index.html")) {
    Write-Host "Building React Frontend for Production..." -ForegroundColor White
    Set-Location "$WorkspaceRoot\frontend"
    npm run build
    Set-Location $WorkspaceRoot
} else {
    Write-Host "Frontend production build is up to date in frontend\dist." -ForegroundColor Green
}

# Step 2: Check Python venv
Write-Host "`n[2/3] Checking Python Virtual Environment..." -ForegroundColor Yellow
$PythonExe = "python"
if (Test-Path "$WorkspaceRoot\venv\Scripts\python.exe") {
    $PythonExe = "$WorkspaceRoot\venv\Scripts\python.exe"
}
Write-Host "Using Python: $PythonExe" -ForegroundColor Green

# Step 3: Run Server
Write-Host "`n[3/3] Starting Unified Production Server on http://localhost:8000 ..." -ForegroundColor Cyan
Write-Host "- Frontend SPA:       http://localhost:8000" -ForegroundColor White
Write-Host "- Public Gallery:     http://localhost:8000/explore" -ForegroundColor White
Write-Host "- API Endpoints:      http://localhost:8000/api/v1" -ForegroundColor White
Write-Host "- Interactive Docs:   http://localhost:8000/docs" -ForegroundColor White
Write-Host "`nPress Ctrl+C to stop the server.`n" -ForegroundColor DarkGray

Set-Location "$WorkspaceRoot\backend"
& $PythonExe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
