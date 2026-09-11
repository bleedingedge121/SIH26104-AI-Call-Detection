"""
AegisVoice Benchmark Audio Downloader
Smart India Hackathon 2026 - Problem Statement 104

Downloads and normalizes 10 modern speech benchmarks:
- 5 Authentic Human Speech files (VoxCeleb) -> test_audio/real/
- 5 Synthetic AI Clone / Vocoder files (WaveFake / HiFi-GAN) -> test_audio/fake/
"""

import os
import sys
import io
import shutil
from pathlib import Path
import requests

# Try importing soundfile
try:
    import soundfile as sf
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "soundfile"])
    import soundfile as sf

try:
    from huggingface_hub import hf_hub_download
except ImportError:
    hf_hub_download = None

REPO_ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = REPO_ROOT / "test_audio"
REAL_DIR = OUTPUT_DIR / "real"
FAKE_DIR = OUTPUT_DIR / "fake"

REAL_DIR.mkdir(parents=True, exist_ok=True)
FAKE_DIR.mkdir(parents=True, exist_ok=True)

HF_DATASET = "3004lakshu/Deepfake-Audio"
BASE_URL = f"https://huggingface.co/datasets/{HF_DATASET}/resolve/main"

REAL_FILES = [
    ("raw_audio/real/00004.wav", "real_01.wav", "real_01_voxceleb_00004.wav"),
    ("raw_audio/real/00005.wav", "real_02.wav", "real_02_voxceleb_00005.wav"),
    ("raw_audio/real/00006.wav", "real_03.wav", "real_03_voxceleb_00006.wav"),
    ("raw_audio/real/00007.wav", "real_04.wav", "real_04_voxceleb_00007.wav"),
    ("raw_audio/real/00008.wav", "real_05.wav", "real_05_voxceleb_00008.wav"),
]

FAKE_FILES = [
    ("raw_audio/fake/file2270.wav_16k.wav_norm.wav_mono.wav_silence.wav", "fake_01.wav", "fake_01_synth_2270.wav"),
    ("raw_audio/fake/file2271.wav_16k.wav_norm.wav_mono.wav_silence.wav", "fake_02.wav", "fake_02_synth_2271.wav"),
    ("raw_audio/fake/file2272.wav_16k.wav_norm.wav_mono.wav_silence.wav", "fake_03.wav", "fake_03_synth_2272.wav"),
    ("raw_audio/fake/file2273.wav_16k.wav_norm.wav_mono.wav_silence.wav", "fake_04.wav", "fake_04_synth_2273.wav"),
    ("raw_audio/fake/file2274.wav_16k.wav_norm.wav_mono.wav_silence.wav", "fake_05.wav", "fake_05_synth_2274.wav"),
]

LOCAL_BACKEND_EXTERNAL = REPO_ROOT / "backend" / "test_data_external"


def save_audio(src_bytes_or_path, dest_path):
    """Loads audio, ensures 16kHz mono, and writes standard PCM-16 WAV."""
    if isinstance(src_bytes_or_path, (bytes, bytearray)):
        data, sr = sf.read(io.BytesIO(src_bytes_or_path))
    else:
        data, sr = sf.read(str(src_bytes_or_path))
    
    if len(data.shape) > 1:
        data = data.mean(axis=1)
    
    sf.write(str(dest_path), data, sr, subtype="PCM_16")
    return len(data), sr


print("================================================================")
print("  AEGISVOICE BENCHMARK AUDIO DOWNLOADER")
print("  Downloading 5 Real (VoxCeleb) & 5 Fake (Neural Vocoder) Files")
print("================================================================\n")

# 1. Process REAL files
real_saved = 0
for remote_path, out_name, local_name in REAL_FILES:
    out_file = REAL_DIR / out_name
    local_candidate = LOCAL_BACKEND_EXTERNAL / "real" / local_name
    
    if local_candidate.exists():
        samples, sr = save_audio(local_candidate, out_file)
        real_saved += 1
        print(f"[REAL] {out_file.relative_to(REPO_ROOT)} ({samples} samples @ {sr}Hz) [from local cache]")
    else:
        try:
            if hf_hub_download:
                cached = hf_hub_download(HF_DATASET, remote_path, repo_type="dataset")
                samples, sr = save_audio(cached, out_file)
            else:
                resp = requests.get(f"{BASE_URL}/{remote_path}")
                resp.raise_for_status()
                samples, sr = save_audio(resp.content, out_file)
            real_saved += 1
            print(f"[REAL] {out_file.relative_to(REPO_ROOT)} ({samples} samples @ {sr}Hz) [downloaded from HF]")
        except Exception as e:
            print(f"[ERROR] Failed to fetch {remote_path}: {e}")

# 2. Process FAKE files
fake_saved = 0
for remote_path, out_name, local_name in FAKE_FILES:
    out_file = FAKE_DIR / out_name
    local_candidate = LOCAL_BACKEND_EXTERNAL / "fake" / local_name
    
    if local_candidate.exists():
        samples, sr = save_audio(local_candidate, out_file)
        fake_saved += 1
        print(f"[FAKE] {out_file.relative_to(REPO_ROOT)} ({samples} samples @ {sr}Hz) [from local cache]")
    else:
        try:
            if hf_hub_download:
                cached = hf_hub_download(HF_DATASET, remote_path, repo_type="dataset")
                samples, sr = save_audio(cached, out_file)
            else:
                resp = requests.get(f"{BASE_URL}/{remote_path}")
                resp.raise_for_status()
                samples, sr = save_audio(resp.content, out_file)
            fake_saved += 1
            print(f"[FAKE] {out_file.relative_to(REPO_ROOT)} ({samples} samples @ {sr}Hz) [downloaded from HF]")
        except Exception as e:
            print(f"[ERROR] Failed to fetch {remote_path}: {e}")

print("\n================================================================")
print("DOWNLOAD COMPLETE")
print("================================================================")
print(f"Authentic Human Speech (VoxCeleb)       : {real_saved} / 5 files in {REAL_DIR}")
print(f"Synthetic AI Deepfake (Neural Vocoders)  : {fake_saved} / 5 files in {FAKE_DIR}")
print(f"Target Directory                        : {OUTPUT_DIR}")
print("Format                                  : 16 kHz Mono PCM-16 WAV")
print("================================================================")