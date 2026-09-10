"""
AegisVoice Standalone CLI Inference Utility.
Uses pretrained HuggingFace wav2vec2 model "MelodyMachine/Deepfake-audio-detection-V2"
for real-time speech deepfake detection.
"""

import sys
import os
import torch
import numpy as np
import librosa
from transformers import AutoModelForAudioClassification, AutoFeatureExtractor

MODEL_NAME = "MelodyMachine/Deepfake-audio-detection-V2"


def extract_audio_windows(y: np.ndarray, sr: int = 16000, window_sec: float = 4.0, max_windows: int = 8):
    """Extracts temporal windows across audio recording to guarantee full coverage."""
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
    """Auxiliary explainability signal: MFCC and Spectral Centroid variance."""
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


def predict_voice_spoof(audio_file_path: str):
    if not os.path.exists(audio_file_path):
        print(f"[ERROR] Audio file does not exist: {audio_file_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading deepfake classification model: {MODEL_NAME}...")
    try:
        model = AutoModelForAudioClassification.from_pretrained(MODEL_NAME, local_files_only=True)
        feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_NAME, local_files_only=True)
    except Exception:
        model = AutoModelForAudioClassification.from_pretrained(MODEL_NAME)
        feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_NAME)

    model.eval()

    print(f"Loading and resampling audio at 16kHz: {audio_file_path}...")
    y, sr = librosa.load(audio_file_path, sr=16000, mono=True)
    duration = round(len(y) / sr, 2)

    windows = extract_audio_windows(y, sr=16000, window_sec=4.0, max_windows=8)
    print(f"Analyzing {len(windows)} temporal window(s) across {duration}s recording...")

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

    if max_fake >= 0.85:
        effective_fake = max(mean_fake, max_fake * 0.9)
    else:
        effective_fake = mean_fake

    risk_score = round(effective_fake * 100.0, 1)

    if risk_score > 70:
        status = "CRITICAL"
        pred_label = "fake"
    elif risk_score > 40:
        status = "SUSPICIOUS"
        pred_label = "fake" if effective_fake >= 0.5 else "real"
    else:
        status = "SAFE"
        pred_label = "real"

    spectral_metrics = analyze_spectral_features(y, sr)
    recommendation = "Allow transaction" if status == "SAFE" else "Require Secondary Verification"

    print("\n" + "=" * 55)
    print("           AEGISVOICE INFERENCE REPORT")
    print("=" * 55)
    print(f" Audio File:          {audio_file_path}")
    print(f" Duration:            {duration}s ({len(y)} samples)")
    print(f" Windows Analyzed:    {len(windows)}")
    print(f" Model:               {MODEL_NAME}")
    print(f" Prediction:          {pred_label.upper()}")
    print(f" Real Probability:    {(1.0 - effective_fake) * 100:.2f}%")
    print(f" Fake Probability:    {effective_fake * 100:.2f}%")
    print(f" Peak Window Threat:  {max_fake * 100:.2f}%")
    print(f" Risk Score:          {risk_score} / 100")
    print(f" Status:              {status}")
    print(f" Recommendation:      {recommendation}")
    print("-" * 55)
    print(" Auxiliary Spectral Metrics:")
    print(f"  - MFCC Variance:              {spectral_metrics['mfcc_variance']}")
    print(f"  - Spectral Centroid Variance: {spectral_metrics['centroid_variance']}")
    print("=" * 55 + "\n")

    return {
        "filename": os.path.basename(audio_file_path),
        "risk_score": risk_score,
        "status": status,
        "model_prediction": pred_label,
        "fake_probability": round(effective_fake, 4),
        "real_probability": round(1.0 - effective_fake, 4),
        "windows_analyzed": len(windows),
        "spectral_analysis": spectral_metrics,
        "recommendation": recommendation,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python infer.py <path_to_audio.wav>")
        sys.exit(1)
    else:
        predict_voice_spoof(sys.argv[1])