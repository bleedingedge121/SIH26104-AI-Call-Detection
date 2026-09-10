# SIH26104-AI-Call-Detection

> **Smart India Hackathon 2026 • Problem Statement 104**  
> **Advanced Neural Network & Spectral Deepfake Shield**  
> **AegisVoice AI — Biometric Anti-Spoofing Operations Center**

A full-stack AI-powered voice anti-spoofing system combining the **AASIST (Audio Anti-Spoofing using Integrated Spectro-Temporal Graph Attention Networks)** backend with a modern **React + Vite** frontend for real-time deepfake audio detection.

---

## 🏗️ Repository Structure

```
SIH26104-AI-Call-Detection/
├── .gitignore                          # Root gitignore (Python + Node + OS)
├── README.md                           # This file
├── LICENSE                             # MIT License
│
├── backend/                            # Python FastAPI Backend (AASIST)
│   ├── .gitignore                      # Python-specific ignores
│   ├── app.py                          # FastAPI server with /score endpoint
│   ├── main.py                         # AASIST training/evaluation entry point
│   ├── requirements.txt                # Python dependencies
│   ├── config/                         # Model configuration files
│   │   ├── AASIST.conf                 # AASIST model config
│   │   ├── AASIST-L.conf               # AASIST-Light config
│   │   ├── RawNet2_baseline.conf       # RawNet2 baseline config
│   │   └── RawGATST_baseline.conf      # RawGAT-ST baseline config
│   ├── models/                         # Model architectures
│   │   ├── AASIST.py                   # AASIST Graph Attention Network
│   │   ├── RawNet2Spoof.py             # RawNet2 anti-spoofing model
│   │   └── RawNetGatSpoofST.py         # RawGAT-ST model
│   ├── models/weights/                 # Pre-trained model weights (Git LFS recommended)
│   │   ├── AASIST.pth                  # AASIST pre-trained weights
│   │   └── AASIST-L.pth                # AASIST-Light pre-trained weights
│   ├── data_utils.py                   # Data loading utilities
│   ├── evaluation.py                   # Evaluation metrics (EER, min t-DCF)
│   ├── infer.py                        # Inference utilities
│   ├── utils.py                        # Helper functions
│   ├── download_dataset.py             # ASVspoof 2019 dataset downloader
│   ├── sample.wav                      # Sample audio for testing
│   └── sample2.wav                     # Additional sample audio
│
└── frontend/                           # React + Vite Frontend
    ├── .gitignore                      # Node-specific ignores
    ├── package.json                    # Frontend dependencies
    ├── package-lock.json               # Lock file
    ├── vite.config.js                  # Vite configuration
    ├── index.html                      # Entry HTML
    ├── public/                         # Static assets
    │   ├── favicon.svg                 # Favicon
    │   └── icons.svg                   # Icon sprites
    └── src/                            # React source
        ├── main.jsx                    # React entry point
        ├── App.jsx                     # Main application component
        ├── App.css                     # Component styles
        ├── index.css                   # Global styles
        └── assets/                     # Static assets (images, fonts)
```

---

## 🚀 Quick Start

### Prerequisites

| Component | Version | Purpose |
|-----------|---------|---------|
| Python | 3.10+ | Backend runtime |
| Node.js | 18+ | Frontend build tooling |
| Git | Latest | Version control |
| CUDA | 11.7+ | GPU acceleration (recommended) |

---

### 1. Clone the Repository

```bash
git clone https://github.com/bleedingedge121/SIH26104-AI-Call-Detection.git
cd SIH26104-AI-Call-Detection
```

---

### 2. Backend Setup (FastAPI + AASIST)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Verify model weights exist (required for inference)
ls models/weights/
# Should show: AASIST.pth  AASIST-L.pth

# Start the FastAPI server
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

**Backend will be available at:** `http://127.0.0.1:8000`  
**API Documentation (Swagger UI):** `http://127.0.0.1:8000/docs`

---

### 3. Frontend Setup (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

**Frontend will be available at:** `http://localhost:5173` (or next available port)

---

### 4. Run the Complete Application

1. **Start Backend** (Terminal 1):
   ```bash
   cd backend && venv\Scripts\activate && uvicorn app:app --host 127.0.0.1 --port 8000 --reload
   ```

2. **Start Frontend** (Terminal 2):
   ```bash
   cd frontend && npm run dev
   ```

3. **Open Browser** → Navigate to `http://localhost:5173`

---

## 🔬 Backend API Reference

### `GET /`
Health check endpoint.

**Response:**
```json
{
  "status": "Voice Anti-Spoofing API is running"
}
```

### `POST /score`
Analyze an audio file for deepfake/spoofing detection.

**Request:** `multipart/form-data`
- `file` (audio/*): WAV, MP3, or FLAC audio file

**Response:**
```json
{
  "filename": "test_audio.wav",
  "risk_score": 12.5,
  "status": "SAFE",
  "spectral_analysis": {
    "mfcc_variance": 42.3,
    "centroid_variance": 1250.7
  },
  "recommendation": "Allow transaction"
}
```

**Status Values:**
- `SAFE` — Risk score ≤ 40
- `SUSPICIOUS` — Risk score 41–70
- `CRITICAL` — Risk score > 70

---

## 🧠 Model Architecture

### AASIST (Primary)
**Audio Anti-Spoofing using Integrated Spectro-Temporal Graph Attention Networks**

- **Paper:** [arXiv:2110.01200](https://arxiv.org/abs/2110.01200)
- **Architecture:** Heterogeneous Graph Attention Network combining spectrogram and raw waveform branches
- **Performance:** EER 0.83%, min t-DCF 0.0275 on ASVspoof 2019 LA
- **Parameters:** ~1.2M

### AASIST-L (Lightweight)
- **Parameters:** 85,306
- **Performance:** EER 0.99%, min t-DCF 0.0309
- **Use case:** Edge deployment, real-time inference

### Baselines Included
- **RawNet2** — End-to-end anti-spoofing with raw waveforms
- **RawGAT-ST** — Spectro-temporal graph attention baseline

---

## 🎯 Frontend Features

- **Live Audio Recording** — Browser MediaRecorder API @ 16kHz
- **File Upload** — Drag-and-drop WAV/MP3/FLAC support
- **Real-time Visualization** — Risk score, status, spectral metrics
- **Responsive Design** — Mobile-first, dark theme with cyan/amber accents
- **Telemetry Dashboard** — MFCC variance, spectral centroid variance
- **Operational Directives** — Actionable recommendations per classification

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

## 🙏 Acknowledgements

- **AASIST Authors:** Jung et al., NAVER Corp. — [Paper](https://arxiv.org/abs/2110.01200)
- **ASVspoof Challenge** — Dataset and benchmarks
- **RawNet2 Baseline** — [ASVspoof 2021 Baseline](https://github.com/asvspoof-challenge/2021/tree/main/LA/Baseline-RawNet2)
- **RawGAT-ST** — [EURECOM Repository](https://github.com/eurecom-asp/RawGAT-ST-antispoofing)
- **min t-DCF Implementation** — [ASVspoof Resources](https://www.asvspoof.org/resources/tDCF_python_v2.zip)

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/bleedingedge121/SIH26104-AI-Call-Detection/issues)
- **Discussions:** [GitHub Discussions](https://github.com/bleedingedge121/SIH26104-AI-Call-Detection/discussions)
- **Email:** kavish.shrimal@mitb.ac.in

---

**Built with ❤️ for Smart India Hackathon 2026**  
*Problem Statement 104 — AI-based Call Detection & Anti-Spoofing*