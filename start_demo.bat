@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   Phonon - Voice Deepfake & Call Defense Console
echo   Team Phonon • Smart India Hackathon 2026 • PS 104
echo ========================================================

:: 1. Check Python Virtual Environment
if not exist "backend\venv\Scripts\python.exe" (
    echo [INFO] Python virtual environment not found. Setting up backend...
    cd backend
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment. Ensure Python 3.10+ is installed and on PATH.
        pause
        exit /b 1
    )
    echo [INFO] Installing backend dependencies...
    .\venv\Scripts\python.exe -m pip install --upgrade pip
    .\venv\Scripts\python.exe -m pip install -r requirements.txt
    cd ..
)

:: 2. Check Frontend Node Modules
if not exist "frontend\node_modules" (
    echo [INFO] Frontend node_modules not found. Running npm install...
    cd frontend
    call npm install
    cd ..
)

echo.
echo [1/2] Starting Backend API (FastAPI + Wav2Vec2 Pipeline)...
start "Phonon Backend API" cmd /k "cd backend && .\venv\Scripts\activate && uvicorn app:app --host 127.0.0.1 --port 8000 --reload"

echo [INFO] Waiting for backend API to initialize...
timeout /t 4 /nobreak >nul

echo [2/2] Starting Frontend Dashboard (Vite + React)...
start "Phonon Frontend Dashboard" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo   Phonon is RUNNING!
echo   Frontend Dashboard: http://localhost:5173
echo   Backend Swagger UI: http://127.0.0.1:8000/docs
echo ========================================================
echo.
