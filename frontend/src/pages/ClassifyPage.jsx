import { useState, useCallback } from 'react';
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
            Computer Vision Inference · 128×128 RGB
          </div>
          <h1 className="editorial-title">
            Visual <em>intelligence</em> for waste classification
          </h1>
          <p className="editorial-subtitle">
            Upload waste item imagery to instantly infer material category and sorting stream via on-device PyTorch LargeNet CNN.
          </p>
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
                    <Cpu size={12} /> LargeNet Model Ready
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
                <p>Passing through 7-layer convolutional neural network</p>
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
