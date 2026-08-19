Write-Host "Starting Tsukuyomi System..." -ForegroundColor Cyan
Write-Host "---------------------------------------"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start FastAPI Backend in a new window
Start-Process cmd -ArgumentList "/k cd /d `"$ScriptDir\backend`" && .\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

# Start Express Frontend in a new window
Start-Process cmd -ArgumentList "/k cd /d `"$ScriptDir`" && npm start"

Write-Host "`nTsukuyomi Services Started!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Backend:  http://localhost:8000`n" -ForegroundColor Yellow
