@echo off
echo Starting Vortex Prime Emu Dev Servers...

REM Start backend in new window
start "Vortex Backend" cmd /k "cd backend && python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload"

REM Wait for backend to initialize
timeout /t 3 /nobreak > nul

REM Start frontend (blocking)
cd frontend
npm start
