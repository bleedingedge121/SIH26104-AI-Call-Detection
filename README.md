# SIH26104-AI-Call-Detection

> **Smart India Hackathon 2026 • Problem Statement 104**  
> **Advanced Neural & Spectral Deepfake Detection System**  
> **AegisVoice AI — Biometric Anti-Spoofing & Call Defense Console**

A full-stack, real-time voice anti-spoofing and deepfake call defense system. AegisVoice pairs a **fine-tuned Wav2Vec2 neural speech classification pipeline** with **multi-window temporal scanning** and **signal-level acoustic telemetry (MFCC & Spectral Centroid Variance)**, connected to an industrial cybersecurity console built with **React + Vite**.

---

## ⚡ 1-Click Launch

Clone and start the complete application (both Backend API and Frontend Console) in a single command:

### Windows:
```cmd
start_demo.bat
```
*(Automatically verifies Python virtual environment, installs missing dependencies, starts the FastAPI server, boots Vite, and opens the console).*

### macOS / Linux:
```bash
chmod +x start_demo.sh
./start_demo.sh
```

- **Frontend Console:** [http://localhost:5173](http://localhost:5173)  
- **Backend Swagger API:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)  
- **Health Endpoint:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

## 🏗️ Repository Structure

```
SIH26104-AI-Call-Detection/
├── start_demo.bat                      # 1-Click launcher for Windows
├── start_demo.sh                       # 1-Click launcher for macOS / Linux
├── .gitignore                          # Root gitignore
├── README.md                           # Documentation & architecture guide
├── LICENSE                             # MIT License
│
├── backend/                            # Python FastAPI Backend
│   ├── app.py                          # FastAPI production server with /score and /health
│   ├── infer.py                        # Standalone CLI inference tool
│   ├── test_api.py                     # Automated integration test suite (5 tests)
│   ├── verify_live_api.py              # Live end-to-end benchmark dataset verification suite
│   ├── requirements.txt                # Python dependencies (PyTorch, Transformers, Librosa)
│   ├── sample.wav                      # Bundled synthetic clone audio benchmark
│   ├── sample2.wav                     # Bundled authentic speech audio benchmark
│   ├── demo_samples/                   # Reference benchmark samples
│   │   ├── genuine_human_speech.wav    # Ground-truth authentic speech
│   │   └── synthetic_voice_clone.wav   # Ground-truth AI voice clone
│   ├── main.py                         # ASVspoof training/evaluation pipeline
│   ├── models/                         # AASIST, RawNet2, and RawGAT-ST architectures
│   └── config/                         # Architecture configurations
│
└── frontend/                           # React + Vite Security Console
    ├── index.html                      # Entry point
    ├── vite.config.js                  # Vite bundler configuration
    ├── package.json                    # Node dependencies (Lucide-React, etc.)
    ├── public/
    │   └── samples/                    # Quick-test benchmark audio clips
    │       ├── sample_real.wav         # Authentic human voice slice
    │       └── sample_spoof.wav        # Cloned deepfake audio slice
    └── src/
        ├── App.jsx                     # AegisVoice Security Operations Console
        ├── main.jsx                    # React entry point
        └── index.css                   # Industrial dark cybersecurity theme
```

---

## 🔬 Core Detection Architecture

AegisVoice employs a layered defense approach designed specifically for live call fraud and voice spoofing:

1. **Neural Feature Extraction & Classification**:
   - Model: `MelodyMachine/Deepfake-audio-detection-V2` (~94.6M parameters).
   - Backbone: Pretrained Wav2Vec2 fine-tuned specifically for binary discrimination between genuine human speech and synthetic/cloned speech.
   - Execution: Direct softmax projection with deterministic tensor indexing (`Logit 0 = Real`, `Logit 1 = Fake`). Fully runnable on both CPU and CUDA-enabled GPUs.
   - Offline Caching: On first run, model weights download directly from Hugging Face and cache locally to `~/.cache/huggingface/hub/`, allowing 100% offline air-gapped demo execution.

2. **Multi-Window Temporal Scanning**:
   - Scammers frequently attempt evasion by speaking normally for the first few seconds before switching to an AI-cloned voice.
   - AegisVoice automatically divides incoming recordings into uniform temporal windows (up to 8 windows across the recording duration).
   - If any window exhibits severe synthetic probability ($\ge 85\%$), the call is escalated to **CRITICAL** threat status.

3. **Auxiliary Acoustic Telemetry (Explainability)**:
   - Extracts **MFCC Variance** and **Spectral Centroid Variance** to expose vocoder artifacts, unnatural harmonics, and spectral discontinuities characteristic of generative TTS models (e.g. ElevenLabs, VITS, Bark).

---

## 🚀 Manual Step-by-Step Setup

If you prefer to run the backend and frontend separately in dedicated terminals:

### 1. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Start FastAPI server
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```

---

## 🧪 Verification & Benchmark Testing

AegisVoice includes comprehensive automated test suites to ensure 100% reproducible results across any environment:

### A. Automated Integration Tests
```bash
cd backend
python test_api.py
```
*Validates `/health`, `/` root metadata, real audio ingestion, fake audio detection, and corrupt file rejection.*

### B. Live Benchmark Dataset Verification
```bash
cd backend
python verify_live_api.py
```
*Executes full-spectrum HTTP multipart tests against the live API across all bundled benchmark files (and external test datasets if present on the machine), outputting a complete accuracy report.*

### C. Standalone CLI Inference
You can analyze any audio file directly from the terminal without running the browser:
```bash
cd backend

# Test Authentic Human Speech (Result: 0.0 Risk, SAFE, Real):
python infer.py demo_samples/genuine_human_speech.wav

# Test Synthetic AI Voice Clone (Result: 92.9 Risk, CRITICAL, Fake):
python infer.py demo_samples/synthetic_voice_clone.wav
```

---

## 📡 API Specification

### `GET /health`
Returns service and model runtime status.
```json
{
  "status": "HEALTHY",
  "model": "MelodyMachine/Deepfake-audio-detection-V2",
  "model_loaded": true
}
```

### `POST /score`
Analyzes an uploaded audio file for biometric spoofing and call fraud.

**Request:** `multipart/form-data` with key `file` (`.wav`, `.mp3`, `.flac`, `.ogg`, `.m4a`)

**Response Example:**
```json
{
  "filename": "sample_real.wav",
  "risk_score": 0.0,
  "status": "SAFE",
  "spectral_analysis": {
    "mfcc_variance": 623.19,
    "centroid_variance": 90711.36
  },
  "recommendation": "Allow transaction",
  "model_prediction": "real",
  "model_confidence": 1.0,
  "fake_probability": 0.0,
  "real_probability": 1.0,
  "windows_analyzed": 1
}
```

**Risk Thresholds:**
| Status | Risk Score | Recommended Action |
|--------|------------|--------------------|
| `SAFE` | 0 – 40 | Allow transaction / call |
| `SUSPICIOUS` | 41 – 70 | Require Secondary Verification (OTP / Biometric step-up) |
| `CRITICAL` | 71 – 100 | Block transaction / Terminate call |

---

## 🎯 Security Operations Console Features

- **Quick-Test Audio Bench**: Instant 1-click evaluation buttons (`[ Authentic Voice ]` and `[ Synthetic Clone ]`) referencing bundled benchmark slices.
- **Multi-Source Ingestion**: Drag-and-drop file upload (`WAV`, `MP3`, `FLAC`, `OGG`, `M4A`) or live 16kHz microphone recording via Web Audio API.
- **Biometric Threat Meter**: Real-time calibrated risk score gauge with threshold indicator needles.
- **Signal Explainability Telemetry**: Real-time spectral variance measurements and window coverage auditing.
- **Industrial Cybersecurity Interface**: Dark-mode console aesthetics (`#0c1017`) engineered for command-center demonstrations.

---

## 📊 Training & Evaluation (Backend Only)

```bash
cd backend

# Train AASIST
python main.py --config ./config/AASIST.conf

# Train AASIST-L
python main.py --config ./config/AASIST-L.conf

# Evaluate pre-trained AASIST
python main.py --eval --config ./config/AASIST.conf

# Evaluate pre-trained AASIST-L
python main.py --eval --config ./config/AASIST-L.conf

# Train baselines
python main.py --config ./config/RawNet2_baseline.conf
python main.py --config ./config/RawGATST_baseline.conf
```

### Dataset Preparation
```bash
# Auto-download ASVspoof 2019 LA dataset
python download_dataset.py

# Or manually:
# 1. Download LA.zip from https://datashare.ed.ac.uk/handle/10283/3336
# 2. Extract and set path in config file
```

---

## 🔧 Development

### Backend Development
```bash
cd backend
# Run with auto-reload
uvicorn app:app --reload --host 127.0.0.1 --port 8000

# Run tests (if available)
pytest tests/

# Lint
ruff check .
black --check .
```

### Frontend Development
```bash
cd frontend
# Dev server with HMR
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

---

## 🐳 Docker Deployment (Optional)

### Backend Dockerfile
```dockerfile
FROM pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ./backend/models/weights:/app/models/weights
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
```

---

## 🤝 Contributors

| Name | Role | GitHub |
|------|------|--------|
| **Kavish Shrimal** | Project Lead, Full-Stack Developer | [@bleedingedge121](https://github.com/bleedingedge121) |
| *Add contributors here* | | |

> **Want to contribute?** See [CONTRIBUTING.md](CONTRIBUTING.md) (create one!) for guidelines.

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

**AASIST Original License:** Copyright (c) 2021-present NAVER Corp. — MIT License

---

- **Email:** kavish.shrimal@mitb.ac.in

---

**Built with ❤️ for Smart India Hackathon 2026**  
*Problem Statement 104 — AI-based Call Detection & Anti-Spoofing*
