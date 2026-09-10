#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  AegisVoice - Voice Deepfake & Call Defense Console"
echo "  Smart India Hackathon 2026 - Problem Statement 104"
echo "========================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Setup Python Virtual Environment if missing
if [ ! -f "backend/venv/bin/python" ]; then
    echo "[INFO] Python virtual environment not found. Setting up backend..."
    cd backend
    python3 -m venv venv || python -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    cd ..
fi

# 2. Setup Frontend dependencies if missing
if [ ! -d "frontend/node_modules" ]; then
    echo "[INFO] Frontend node_modules not found. Running npm install..."
    cd frontend
    npm install
    cd ..
fi

echo ""
echo "[1/2] Starting Backend API (FastAPI + Wav2Vec2 Pipeline)..."
(cd backend && source venv/bin/activate && uvicorn app:app --host 127.0.0.1 --port 8000 --reload) &
BACKEND_PID=$!

echo "[INFO] Waiting for backend to initialize..."
sleep 4

echo "[2/2] Starting Frontend Dashboard (Vite + React)..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "========================================================"
echo "  AegisVoice is RUNNING!"
echo "  Frontend Dashboard: http://localhost:5173"
echo "  Backend Swagger UI: http://127.0.0.1:8000/docs"
echo "========================================================"
echo "Press Ctrl+C to terminate both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait $BACKEND_PID $FRONTEND_PID

