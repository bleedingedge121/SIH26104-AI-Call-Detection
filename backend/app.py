import os
import shutil
import numpy as np
import torch
import torch.nn.functional as F
import soundfile as sf
import librosa
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Voice Cloning Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def analyze_spectral_features(audio_path):
    # Load audio file using librosa
    y, sr = librosa.load(audio_path, sr=16000)
    
    # Extract MFCCs and calculate variance across time
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_variance = float(np.mean(np.var(mfccs, axis=1)))
    
    # Extract Spectral Centroid and calculate variance
    spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    centroid_variance = float(np.var(spectral_centroids))
    
    return {
        "mfcc_variance": round(mfcc_variance, 2),
        "centroid_variance": round(centroid_variance, 2)
    }

def load_and_preprocess_audio(audio_path, target_sample_rate=16000, target_length=64600):
    data, sample_rate = sf.read(audio_path)
    waveform = torch.tensor(data, dtype=torch.float32)
    
    if waveform.ndim == 1:
        waveform = waveform.unsqueeze(0)
    else:
        waveform = waveform.T
        waveform = torch.mean(waveform, dim=0, keepdim=True)

    num_samples = waveform.shape[1]
    if num_samples < target_length:
        waveform = F.pad(waveform, (0, target_length - num_samples))
    elif num_samples > target_length:
        waveform = waveform[:, :target_length]

    return waveform

@app.get("/")
def read_root():
    return {"status": "Voice Anti-Spoofing API is running"}

@app.post("/score")
async def analyze_audio(file: UploadFile = File(...)):
    temp_file_path = f"temp_{file.filename}"
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Layer 1: Neural preprocessing / inference score
        waveform = load_and_preprocess_audio(temp_file_path)
        neural_risk_score = 12.5  # Baseline score placeholder

        # Layer 2: Spectral Analysis using Librosa
        spectral_metrics = analyze_spectral_features(temp_file_path)

        # Combined decision logic: Flag as higher risk if spectral variance is abnormally low
        final_risk_score = neural_risk_score
        if spectral_metrics["mfcc_variance"] < 15.0:
            final_risk_score += 30.0  # Adjust risk for synthetic spectral flatness

        status = "SAFE"
        if final_risk_score > 70:
            status = "CRITICAL"
        elif final_risk_score > 40:
            status = "SUSPICIOUS"

        return {
            "filename": file.filename,
            "risk_score": final_risk_score,
            "status": status,
            "spectral_analysis": spectral_metrics,
            "recommendation": "Allow transaction" if status == "SAFE" else "Require Secondary Verification"
        }
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)