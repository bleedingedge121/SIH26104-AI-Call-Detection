import React, { useState, useRef } from 'react';
import { ShieldCheck, AlertTriangle, XOctagon, Activity, Mic, Square, UploadCloud, FileAudio, Monitor, Cpu, HardDrive, Zap, Radio } from 'lucide-react';

export default function App() {
  const [file, setFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const pcmBuffersRef = useRef([]);

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const startRecording = async () => {
    setResult(null);
    pcmBuffersRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        pcmBuffersRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      setRecording(true);
    } catch (err) {
      alert('Microphone access denied or not supported by browser.');
    }
  };

  const stopRecording = () => {
    if (processorRef.current) processorRef.current.disconnect();
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (audioContextRef.current) audioContextRef.current.close();

    const samples = flattenBuffers(pcmBuffersRef.current);
    const wavBlob = createWavBlob(samples, 16000);
    const recordedFile = new File([wavBlob], 'live_recording.wav', { type: 'audio/wav' });

    setFile(recordedFile);
    setRecording(false);
  };

  const flattenBuffers = (buffers) => {
    let length = 0;
    buffers.forEach(b => length += b.length);
    const result = new Float32Array(length);
    let offset = 0;
    buffers.forEach(b => {
      result.set(b, offset);
      offset += b.length;
    });
    return result;
  };

  const createWavBlob = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  const analyzeAudio = async () => {
    if (!file) return;
    setLoading(true);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://127.0.0.1:8000/score', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      alert('Error connecting to backend API. Make sure Uvicorn is running!');
    } finally {
      setLoading(false);
    }
  };

  const customStyles = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root { margin: 0; padding: 0; width: 100%; min-height: 100vh; background-color: #030712; }
    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      50% { opacity: 0.85; transform: scale(0.99); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
      100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .glow-border {
      border: 1px solid rgba(59, 130, 246, 0.3);
      box-shadow: 0 0 25px rgba(59, 130, 246, 0.08), inset 0 0 15px rgba(59, 130, 246, 0.03);
    }
    .glow-border:hover {
      border-color: rgba(59, 130, 246, 0.6);
      box-shadow: 0 0 30px rgba(59, 130, 246, 0.2), inset 0 0 20px rgba(59, 130, 246, 0.06);
    }
    button:hover {
      filter: brightness(1.2);
      transform: translateY(-1px);
      transition: all 0.2s ease;
    }
    .responsive-grid {
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 24px;
      width: 100%;
      flex: 1;
    }
    @media (max-width: 968px) {
      .responsive-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', width: '100%', minHeight: '100vh', backgroundColor: '#030712', color: '#f8fafc', padding: 'clamp(16px, 3vw, 32px)', margin: 0, display: 'flex', flexDirection: 'column', backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #030712 70%)', boxSizing: 'border-box' }}>
      <style>{customStyles}</style>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '18px', marginBottom: '24px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'linear-gradient(135deg, #3b82f6, #4f46e5)', padding: '14px', borderRadius: '14px', display: 'flex', boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)', flexShrink: 0 }}>
            <Activity color="#fff" size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(16px, 2vw, 22px)', fontWeight: '800', letterSpacing: '-0.025em', background: 'linear-gradient(90deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AegisVoice AI • Biometric Anti-Spoofing Operations Center
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: 'clamp(11px, 1.2vw, 13px)', color: '#94a3b8' }}>Smart India Hackathon 2026 • Problem Statement 104 • Advanced Neural Network & Spectral Deepfake Shield</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(15, 23, 42, 0.8)', padding: '8px 16px', borderRadius: '30px', border: '1px solid rgba(52, 211, 153, 0.3)', fontSize: '13px', color: '#34d399', boxShadow: '0 0 15px rgba(52, 211, 153, 0.1)' }}>
          <Radio size={16} />
          <span>Telemetry Stream Active</span>
        </div>
      </div>

      {/* Main Responsive Layout Grid */}
      <div className="responsive-grid">
        
        {/* Left Control Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          
          <div className="glow-border" style={{ background: 'rgba(11, 17, 32, 0.75)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '18px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Monitor size={16} color="#3b82f6" /> Capture Engine
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
              {!recording ? (
                <button 
                  onClick={startRecording}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '13px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)', width: '100%' }}
                >
                  <Mic size={18} /> Record Live Speech Stream
                </button>
              ) : (
                <button 
                  onClick={stopRecording}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '13px', background: '#334155', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', animation: 'pulse 1.5s infinite', width: '100%' }}
                >
                  <Square size={18} /> Stop Recording Buffer
                </button>
              )}

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '13px', background: 'rgba(30, 41, 59, 0.6)', color: '#f8fafc', border: '1px dashed rgba(100, 116, 139, 0.5)', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', width: '100%', textAlign: 'center' }}>
                <UploadCloud size={18} color="#38bdf8" /> Upload Audio Target (.wav)
                <input type="file" accept="audio/*" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
            </div>

            {file && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#34d399', background: 'rgba(52, 211, 153, 0.08)', padding: '12px 14px', borderRadius: '10px', marginBottom: '18px', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                <FileAudio size={16} /> 
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Target: <strong>{file.name}</strong>
                </div>
              </div>
            )}

            <button 
              onClick={analyzeAudio} 
              disabled={!file || loading || recording}
              style={{ width: '100%', padding: '14px', background: file && !recording ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(51, 65, 85, 0.5)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: file && !recording ? 'pointer' : 'not-allowed', boxShadow: file && !recording ? '0 6px 20px rgba(59, 130, 246, 0.4)' : 'none', transition: 'all 0.2s' }}
            >
              {loading ? 'Running Neural Inference...' : 'Execute Deepfake Security Scan'}
            </button>
          </div>

          <div className="glow-border" style={{ background: 'rgba(11, 17, 32, 0.75)', backdropFilter: 'blur(12px)', padding: '20px', borderRadius: '18px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>System Architecture Specs</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cbd5e1' }}>
                <Cpu size={15} color="#3b82f6" /> <span>Core Inference: PyTorch AASIST Backend</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cbd5e1' }}>
                <HardDrive size={15} color="#3b82f6" /> <span>Feature Extraction: Librosa (MFCC + Centroid)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cbd5e1' }}>
                <Zap size={15} color="#3b82f6" /> <span>Interface: React + Vite Full-Width UI</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Telemetry & Results Analytics View */}
        <div className="glow-border" style={{ background: 'rgba(11, 17, 32, 0.75)', backdropFilter: 'blur(12px)', padding: 'clamp(20px, 3vw, 32px)', borderRadius: '18px', display: 'flex', flexDirection: 'column', justifyContent: result ? 'flex-start' : 'center', alignItems: result ? 'stretch' : 'center', width: '100%', minHeight: '350px' }}>
          
          {!result ? (
            <div style={{ textAlign: 'center', color: '#64748b', maxWidth: '420px', margin: 'auto' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.05)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <Activity size={36} color="#3b82f6" style={{ opacity: 0.6 }} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', color: '#cbd5e1', fontSize: '18px', fontWeight: '600' }}>Awaiting Telemetry Input Stream</h3>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>Upload an audio sample or execute live speech recording on the left panel to initialize model evaluation and acoustic variance tracking.</p>
            </div>
          ) : (
            <div style={{ animation: 'fadeIn 0.35s ease-in-out', width: '100%' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '16px', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Activity size={20} color="#38bdf8" /> Threat Analysis Telemetry Report
                </h3>
                <span style={{ fontSize: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#38bdf8', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  ID: {Math.random().toString(36).substring(2, 9).toUpperCase()}
                </span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(3, 7, 18, 0.6)', padding: '18px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Audio File</p>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '15px', color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.filename}</p>
                </div>
                <div style={{ background: 'rgba(3, 7, 18, 0.6)', padding: '18px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Computed Risk Score</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: result.risk_score > 40 ? '#f59e0b' : '#10b981' }}>
                    {result.risk_score} <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'normal' }}>/ 100</span>
                  </p>
                </div>
              </div>
              
              <div style={{ 
                padding: '18px 22px', 
                borderRadius: '14px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px',
                color: '#fff',
                fontWeight: '600',
                backgroundColor: result.status === 'SAFE' ? 'rgba(16, 185, 129, 0.12)' : result.status === 'SUSPICIOUS' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${result.status === 'SAFE' ? '#10b981' : result.status === 'SUSPICIOUS' ? '#f59e0b' : '#ef4444'}`,
                marginBottom: '24px',
                boxShadow: `0 0 20px ${result.status === 'SAFE' ? 'rgba(16, 185, 129, 0.1)' : result.status === 'SUSPICIOUS' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)'}`
              }}>
                {result.status === 'SAFE' && <ShieldCheck color="#10b981" size={28} />}
                {(result.status === 'SUSPICIOUS' || result.status === 'SUSPICIONS') && <AlertTriangle color="#f59e0b" size={28} />}
                {result.status === 'CRITICAL' && <XOctagon color="#ef4444" size={28} />}
                <div>
                  <div style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}>Classification Verdict</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: result.status === 'SAFE' ? '#34d399' : result.status === 'SUSPICIOUS' ? '#fbbf24' : '#f87171' }}>
                    {result.status}
                  </div>
                </div>
              </div>

              {result.spectral_analysis && (
                <div style={{ background: 'rgba(3, 7, 18, 0.6)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)', marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Acoustic Spectral Variance Matrix</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b' }}>MFCC Variance</p>
                      <p style={{ margin: 0, fontSize: '17px', fontWeight: '700', fontFamily: 'monospace', color: '#38bdf8' }}>{result.spectral_analysis.mfcc_variance}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b' }}>Centroid Variance</p>
                      <p style={{ margin: 0, fontSize: '17px', fontWeight: '700', fontFamily: 'monospace', color: '#38bdf8' }}>{result.spectral_analysis.centroid_variance}</p>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: '14px', color: '#e2e8f0', background: 'rgba(3, 7, 18, 0.6)', padding: '18px 22px', borderRadius: '14px', borderLeft: '4px solid #3b82f6', border: '1px solid rgba(255, 255, 255, 0.06)', lineHeight: '1.5' }}>
                <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Operational Countermeasure Directive:</strong> 
                {result.recommendation}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}