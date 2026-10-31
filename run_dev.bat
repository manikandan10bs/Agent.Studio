@echo off
title AGENT.STUDIO Launcher
echo ===================================================
echo    Starting AGENT.STUDIO (Backend & Frontend)
echo ===================================================

start "AGENT.STUDIO Backend (Port 8000)" cmd /k "cd /d %~dp0backend && ..\venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
start "AGENT.STUDIO Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Backend starting on:  http://127.0.0.1:8000
echo Frontend starting on: http://localhost:5173
timeout /t 3 /nobreak >nul
start http://localhost:5173
