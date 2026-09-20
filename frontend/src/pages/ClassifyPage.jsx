import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, 
  Sparkles, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  FileImage,
  RefreshCw,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import api from '../api';

function ClassifyPage() {
  const navigate = useNavigate();
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/classify', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Classification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
  });

  const categoryIcons = {
    Plastic: '🧴',
    Paper: '📄',
    Metal: '🔩',
    Glass: '🥃',
    Organic: '🍎',
    Other: '📦',
  };

  const isRecyclable = (cat) => {
    return ['Plastic', 'Paper', 'Metal', 'Glass'].includes(cat);
  };

  return (
    <div className="page-container">
      {/* Editorial Page Header */}
      <div className="page-header-editorial">
        <div className="header-left">
          <div className="header-category-badge">
            <Sparkles size={13} />
            Computer Vision Inference · ResNet-18 · 224×224 RGB
          </div>
          <h1 className="editorial-title">
            Visual <em>intelligence</em> for waste classification
          </h1>
          <p className="editorial-subtitle">
            Upload waste item imagery to instantly infer material category and sorting stream via on-device PyTorch ResNet-18 (ImageNet pretrained).
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/')}
            title="Return to Dashboard"
          >
            <span>← Back to Dashboard</span>
          </button>
        </div>
      </div>

      {/* ── Vision HUD KPI Matrix ── */}
      <div className="hud-kpi-matrix-3" style={{ marginBottom: '24px' }}>
        <div className="hud-kpi-card kpi-dark">
          <div className="kpi-card-glow-bg"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Vision Architecture</span>
              <div className="kpi-icon-pill icon-dark"><Cpu size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number">ResNet-18</span>
              <span className="kpi-unit">Residual Net</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill" style={{ width: '100%', background: 'linear-gradient(90deg, #38bdf8, #3b82f6)' }}></div>
              </div>
              <span className="kpi-subtext">Pretrained on <strong>ImageNet-1K</strong> weights</span>
            </div>
          </div>
        </div>

        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-cyan"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Tensor Resolution</span>
              <div className="kpi-icon-pill icon-cyan"><FileImage size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-cyan-gradient">224×224</span>
              <span className="kpi-unit-pill pill-cyan">RGB 3-Channel</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-cyan" style={{ width: '100%' }}></div>
              </div>
              <span className="kpi-subtext">Zero-mean unit-variance normalized tensors</span>
            </div>
          </div>
        </div>

        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-emerald"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Diversion Target</span>
              <div className="kpi-icon-pill icon-emerald"><Sparkles size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-emerald-gradient">6 Streams</span>
              <span className="kpi-unit-pill pill-emerald">Plastic · Metal...</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-emerald" style={{ width: '100%' }}></div>
              </div>
              <span className="kpi-subtext">Automated dual-stream circular routing</span>
            </div>
          </div>
        </div>
      </div>

      <div className="classify-layout-editorial">
        {/* Left: Upload card */}
        <div className="card classify-upload-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-neutral">Input Feed</div>
              <h3>Source Imagery</h3>
            </div>
            {preview && (
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setImage(null);
                  setPreview(null);
                  setResult(null);
                }}
              >
                Clear Image
              </button>
            )}
          </div>
          <div className="card-body">
            <div
              {...getRootProps()}
              className={`modern-dropzone ${isDragActive ? 'drag-active' : ''} ${preview ? 'has-preview' : ''}`}
            >
              <input {...getInputProps()} />
              {preview ? (
                <div className="preview-container">
                  <img src={preview} alt="Uploaded waste sample" className="modern-preview-img" />
                  <div className="preview-overlay">
                    <UploadCloud size={20} />
                    <span>Click or drop new image to replace</span>
                  </div>
                </div>
              ) : (
                <div className="dropzone-prompt">
                  <div className="dropzone-icon-circle">
                    <UploadCloud size={28} />
                  </div>
                  <div className="dropzone-headline">
                    {isDragActive ? 'Release image to classify' : 'Click or drag & drop item image'}
                  </div>
                  <p className="dropzone-sub">
                    Accepts PNG, JPG, JPEG, WEBP · Processed in real-time
                  </p>
                  <div className="dropzone-pill">
                    <Cpu size={12} /> ResNet-18 Model Ready
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Results Card */}
        <div className="card classify-results-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-blue">Inference Engine</div>
              <h3>Classification Telemetry</h3>
            </div>
            {result && (
              <span className={`pill-counter ${isRecyclable(result.category) ? 'pill-success' : 'pill-neutral'}`}>
                {isRecyclable(result.category) ? 'Recyclable Stream' : 'Special Processing'}
              </span>
            )}
          </div>
          
          <div className="card-body">
            {loading && (
              <div className="classify-loading-state">
                <div className="modern-spinner"></div>
                <h4>Analyzing Image Tensor...</h4>
                <p>Running ResNet-18 deep residual network inference</p>
              </div>
            )}

            {error && (
              <div className="modern-alert alert-error">
                <AlertCircle size={20} />
                <div>
                  <div className="alert-title">Inference Error</div>
                  <div className="alert-desc">{error}</div>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="classify-result-content">
                <div className="result-hero-box">
                  <div className="result-icon-display">
                    {categoryIcons[result.category] || '📦'}
                  </div>
                  <div className="result-hero-text">
                    <div className="result-label-sub">Identified Material</div>
                    <div className="result-hero-category">{result.category}</div>
                    <div className="result-hero-meta">
                      <span className="confidence-pill">
                        {(result.confidence * 100).toFixed(1)}% Confidence
                      </span>
                      <span className="stream-pill">
                        {isRecyclable(result.category) ? '♻️ Recyclable' : '⚠️ Non-Recyclable'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="probabilities-section">
                  <div className="section-subtitle">
                    <span>Softmax Probability Distribution</span>
                  </div>
                  <div className="probability-bars-grid">
                    {result.all_probabilities &&
                      Object.entries(result.all_probabilities)
                        .sort(([, a], [, b]) => b - a)
                        .map(([cls, prob]) => {
                          const percent = (prob * 100).toFixed(1);
                          const isTop = cls === result.category;
                          return (
                            <div key={cls} className={`prob-row ${isTop ? 'top-match' : ''}`}>
                              <div className="prob-header">
                                <span className="prob-name">
                                  <span className="prob-emoji">{categoryIcons[cls] || '📦'}</span>
                                  {cls}
                                </span>
                                <span className="prob-num">{percent}%</span>
                              </div>
                              <div className="prob-track">
                                <div 
                                  className={`prob-fill ${isTop ? 'fill-winner' : ''}`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                  </div>
                </div>
              </div>
            )}

            {!result && !loading && !error && (
              <div className="classify-empty-state">
                <div className="empty-graphic-block">
                  <FileImage size={40} className="empty-graphic-icon" />
                </div>
                <h4>Awaiting Material Input</h4>
                <p>Drag an image into the upload bay on the left to extract real-time AI classification metrics.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClassifyPage;
