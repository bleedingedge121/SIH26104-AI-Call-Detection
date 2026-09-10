"""
AegisVoice Live Backend API Verification Script.
Tests authentic speech and synthetic voice clones against http://127.0.0.1:8000/score.
Automatically tests repo-bundled benchmark samples and detects external datasets if present.
"""

import os
import sys
import time
import requests

API_URL = "http://127.0.0.1:8000/score"
HEALTH_URL = "http://127.0.0.1:8000/health"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def check_api_health():
    print("[INIT] Verifying backend connectivity...")
    try:
        resp = requests.get(HEALTH_URL, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            print(f"[OK] Backend online: Model = {data.get('model', 'Unknown')}\n")
            return True
        else:
            print(f"[ERROR] Health check returned HTTP {resp.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("[ERROR] Could not connect to backend at http://127.0.0.1:8000")
        print("        Ensure backend server is running (e.g. uvicorn app:app --port 8000)")
        return False


def test_file(file_path: str, expected_class: str) -> bool:
    fname = os.path.basename(file_path)
    t0 = time.time()
    try:
        with open(file_path, "rb") as f:
            resp = requests.post(
                API_URL,
                files={"file": (fname, f, "audio/wav")},
                timeout=30,
            )
        elapsed = time.time() - t0

        if resp.status_code != 200:
            print(f"  [HTTP {resp.status_code}] {fname:32} -> {resp.text}")
            return False

        data = resp.json()
        risk = data.get("risk_score", 0.0)
        status = data.get("status", "UNKNOWN")
        pred = data.get("model_prediction", "UNKNOWN")
        real_p = data.get("real_probability", 0.0)
        fake_p = data.get("fake_probability", 0.0)

        if expected_class == "real":
            passed = status == "SAFE" and pred == "real"
        else:
            passed = status in ["CRITICAL", "SUSPICIOUS"] and pred == "fake"

        tag = "PASS" if passed else "FAIL"
        prob_str = f"Real {real_p*100:5.1f}% / Fake {fake_p*100:5.1f}%"
        print(f"  [{tag:4}] {fname:32} | Risk: {risk:5.1f} | Status: {status:10} | Pred: {pred:4} | {prob_str} | {elapsed:.2f}s")
        return passed
    except Exception as e:
        print(f"  [ERR ] {fname:32} -> {e}")
        return False


def main():
    if not check_api_health():
        sys.exit(1)

    print("=" * 95)
    print(" 1. BENCHMARK TESTS: AUTHENTIC / GENUINE HUMAN SPEECH (Expected: SAFE / REAL)")
    print("=" * 95)

    real_candidates = [
        os.path.join(SCRIPT_DIR, "demo_samples", "genuine_human_speech.wav"),
        os.path.join(SCRIPT_DIR, "sample2.wav"),
        os.path.join(SCRIPT_DIR, "..", "frontend", "public", "samples", "sample_real.wav"),
        "D:/SIH/Dataset/micro-machines.wav",
    ]

    tested_real = 0
    passed_real = 0
    for path in real_candidates:
        if os.path.exists(path):
            tested_real += 1
            if test_file(path, expected_class="real"):
                passed_real += 1

    print("\n" + "=" * 95)
    print(" 2. BENCHMARK TESTS: SYNTHETIC / CLONED VOICES (Expected: CRITICAL / FAKE)")
    print("=" * 95)

    fake_candidates = [
        os.path.join(SCRIPT_DIR, "demo_samples", "synthetic_voice_clone.wav"),
        os.path.join(SCRIPT_DIR, "sample.wav"),
        os.path.join(SCRIPT_DIR, "..", "frontend", "public", "samples", "sample_spoof.wav"),
    ]

    # Include external dataset if present on host machine
    external_fake_dir = "D:/SIH/Dataset/Fake"
    if os.path.exists(external_fake_dir):
        for fname in sorted(os.listdir(external_fake_dir)):
            if fname.lower().endswith((".wav", ".mp3", ".flac", ".ogg", ".m4a")):
                fake_candidates.append(os.path.join(external_fake_dir, fname))

    tested_fake = 0
    passed_fake = 0
    for path in fake_candidates:
        if os.path.exists(path):
            tested_fake += 1
            if test_file(path, expected_class="fake"):
                passed_fake += 1

    print("\n" + "=" * 95)
    print("                               VERIFICATION SUMMARY")
    print("=" * 95)
    real_pct = (passed_real / tested_real * 100) if tested_real > 0 else 0
    fake_pct = (passed_fake / tested_fake * 100) if tested_fake > 0 else 0
    total_tested = tested_real + tested_fake
    total_passed = passed_real + passed_fake
    overall_pct = (total_passed / total_tested * 100) if total_tested > 0 else 0

    print(f" Authentic Voices:  {passed_real:2d} / {tested_real:2d} correctly classified as REAL ({real_pct:.1f}%)")
    print(f" Synthetic Clones:  {passed_fake:2d} / {tested_fake:2d} correctly flagged as FAKE/THREAT ({fake_pct:.1f}%)")
    print(f" Overall Accuracy:  {total_passed:2d} / {total_tested:2d} ({overall_pct:.1f}%)")
    print("=" * 95 + "\n")

    if total_passed < total_tested:
        sys.exit(1)
    else:
        print("[SUCCESS] All audio detection verification tests passed.")
        sys.exit(0)


if __name__ == "__main__":
    main()

