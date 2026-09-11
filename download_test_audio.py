import io
from pathlib import Path
import sys
import subprocess

# Install dependencies if needed
try:
    from datasets import load_dataset, Audio
    import soundfile as sf
except ImportError:
    subprocess.check_call([
        sys.executable, "-m", "pip", "install",
        "-U", "datasets", "soundfile"
    ])
    from datasets import load_dataset, Audio
    import soundfile as sf


# ============================================================
# CONFIG
# ============================================================

OUTPUT_DIR = Path("test_audio")

REAL_COUNT = 5
FAKE_COUNT = 5

DATASET = "SpeechAntiSpoofingBenchmarks/ASVspoof2019_LA"


# ============================================================
# STREAM DATASET
# ============================================================

print("Opening ASVspoof 2019 LA in STREAMING mode...")
print("Only samples needed for the test set will be read.\n")

ds = load_dataset(
    DATASET,
    split="test",
    streaming=True
).cast_column("audio", Audio(decode=False))


# ============================================================
# OUTPUT DIRECTORIES
# ============================================================

real_dir = OUTPUT_DIR / "real"
fake_dir = OUTPUT_DIR / "fake"

real_dir.mkdir(parents=True, exist_ok=True)
fake_dir.mkdir(parents=True, exist_ok=True)


# ============================================================
# COLLECT + SAVE
# ============================================================

real_count = 0
fake_count = 0

print("Searching for samples...\n")

for sample in ds:

    label = sample["label"]

    # Handle either ClassLabel integer or string labels
    if isinstance(label, int):
        is_real = label == 0
        is_fake = label == 1
    else:
        label = str(label).lower()
        is_real = label == "bonafide"
        is_fake = label == "spoof"

    # --------------------------------------------------------
    # REAL
    # --------------------------------------------------------

    if is_real and real_count < REAL_COUNT:

        audio = sample["audio"]
        output = real_dir / f"real_{real_count + 1:02d}.wav"

        if "bytes" in audio and audio["bytes"] is not None:
            data, sr = sf.read(io.BytesIO(audio["bytes"]))
        else:
            data = audio["array"]
            sr = 16000

        sf.write(
            output,
            data,
            sr,
            subtype="PCM_16"
        )

        real_count += 1

        print(f"[REAL] {output} ({len(data)} samples @ {sr}Hz)")

    # --------------------------------------------------------
    # FAKE
    # --------------------------------------------------------

    elif is_fake and fake_count < FAKE_COUNT:

        audio = sample["audio"]
        output = fake_dir / f"fake_{fake_count + 1:02d}.wav"

        if "bytes" in audio and audio["bytes"] is not None:
            data, sr = sf.read(io.BytesIO(audio["bytes"]))
        else:
            data = audio["array"]
            sr = 16000

        sf.write(
            output,
            data,
            sr,
            subtype="PCM_16"
        )

        fake_count += 1

        print(f"[FAKE] {output} ({len(data)} samples @ {sr}Hz)")

    # --------------------------------------------------------
    # STOP WHEN WE HAVE EVERYTHING
    # --------------------------------------------------------

    if real_count >= REAL_COUNT and fake_count >= FAKE_COUNT:
        break


# ============================================================
# RESULT
# ============================================================

print("\n========================================")
print("DONE")
print("========================================")
print(f"Real samples : {real_count}")
print(f"Fake samples : {fake_count}")
print(f"Output       : {OUTPUT_DIR.absolute()}")
print("Format       : 16 kHz WAV / PCM-16")
print("========================================")