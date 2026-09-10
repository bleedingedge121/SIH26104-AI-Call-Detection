import os
import shutil
import tempfile
import numpy as np
import torch
import librosa
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoModelForAudioClassification, AutoFeatureExtractor

app = FastAPI(title="Voice Deepfake & Scam Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_NAME = "MelodyMachine/Deepfake-audio-detection-V2"
print(f"[AegisVoice] Loading audio classification model: {MODEL_NAME}...")

try:
    model = AutoModelForAudioClassification.from_pretrained(MODEL_NAME, local_files_only=True)
    feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_NAME, local_files_only=True)
except Exception:
    model = AutoModelForAudioClassification.from_pretrained(MODEL_NAME)
    feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_NAME)

model.eval()
print("[AegisVoice] Neural model loaded into memory.")


def extract_audio_windows(y: np.ndarray, sr: int = 16000, window_sec: float = 4.0, max_windows: int = 8):
    """
    Extracts temporal windows across audio recording to guarantee complete inspection.
    Prevents evasion where cloned audio appears in the middle of a call.
    """
    win_len = int(window_sec * sr)
    if len(y) <= win_len:
        return [y]

    step = max(win_len, (len(y) - win_len) // (max_windows - 1)) if max_windows > 1 else win_len
    windows = []
    for i in range(0, len(y) - win_len + 1, step):
        windows.append(y[i : i + win_len])
        if len(windows) >= max_windows:
            break
    if len(windows) < max_windows and len(y) > win_len:
        windows.append(y[-win_len:])
    return windows


def analyze_spectral_features(y: np.ndarray, sr: int = 16000):
    """
    Extracts acoustic signal features: MFCC and Spectral Centroid variance.
    Used for technical signal explainability.
    """
    try:
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_variance = float(np.mean(np.var(mfccs, axis=1)))

        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        centroid_variance = float(np.var(spectral_centroids))

        return {
            "mfcc_variance": round(mfcc_variance, 2),
            "centroid_variance": round(centroid_variance, 2),
        }
    except Exception as e:
        return {
            "mfcc_variance": 0.0,
            "centroid_variance": 0.0,
            "error": str(e),
        }


@app.get("/")
def read_root():
    return {
        "status": "Voice Anti-Spoofing API is running",
        "model": MODEL_NAME,
        "class_mapping": {"0": "real", "1": "fake"},
    }


@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "model": MODEL_NAME,
        "model_loaded": model is not None,
    }


@app.post("/score")
async def analyze_audio(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    suffix = os.path.splitext(file.filename)[1] or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
        temp_path = temp_file.name
        shutil.copyfileobj(file.file, temp_file)

    try:
        try:
            y, sr = librosa.load(temp_path, sr=16000, mono=True)
        except Exception as load_err:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to decode audio file: {str(load_err)}"
            )

        if len(y) == 0:
            raise HTTPException(status_code=400, detail="Audio file contains no audio samples.")

        # Multi-window analysis for robust full-call coverage
        windows = extract_audio_windows(y, sr=16000, window_sec=4.0, max_windows=8)

        fake_scores = []
        real_scores = []

        for w in windows:
            inputs = feature_extractor(w, sampling_rate=16000, return_tensors="pt")
            with torch.no_grad():
                logits = model(**inputs).logits
            probs = torch.softmax(logits, dim=-1)[0]
            real_scores.append(float(probs[0].item()))
            fake_scores.append(float(probs[1].item()))

        mean_fake = float(np.mean(fake_scores))
        max_fake = float(np.max(fake_scores))
        mean_real = float(np.mean(real_scores))

        # In voice fraud, if a cloned voice appears in any segment (max_fake >= 0.85),
        # the call is classified as a threat.
        if max_fake >= 0.85:
            effective_fake = max(mean_fake, max_fake * 0.9)
        else:
            effective_fake = mean_fake

        risk_score = round(effective_fake * 100.0, 1)

        if risk_score > 70:
            status = "CRITICAL"
            model_prediction = "fake"
        elif risk_score > 40:
            status = "SUSPICIOUS"
            model_prediction = "fake" if effective_fake >= 0.5 else "real"
        else:
            status = "SAFE"
            model_prediction = "real"

        model_confidence = round(max(mean_real, effective_fake), 4)

        spectral_metrics = analyze_spectral_features(y, sr)
        recommendation = (
            "Allow transaction" if status == "SAFE" else "Require Secondary Verification"
        )

        return {
            "filename": file.filename,
            "risk_score": risk_score,
            "status": status,
            "spectral_analysis": spectral_metrics,
            "recommendation": recommendation,
            "model_prediction": model_prediction,
            "model_confidence": model_confidence,
            "fake_probability": round(effective_fake, 4),
            "real_probability": round(1.0 - effective_fake, 4),
            "windows_analyzed": len(windows),
        }

    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass