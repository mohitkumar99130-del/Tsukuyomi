@echo off
echo Starting Tsukuyomi System...
echo ---------------------------------------

REM Start FastAPI Backend
start "Tsukuyomi Backend (FastAPI)" cmd /k "cd /d %~dp0backend && .\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

REM Start Express Frontend
start "Tsukuyomi Frontend (Express)" cmd /k "cd /d %~dp0 && npm start"

echo.
echo Tsukuyomi Services Started!
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000
echo.

