@echo off
echo ===================================================
echo     AGENT.STUDIO - Unified Production Launcher
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Frontend Production Build...
if not exist "frontend\dist\index.html" (
    echo Building React Frontend for Production...
    cd frontend
    call npm run build
    cd ..
) else (
    echo Frontend production build is ready in frontend\dist!
)

echo.
echo [2/3] Checking Python Virtual Environment...
if exist "venv\Scripts\python.exe" (
    set "PYTHON_EXE=venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

echo.
echo [3/3] Starting Unified Production Server on http://localhost:8000 ...
echo - Frontend SPA & Assets: http://localhost:8000
echo - API Endpoints:        http://localhost:8000/api/v1
echo - API Documentation:    http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server.
echo ===================================================

cd backend
"%PYTHON_EXE%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
