"""
AegisVoice Standalone CLI Inference Utility.
Uses pretrained HuggingFace wav2vec2 model "MelodyMachine/Deepfake-audio-detection-V2"
for real-time speech deepfake detection with temporal localization.
"""

import sys
import os
import hashlib
import torch
import numpy as np
import librosa
from transformers import AutoModelForAudioClassification, AutoFeatureExtractor

MODEL_NAME = "MelodyMachine/Deepfake-audio-detection-V2"


def extract_audio_windows_with_meta(y: np.ndarray, sr: int = 16000, window_sec: float = 4.0, max_windows: int = 8):
    """Extracts temporal windows across audio recording with exact start/end timestamps."""
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
    """Auxiliary explainability signal: MFCC, Centroid, Rolloff, and ZCR."""
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


def predict_voice_spoof(audio_file_path: str):
    if not os.path.exists(audio_file_path):
        print(f"[ERROR] Audio file does not exist: {audio_file_path}", file=sys.stderr)
        sys.exit(1)

    # Compute SHA-256 audio hash
    with open(audio_file_path, "rb") as f:
        file_bytes = f.read()
    audio_hash = hashlib.sha256(file_bytes).hexdigest()

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
    y = y - np.mean(y)
    duration = round(len(y) / sr, 2)

    windows = extract_audio_windows_with_meta(y, sr=16000, window_sec=4.0, max_windows=8)
    print(f"Analyzing {len(windows)} temporal window(s) across {duration}s recording...")

    fake_scores = []
    real_scores = []
    temporal_breakdown = []

    for idx, (start_t, end_t, w) in enumerate(windows):
        rms = float(np.sqrt(np.mean(w**2)))
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

    print("\n" + "=" * 65)
    print("                    AEGISVOICE INFERENCE REPORT")
    print("=" * 65)
    print(f" Audio File:          {os.path.basename(audio_file_path)}")
    print(f" SHA-256 Hash:        {audio_hash[:32]}...")
    print(f" Duration:            {duration}s ({len(y)} samples @ 16kHz)")
    print(f" Windows Analyzed:    {len(windows)}")
    print(f" Model:               {MODEL_NAME}")
    print(f" Biometric Verdict:   {pred_label.upper()}")
    print(f" Real Probability:    {(1.0 - effective_fake) * 100:.2f}%")
    print(f" Fake Probability:    {effective_fake * 100:.2f}%")
    print(f" Peak Segment Risk:   {max_fake * 100:.2f}%")
    print(f" Risk Score:          {risk_score} / 100")
    print(f" Threat Level:        {status}")
    print(f" Directive:           {recommendation}")
    print("-" * 65)
    print(" Temporal Window Timeline Breakdown:")
    for w_meta in temporal_breakdown:
        print(f"  Window #{w_meta['window_index']} [{w_meta['start_time']:4.1f}s - {w_meta['end_time']:4.1f}s]: Risk {w_meta['risk_score']:5.1f} | Status: {w_meta['status']:10} | Fake: {w_meta['fake_probability']*100:5.1f}%")
    print("-" * 65)
    print(" Auxiliary Acoustic Telemetry:")
    print(f"  - MFCC Variance:              {spectral_metrics['mfcc_variance']}")
    print(f"  - Spectral Centroid Variance: {spectral_metrics['centroid_variance']}")
    print(f"  - Spectral Rolloff:           {spectral_metrics['spectral_rolloff_hz']} Hz")
    print(f"  - Zero Crossing Rate:         {spectral_metrics['zero_crossing_rate']}")
    print("=" * 65 + "\n")

    return {
        "filename": os.path.basename(audio_file_path),
        "risk_score": risk_score,
        "status": status,
        "model_prediction": pred_label,
        "fake_probability": round(effective_fake, 4),
        "real_probability": round(1.0 - effective_fake, 4),
        "windows_analyzed": len(windows),
        "duration_seconds": duration,
        "audio_hash": audio_hash,
        "temporal_breakdown": temporal_breakdown,
        "spectral_analysis": spectral_metrics,
        "recommendation": recommendation,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python infer.py <path_to_audio.wav>")
        sys.exit(1)
    else:
        predict_voice_spoof(sys.argv[1])