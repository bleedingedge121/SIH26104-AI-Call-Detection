"""
Automated Test Suite for AegisVoice API & Inference Pipeline.
Verifies endpoints, discrimination between real vs fake audio,
JSON response shape compatibility, and error handling.
"""

import sys
import requests

BASE_URL = "http://127.0.0.1:8000"


def test_health():
    print("[TEST 1] Testing GET /health...")
    resp = requests.get(f"{BASE_URL}/health")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert data["status"] == "HEALTHY", f"Expected HEALTHY, got {data}"
    assert "MelodyMachine" in data["model"], f"Unexpected model: {data['model']}"
    print("  -> PASSED:", data)


def test_root():
    print("[TEST 2] Testing GET /...")
    resp = requests.get(f"{BASE_URL}/")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert data["class_mapping"] == {"0": "real", "1": "fake"}
    print("  -> PASSED:", data)


def test_score_sample_real():
    print("[TEST 3] Testing POST /score with real audio sample (sample2.wav / real voice)...")
    with open("sample2.wav", "rb") as f:
        files = {"file": ("sample2.wav", f, "audio/wav")}
        resp = requests.post(f"{BASE_URL}/score", files=files)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()

    for key in ["filename", "risk_score", "status", "spectral_analysis", "recommendation", "model_prediction", "model_confidence"]:
        assert key in data, f"Missing key '{key}' in response: {data}"

    assert data["status"] == "SAFE", f"Expected SAFE, got {data['status']}"
    assert data["model_prediction"] == "real", f"Expected 'real', got {data['model_prediction']}"
    assert data["risk_score"] < 40.0, f"Expected risk_score < 40, got {data['risk_score']}"
    print(f"  -> PASSED: filename={data['filename']}, risk={data['risk_score']}, status={data['status']}, pred={data['model_prediction']}")


def test_score_sample_fake():
    print("[TEST 4] Testing POST /score with fake audio sample (sample.wav / synthetic)...")
    with open("sample.wav", "rb") as f:
        files = {"file": ("sample.wav", f, "audio/wav")}
        resp = requests.post(f"{BASE_URL}/score", files=files)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()

    assert data["status"] == "CRITICAL", f"Expected CRITICAL, got {data['status']}"
    assert data["model_prediction"] == "fake", f"Expected 'fake', got {data['model_prediction']}"
    assert data["risk_score"] > 70.0, f"Expected risk_score > 70, got {data['risk_score']}"
    print(f"  -> PASSED: filename={data['filename']}, risk={data['risk_score']}, status={data['status']}, pred={data['model_prediction']}")


def test_invalid_file():
    print("[TEST 5] Testing POST /score with invalid audio bytes...")
    files = {"file": ("corrupt.wav", b"NOT_A_VALID_WAV_HEADER", "audio/wav")}
    resp = requests.post(f"{BASE_URL}/score", files=files)
    assert resp.status_code == 400, f"Expected 400 Bad Request, got {resp.status_code}"
    print(f"  -> PASSED: Correctly rejected corrupt audio with HTTP 400")


if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING AUTOMATED TEST PIPELINE FOR AEGISVOICE")
    print("=" * 60)
    try:
        test_health()
        test_root()
        test_score_sample_real()
        test_score_sample_fake()
        test_invalid_file()
        print("\nALL 5 AUTOMATED INTEGRATION TESTS PASSED SUCCESSFULLY!")
        print("=" * 60)
    except AssertionError as ae:
        print(f"\n[TEST FAILURE] {ae}", file=sys.stderr)
        sys.exit(1)
    except Exception as ex:
        print(f"\n[UNEXPECTED ERROR] {ex}", file=sys.stderr)
        sys.exit(2)
