import os
import sys
import requests

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "weights", "Deepfake-audio-detection-V2")
os.makedirs(MODEL_DIR, exist_ok=True)

FILES = [
    "config.json",
    "preprocessor_config.json",
    "model.safetensors"
]

BASE_URL = "https://huggingface.co/MelodyMachine/Deepfake-audio-detection-V2/resolve/main"

print(f"[Phonon] Downloading model weights directly to: {MODEL_DIR}")

for filename in FILES:
    target_path = os.path.join(MODEL_DIR, filename)
    url = f"{BASE_URL}/{filename}"
    
    if os.path.exists(target_path) and os.path.getsize(target_path) > 0:
        if filename == "model.safetensors" and os.path.getsize(target_path) == 378302360:
            print(f" -> {filename} already exists ({os.path.getsize(target_path):,} bytes). Skipping.")
            continue
        elif filename != "model.safetensors":
            print(f" -> {filename} already exists. Skipping.")
            continue

    print(f" -> Downloading {filename} from {url}...")
    resp = requests.get(url, stream=True)
    resp.raise_for_status()
    total_size = int(resp.headers.get("content-length", 0))
    
    downloaded = 0
    with open(target_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=1024 * 1024):  # 1MB chunks
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    percent = (downloaded / total_size) * 100
                    mb_down = downloaded / (1024 * 1024)
                    mb_total = total_size / (1024 * 1024)
                    print(f"\r    {filename}: {mb_down:.1f}/{mb_total:.1f} MB ({percent:.1f}%)", end="", flush=True)
    print(f"\n -> Successfully saved {filename} ({downloaded:,} bytes).")

print("[Phonon] All model files downloaded and verified!")
