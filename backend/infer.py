import sys
import torch
import torch.nn.functional as F
import soundfile as sf

# 1. Audio Preprocessing Helper
def load_and_preprocess_audio(audio_path, target_sample_rate=16000, target_length=64600):
    """
    Loads an audio file using soundfile, converts to mono 16kHz tensor,
    and pads/crops it to ~4 seconds (64600 samples).
    """
    # Load audio data using soundfile
    data, sample_rate = sf.read(audio_path)
    
    # Convert numpy array to torch tensor [channels, samples]
    waveform = torch.tensor(data, dtype=torch.float32)
    if waveform.ndim == 1:
        waveform = waveform.unsqueeze(0)  # Make mono [1, samples]
    else:
        waveform = waveform.T  # Transpose to [channels, samples]
        waveform = torch.mean(waveform, dim=0, keepdim=True) # Convert stereo to mono

    # Simple resampling fallback if rate differs
    if sample_rate != target_sample_rate:
        # Step slice approximation for simple resample if needed
        step = sample_rate / target_sample_rate
        indices = (torch.arange(0, int(waveform.shape[1] / step)) * step).long()
        waveform = waveform[:, indices]

    # Standardize length to exactly target_length samples
    channels, num_samples = waveform.shape
    if num_samples < target_length:
        pad_amount = target_length - num_samples
        waveform = F.pad(waveform, (0, pad_amount))
    elif num_samples > target_length:
        waveform = waveform[:, :target_length]

    return waveform

# 2. Main Inference Function
def predict_voice_spoof(audio_file_path):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    # Process audio
    waveform = load_and_preprocess_audio(audio_file_path).to(device)
    
    # Placeholder risk score logic
    risk_score = 12.5  
    
    status = "SAFE"
    if risk_score > 70:
        status = "CRITICAL"
    elif risk_score > 40:
        status = "SUSPICIOUS"
        
    print(f"\n--- Detection Results ---")
    print(f"Audio File: {audio_file_path}")
    print(f"Risk Score: {risk_score} / 100")
    print(f"Status:     {status}")
    print(f"--------------------------")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python infer.py <path_to_audio.wav>")
    else:
        audio_path = sys.argv[1]
        predict_voice_spoof(audio_path)