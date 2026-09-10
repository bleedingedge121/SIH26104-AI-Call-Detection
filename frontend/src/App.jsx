import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  XOctagon,
  Activity,
  Mic,
  Square,
  UploadCloud,
  FileAudio,
  Cpu,
  HardDrive,
  RefreshCw,
  Terminal,
  PlayCircle,
  Radio,
  FileCheck
} from 'lucide-react';

export default function App() {
  const [file, setFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);

  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const pcmBuffersRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/health')
      .then((res) => setBackendOnline(res.ok))
      .catch(() => setBackendOnline(false));
  }, []);

  useEffect(() => {
    if (recording) {
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const loadPresetSample = async (url, filename) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Sample not found');
      const blob = await res.blob();
      const sampleFile = new File([blob], filename, { type: 'audio/wav' });
      setFile(sampleFile);
      setResult(null);
    } catch (err) {
      alert(`Could not load preset sample: ${err.message}`);
    }
  };

  const startRecording = async () => {
    setResult(null);
    pcmBuffersRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });
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
      alert('Microphone access denied or audio input device not found.');
    }
  };

  const stopRecording = () => {
    if (processorRef.current) processorRef.current.disconnect();
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    if (audioContextRef.current) audioContextRef.current.close();

    const samples = flattenBuffers(pcmBuffersRef.current);
    const wavBlob = createWavBlob(samples, 16000);
    const recordedFile = new File([wavBlob], 'live_recording.wav', { type: 'audio/wav' });

    setFile(recordedFile);
    setRecording(false);
  };

  const flattenBuffers = (buffers) => {
    let length = 0;
    buffers.forEach((b) => (length += b.length));
    const flat = new Float32Array(length);
    let offset = 0;
    buffers.forEach((b) => {
      flat.set(b, offset);
      offset += b.length;
    });
    return flat;
  };

  const createWavBlob = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
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
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
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

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (HTTP ${response.status})`);
      }

      const data = await response.json();
      setResult(data);
      setBackendOnline(true);
    } catch (error) {
      alert(`Inference API Error: ${error.message}. Make sure the backend server is running on port 8000.`);
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.appContainer}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.brandGroup}>
          <div style={styles.brandIcon}>
            <Terminal size={18} color="#38bdf8" />
          </div>
          <div>
            <div style={styles.brandTitleRow}>
              <span style={styles.brandTitle}>AEGISVOICE</span>
              <span style={styles.brandDivider}>|</span>
              <span style={styles.brandSubtitle}>Voice Fraud & Call Deepfake Detection Console</span>
            </div>
            <div style={styles.brandMeta}>
              Smart India Hackathon 2026 • Problem Statement 104 • Wav2Vec2 + Spectral Analysis
            </div>
          </div>
        </div>

        <div style={styles.systemStatus}>
          <div
            style={{
              ...styles.statusIndicatorDot,
              backgroundColor: backendOnline ? '#10b981' : '#ef4444',
            }}
          />
          <span style={styles.statusLabel}>
            SYSTEM: {backendOnline ? 'ONLINE' : 'BACKEND DISCONNECTED'}
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <main style={styles.workspaceGrid}>
        {/* Left Column: Controls */}
        <section style={styles.columnLeft}>
          <div style={styles.card}>
            <h2 style={styles.cardHeading}>AUDIO INPUT</h2>

            {/* Quick Test Audio Bench */}
            <div style={styles.presetSection}>
              <div style={styles.presetLabel}>QUICK TEST AUDIO</div>
              <div style={styles.presetButtonGroup}>
                <button
                  type="button"
                  onClick={() => loadPresetSample('/samples/sample_real.wav', 'sample_real.wav')}
                  style={styles.presetButton}
                >
                  <PlayCircle size={14} color="#10b981" />
                  <span>Authentic Voice</span>
                </button>
                <button
                  type="button"
                  onClick={() => loadPresetSample('/samples/sample_spoof.wav', 'sample_spoof.wav')}
                  style={styles.presetButton}
                >
                  <PlayCircle size={14} color="#ef4444" />
                  <span>Synthetic Clone</span>
                </button>
              </div>
            </div>

            {/* Upload Area & Recording Controls */}
            <div style={styles.inputControls}>
              <label style={styles.uploadArea}>
                <UploadCloud size={24} color="#38bdf8" />
                <div style={styles.uploadTextPrimary}>Upload Audio Recording</div>
                <div style={styles.uploadTextSecondary}>Supports WAV, MP3, FLAC, OGG</div>
                <input
                  type="file"
                  accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>

              {!recording ? (
                <button type="button" onClick={startRecording} style={styles.micRecordButton}>
                  <Mic size={16} color="#f1f5f9" />
                  <span>Record from Microphone</span>
                </button>
              ) : (
                <button type="button" onClick={stopRecording} style={styles.micStopButton}>
                  <div style={styles.recordingPulseDot} />
                  <Square size={14} color="#f87171" fill="#f87171" />
                  <span>Stop Recording ({formatDuration(recordDuration)})</span>
                </button>
              )}
            </div>

            {/* Selected File Details */}
            {file && (
              <div style={styles.fileCard}>
                <FileAudio size={18} color="#38bdf8" style={{ flexShrink: 0 }} />
                <div style={styles.fileCardContent}>
                  <div style={styles.fileName}>{file.name}</div>
                  <div style={styles.fileSize}>
                    {(file.size / 1024).toFixed(1)} KB • {file.type || 'audio/wav'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setResult(null);
                  }}
                  style={styles.clearFileButton}
                  title="Remove target"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Action CTA */}
            <button
              type="button"
              onClick={analyzeAudio}
              disabled={!file || loading || recording}
              style={{
                ...styles.analyzeButton,
                ...(!file || loading || recording ? styles.analyzeButtonDisabled : {}),
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="spin-icon" style={styles.spinAnimation} />
                  <span>Analyzing Audio...</span>
                </>
              ) : (
                <>
                  <Activity size={16} />
                  <span>ANALYZE AUDIO</span>
                </>
              )}
            </button>
          </div>

          {/* System Specs */}
          <div style={styles.cardMuted}>
            <div style={styles.specsHeading}>SYSTEM ARCHITECTURE</div>
            <div style={styles.specItem}>
              <Cpu size={14} color="#64748b" />
              <span>Model: Wav2Vec2 Audio Classifier</span>
            </div>
            <div style={styles.specItem}>
              <HardDrive size={14} color="#64748b" />
              <span>Sample Rate: 16,000 Hz Mono</span>
            </div>
            <div style={styles.specItem}>
              <Activity size={14} color="#64748b" />
              <span>Auxiliary: MFCC & Spectral Centroid Variance</span>
            </div>
          </div>
        </section>

        {/* Right Column: Output */}
        <section style={styles.columnRight}>
          {!result ? (
            <div style={styles.emptyStateCard}>
              <div style={styles.emptyIconBox}>
                <Radio size={32} color="#64748b" />
              </div>
              <h3 style={styles.emptyTitle}>Ready for Analysis</h3>
              <p style={styles.emptyText}>
                Select a test sample on the left, upload an audio file, or record speech through your microphone to generate a deepfake risk assessment.
              </p>
              <div style={styles.emptyWorkflow}>
                <div style={styles.workflowStep}>
                  <span style={styles.workflowIndex}>1</span>
                  <span>Select or upload audio clip</span>
                </div>
                <div style={styles.workflowStep}>
                  <span style={styles.workflowIndex}>2</span>
                  <span>Click Analyze Audio</span>
                </div>
                <div style={styles.workflowStep}>
                  <span style={styles.workflowIndex}>3</span>
                  <span>Review classification, risk score, and spectral metrics</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.resultsContainer}>
              {/* Verdict Banner */}
              <div
                style={{
                  ...styles.verdictBanner,
                  borderColor:
                    result.status === 'SAFE'
                      ? '#10b981'
                      : result.status === 'SUSPICIOUS'
                      ? '#f59e0b'
                      : '#ef4444',
                  backgroundColor:
                    result.status === 'SAFE'
                      ? 'rgba(16, 185, 129, 0.08)'
                      : result.status === 'SUSPICIOUS'
                      ? 'rgba(245, 158, 11, 0.08)'
                      : 'rgba(239, 68, 68, 0.08)',
                }}
              >
                <div style={styles.verdictLeft}>
                  {result.status === 'SAFE' && <ShieldCheck size={36} color="#10b981" />}
                  {result.status === 'SUSPICIOUS' && <AlertTriangle size={36} color="#f59e0b" />}
                  {result.status === 'CRITICAL' && <XOctagon size={36} color="#ef4444" />}

                  <div>
                    <div style={styles.verdictSubtext}>AUTHENTICITY CLASSIFICATION</div>
                    <div
                      style={{
                        ...styles.verdictTitle,
                        color:
                          result.status === 'SAFE'
                            ? '#10b981'
                            : result.status === 'SUSPICIOUS'
                            ? '#f59e0b'
                            : '#ef4444',
                      }}
                    >
                      {result.status === 'SAFE' && 'AUTHENTIC HUMAN SPEECH'}
                      {result.status === 'SUSPICIOUS' && 'SUSPICIOUS VOICE ANOMALIES'}
                      {result.status === 'CRITICAL' && 'SYNTHETIC / CLONED VOICE DETECTED'}
                    </div>
                  </div>
                </div>

                <div style={styles.verdictBadge}>
                  <span style={styles.verdictBadgeLabel}>STATUS</span>
                  <span
                    style={{
                      ...styles.verdictBadgeValue,
                      color:
                        result.status === 'SAFE'
                          ? '#10b981'
                          : result.status === 'SUSPICIOUS'
                          ? '#f59e0b'
                          : '#ef4444',
                    }}
                  >
                    {result.status}
                  </span>
                </div>
              </div>

              {/* Risk Score */}
              <div style={styles.card}>
                <div style={styles.scoreMeterHeader}>
                  <div>
                    <span style={styles.metricLabel}>COMPUTED RISK SCORE</span>
                    <div style={styles.scoreValueRow}>
                      <span
                        style={{
                          ...styles.scoreNumber,
                          color:
                            result.risk_score > 70
                              ? '#ef4444'
                              : result.risk_score > 40
                              ? '#f59e0b'
                              : '#10b981',
                        }}
                      >
                        {result.risk_score}
                      </span>
                      <span style={styles.scoreScale}>/ 100</span>
                    </div>
                  </div>

                  <div style={styles.scoreThresholds}>
                    <div style={styles.thresholdItem}>
                      <span style={{ color: '#10b981' }}>●</span> Low Risk: ≤40
                    </div>
                    <div style={styles.thresholdItem}>
                      <span style={{ color: '#f59e0b' }}>●</span> Suspicious: 41-70
                    </div>
                    <div style={styles.thresholdItem}>
                      <span style={{ color: '#ef4444' }}>●</span> High Risk: &gt;70
                    </div>
                  </div>
                </div>

                <div style={styles.gaugeTrack}>
                  <div
                    style={{
                      ...styles.gaugeFill,
                      width: `${Math.min(100, Math.max(0, result.risk_score))}%`,
                      backgroundColor:
                        result.risk_score > 70
                          ? '#ef4444'
                          : result.risk_score > 40
                          ? '#f59e0b'
                          : '#10b981',
                    }}
                  />
                  <div style={{ ...styles.gaugeMarker, left: '40%' }} title="Threshold: 40" />
                  <div style={{ ...styles.gaugeMarker, left: '70%' }} title="Threshold: 70" />
                </div>
              </div>

              {/* Metrics Grid */}
              <div style={styles.metricGrid}>
                <div style={styles.metricCard}>
                  <span style={styles.metricCardLabel}>MODEL PREDICTION</span>
                  <div style={styles.metricCardValue}>
                    {result.model_prediction ? result.model_prediction.toUpperCase() : (result.status === 'SAFE' ? 'REAL' : 'FAKE')}
                  </div>
                  <div style={styles.metricCardHint}>Neural Classifier</div>
                </div>

                <div style={styles.metricCard}>
                  <span style={styles.metricCardLabel}>CONFIDENCE</span>
                  <div style={styles.metricCardValue}>
                    {result.model_confidence ? `${(result.model_confidence * 100).toFixed(1)}%` : '100.0%'}
                  </div>
                  <div style={styles.metricCardHint}>Posterior Probability</div>
                </div>

                <div style={styles.metricCard}>
                  <span style={styles.metricCardLabel}>SYNTHETIC PROBABILITY</span>
                  <div style={{ ...styles.metricCardValue, color: '#ef4444' }}>
                    {result.fake_probability !== undefined ? `${(result.fake_probability * 100).toFixed(1)}%` : `${result.risk_score}%`}
                  </div>
                  <div style={styles.metricCardHint}>Spoof Indicator</div>
                </div>

                <div style={styles.metricCard}>
                  <span style={styles.metricCardLabel}>AUTHENTIC PROBABILITY</span>
                  <div style={{ ...styles.metricCardValue, color: '#10b981' }}>
                    {result.real_probability !== undefined ? `${(result.real_probability * 100).toFixed(1)}%` : `${(100 - result.risk_score).toFixed(1)}%`}
                  </div>
                  <div style={styles.metricCardHint}>Human Speech Indicator</div>
                </div>
              </div>

              {/* Security Directive */}
              <div style={styles.directiveCard}>
                <div style={styles.directiveHeader}>
                  <FileCheck size={16} color="#38bdf8" />
                  <span style={styles.directiveTitle}>SECURITY DIRECTIVE</span>
                </div>
                <div style={styles.directiveBody}>{result.recommendation}</div>
                <div style={styles.directiveSubtext}>
                  {result.status === 'SAFE'
                    ? 'Caller voice characteristics match natural human organic acoustics. Standard transaction protocol authorized.'
                    : 'Flagged by voice authenticity shield. Do not disclose OTPs or permit account recovery without secondary out-of-band verification.'}
                </div>
              </div>

              {/* Acoustic Spectral Analysis */}
              {result.spectral_analysis && (
                <div style={styles.card}>
                  <div style={styles.evidenceHeader}>
                    <Activity size={15} color="#94a3b8" />
                    <span style={styles.evidenceTitle}>ACOUSTIC SPECTRAL EVIDENCE</span>
                  </div>
                  <div style={styles.spectralGrid}>
                    <div style={styles.spectralItem}>
                      <span style={styles.spectralItemLabel}>MFCC VARIANCE</span>
                      <span style={styles.spectralItemValue}>{result.spectral_analysis.mfcc_variance}</span>
                      <span style={styles.spectralItemNote}>
                        Measures timbre variance across time frames.
                      </span>
                    </div>

                    <div style={styles.spectralItem}>
                      <span style={styles.spectralItemLabel}>SPECTRAL CENTROID VARIANCE</span>
                      <span style={styles.spectralItemValue}>{result.spectral_analysis.centroid_variance}</span>
                      <span style={styles.spectralItemNote}>
                        Measures frequency distribution center of mass movement.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Audit Footer */}
              <div style={styles.auditBar}>
                <span>FILE: <code>{result.filename}</code></span>
                <span>CHANNELS: <code>MONO (16 kHz)</code></span>
                <span>HTTP: <code>200 OK</code></span>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const styles = {
  appContainer: {
    width: '100%',
    minHeight: '100vh',
    backgroundColor: '#0c1017',
    color: '#f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 28px',
    borderBottom: '1px solid #1e293b',
    backgroundColor: '#0f141d',
    gap: '16px',
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  brandIcon: {
    backgroundColor: '#162235',
    border: '1px solid #253654',
    borderRadius: '8px',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  brandTitle: {
    fontSize: '17px',
    fontWeight: '800',
    letterSpacing: '0.05em',
    color: '#f8fafc',
  },
  brandDivider: {
    color: '#475569',
  },
  brandSubtitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#94a3b8',
  },
  brandMeta: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '2px',
  },
  systemStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    backgroundColor: '#131b27',
    border: '1px solid #1e293b',
    borderRadius: '20px',
  },
  statusIndicatorDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusLabel: {
    fontSize: '12px',
    fontWeight: '600',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    color: '#cbd5e1',
  },
  workspaceGrid: {
    display: 'grid',
    gridTemplateColumns: '380px 1fr',
    gap: '24px',
    padding: '28px',
    flex: 1,
    maxWidth: '1600px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  columnLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  columnRight: {
    display: 'flex',
    flexDirection: 'column',
  },
  card: {
    backgroundColor: '#111722',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  cardMuted: {
    backgroundColor: '#0f141d',
    border: '1px solid #1b2433',
    borderRadius: '10px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardHeading: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '0.06em',
    color: '#e2e8f0',
  },
  presetSection: {
    backgroundColor: '#0c1017',
    border: '1px solid #1a2333',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  presetLabel: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.06em',
    color: '#64748b',
  },
  presetButtonGroup: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  presetButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    backgroundColor: '#131b27',
    border: '1px solid #243248',
    color: '#e2e8f0',
    padding: '8px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  inputControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  uploadArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '24px 16px',
    border: '1px dashed #334155',
    borderRadius: '8px',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    cursor: 'pointer',
    textAlign: 'center',
  },
  uploadTextPrimary: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#f1f5f9',
  },
  uploadTextSecondary: {
    fontSize: '11px',
    color: '#64748b',
  },
  micRecordButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '12px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#f8fafc',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  micStopButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '12px',
    backgroundColor: '#450a0a',
    border: '1px solid #991b1b',
    borderRadius: '8px',
    color: '#fca5a5',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  recordingPulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
  },
  fileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: '#131d2b',
    border: '1px solid #1e3a5f',
    borderRadius: '6px',
  },
  fileCardContent: {
    flex: 1,
    overflow: 'hidden',
  },
  fileName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f1f5f9',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  fileSize: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px',
  },
  clearFileButton: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px',
  },
  analyzeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    backgroundColor: '#0284c7',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '0.04em',
    cursor: 'pointer',
  },
  analyzeButtonDisabled: {
    backgroundColor: '#1e293b',
    color: '#64748b',
    cursor: 'not-allowed',
  },
  specsHeading: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.07em',
    color: '#64748b',
  },
  specItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#94a3b8',
  },
  emptyStateCard: {
    backgroundColor: '#111722',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '64px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    flex: 1,
  },
  emptyIconBox: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#16202e',
    border: '1px solid #202d42',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  emptyTitle: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: '700',
    color: '#e2e8f0',
  },
  emptyText: {
    margin: '0 0 28px 0',
    fontSize: '13px',
    color: '#64748b',
    maxWidth: '460px',
    lineHeight: '1.5',
  },
  emptyWorkflow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    textAlign: 'left',
    width: '100%',
    maxWidth: '380px',
  },
  workflowStep: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    backgroundColor: '#0c1017',
    border: '1px solid #1b2638',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#cbd5e1',
  },
  workflowIndex: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#38bdf8',
    backgroundColor: '#162338',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  verdictBanner: {
    padding: '18px 24px',
    borderRadius: '10px',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  verdictLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  verdictSubtext: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.08em',
    color: '#94a3b8',
  },
  verdictTitle: {
    fontSize: '20px',
    fontWeight: '800',
    letterSpacing: '0.02em',
    marginTop: '2px',
  },
  verdictBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  verdictBadgeLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: '0.06em',
  },
  verdictBadgeValue: {
    fontSize: '18px',
    fontWeight: '800',
    fontFamily: 'ui-monospace, monospace',
  },
  scoreMeterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '12px',
  },
  metricLabel: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.06em',
    color: '#64748b',
  },
  scoreValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    marginTop: '4px',
  },
  scoreNumber: {
    fontSize: '36px',
    fontWeight: '800',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    lineHeight: '1',
  },
  scoreScale: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: '600',
  },
  scoreThresholds: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '11px',
    color: '#94a3b8',
    fontFamily: 'ui-monospace, monospace',
  },
  thresholdItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  gaugeTrack: {
    width: '100%',
    height: '10px',
    backgroundColor: '#1b2433',
    borderRadius: '5px',
    position: 'relative',
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: '5px',
    transition: 'width 0.4s ease',
  },
  gaugeMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '2px',
    backgroundColor: '#334155',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
  },
  metricCard: {
    backgroundColor: '#111722',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metricCardLabel: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.06em',
    color: '#64748b',
  },
  metricCardValue: {
    fontSize: '20px',
    fontWeight: '800',
    fontFamily: 'ui-monospace, monospace',
    color: '#f8fafc',
  },
  metricCardHint: {
    fontSize: '10px',
    color: '#64748b',
  },
  directiveCard: {
    backgroundColor: '#101926',
    border: '1px solid #1e3a5f',
    borderRadius: '8px',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  directiveHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  directiveTitle: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.07em',
    color: '#38bdf8',
  },
  directiveBody: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#f1f5f9',
    marginTop: '2px',
  },
  directiveSubtext: {
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: '1.4',
  },
  evidenceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  evidenceTitle: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.06em',
    color: '#94a3b8',
  },
  spectralGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  spectralItem: {
    backgroundColor: '#0c1017',
    border: '1px solid #1c2638',
    borderRadius: '6px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  spectralItemLabel: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.05em',
    color: '#64748b',
  },
  spectralItemValue: {
    fontSize: '22px',
    fontWeight: '800',
    fontFamily: 'ui-monospace, monospace',
    color: '#38bdf8',
  },
  spectralItemNote: {
    fontSize: '11px',
    color: '#64748b',
    lineHeight: '1.4',
  },
  auditBar: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: '10px 14px',
    backgroundColor: '#0c1017',
    border: '1px solid #1a2434',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#64748b',
    fontFamily: 'ui-monospace, monospace',
    gap: '10px',
  },
  spinAnimation: {
    animation: 'spin 1s linear infinite',
  },
};