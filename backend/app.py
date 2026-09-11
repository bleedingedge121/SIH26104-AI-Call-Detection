import os
import shutil
import tempfile
import hashlib
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
LOCAL_WEIGHTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "weights", "Deepfake-audio-detection-V2")

if os.path.exists(LOCAL_WEIGHTS_DIR) and os.path.exists(os.path.join(LOCAL_WEIGHTS_DIR, "model.safetensors")) and os.path.getsize(os.path.join(LOCAL_WEIGHTS_DIR, "model.safetensors")) > 100_000_000:
    target_model_path = LOCAL_WEIGHTS_DIR
    print(f"[Phonon] Loading audio classification model from local offline weights: {target_model_path}...")
else:
    target_model_path = MODEL_NAME
    print(f"[Phonon] Loading audio classification model from HuggingFace cache: {target_model_path}...")

try:
    model = AutoModelForAudioClassification.from_pretrained(target_model_path, local_files_only=True)
    feature_extractor = AutoFeatureExtractor.from_pretrained(target_model_path, local_files_only=True)
except Exception:
    model = AutoModelForAudioClassification.from_pretrained(target_model_path)
    feature_extractor = AutoFeatureExtractor.from_pretrained(target_model_path)

model.eval()
print("[Phonon] Neural model loaded into memory.")


def extract_audio_windows_with_meta(y: np.ndarray, sr: int = 16000, window_sec: float = 4.0, max_windows: int = 8):
    """
    Extracts temporal windows across audio recording with exact start/end timestamps.
    Enables temporal threat localization for anti-evasion explainability.
    """
    win_len = int(window_sec * sr)
    total_samples = len(y)
    if total_samples <= win_len:
        return [(0.0, round(total_samples / sr, 2), y)]

    step = max(win_len // 2, (total_samples - win_len) // (max_windows - 1)) if max_windows > 1 else win_len
    windows = []
    for i in range(0, total_samples - win_len + 1, step):
        start_t = round(i / sr, 2)
        end_t = round((i + win_len) / sr, 2)
        windows.append((start_t, end_t, y[i : i + win_len]))
        if len(windows) >= max_windows:
            break
    if len(windows) < max_windows and total_samples > win_len:
        start_t = round((total_samples - win_len) / sr, 2)
        end_t = round(total_samples / sr, 2)
        windows.append((start_t, end_t, y[-win_len:]))
    return windows


def analyze_spectral_features(y: np.ndarray, sr: int = 16000):
    """
    Extracts acoustic signal features: MFCC, Spectral Centroid, Rolloff, and ZCR.
    Used for technical signal explainability and vocoder artifact detection.
    """
    try:
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_variance = float(np.mean(np.var(mfccs, axis=1)))

        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        centroid_variance = float(np.var(spectral_centroids))

        rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)[0]))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)[0]))

        return {
            "mfcc_variance": round(mfcc_variance, 2),
            "centroid_variance": round(centroid_variance, 2),
            "spectral_rolloff_hz": round(rolloff, 1),
            "zero_crossing_rate": round(zcr, 4),
        }
    except Exception as e:
        return {
            "mfcc_variance": 0.0,
            "centroid_variance": 0.0,
            "spectral_rolloff_hz": 0.0,
            "zero_crossing_rate": 0.0,
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
    hasher = hashlib.sha256()

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
        temp_path = temp_file.name
        while True:
            chunk = await file.read(65536)
            if not chunk:
                break
            hasher.update(chunk)
            temp_file.write(chunk)

    audio_hash = hasher.hexdigest()

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

        # DC offset removal & amplitude sanity check
        y = y - np.mean(y)

        duration_sec = round(len(y) / sr, 2)

        # Multi-window temporal analysis with timestamp tracking
        windows = extract_audio_windows_with_meta(y, sr=16000, window_sec=4.0, max_windows=8)

        fake_scores = []
        real_scores = []
        temporal_breakdown = []

        for idx, (start_t, end_t, w) in enumerate(windows):
            rms = float(np.sqrt(np.mean(w**2)))
            
            # Energy gating: skip pure silence / dead air (RMS < 0.002)
            if rms < 0.002 and len(windows) > 1:
                window_real = 1.0
                window_fake = 0.0
            else:
                inputs = feature_extractor(w, sampling_rate=16000, return_tensors="pt")
                with torch.no_grad():
                    logits = model(**inputs).logits
                probs = torch.softmax(logits, dim=-1)[0]
                window_real = float(probs[0].item())
                window_fake = float(probs[1].item())

            real_scores.append(window_real)
            fake_scores.append(window_fake)

            w_risk = round(window_fake * 100.0, 1)
            w_status = "CRITICAL" if w_risk > 70 else ("SUSPICIOUS" if w_risk > 40 else "SAFE")

            temporal_breakdown.append({
                "window_index": idx + 1,
                "start_time": start_t,
                "end_time": end_t,
                "real_probability": round(window_real, 4),
                "fake_probability": round(window_fake, 4),
                "risk_score": w_risk,
                "status": w_status,
            })

        mean_fake = float(np.mean(fake_scores))
        max_fake = float(np.max(fake_scores))
        mean_real = float(np.mean(real_scores))

        # Anti-evasion policy: if any window contains severe synthetic probability (>= 0.85),
        # escalate to threat status
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
            "duration_seconds": duration_sec,
            "sample_rate": sr,
            "channels": 1,
            "audio_hash": audio_hash,
            "temporal_breakdown": temporal_breakdown,
        }

    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass