@echo off
echo Starting open_chat...

:: Backend (FastAPI on port 8000)
start "open_chat backend" cmd /k "cd /d %~dp0backend && set CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003 && set DATABASE_URL=sqlite:///./data/chat.db && set AUTH_SECRET=localdev && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

:: Give backend a moment to start
timeout /t 2 /nobreak > nul

:: Frontend (Next.js)
start "open_chat frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both services are starting:
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000  (or 3001/3002 if port is taken)
echo.
echo Close the two terminal windows to stop the app.
