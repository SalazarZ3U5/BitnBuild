import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
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
      setError(err.response?.data?.detail || 'Classification failed');
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

  return (
    <div>
      <div className="page-header">
        <h2>Waste Classification</h2>
        <p>Upload an image to identify the waste category using AI</p>
      </div>

      <div className="classify-layout">
        <div className="card">
          <div className="card-header">
            <h3>📸 Upload Image</h3>
          </div>
          <div className="card-body">
            <div
              {...getRootProps()}
              className={`dropzone ${isDragActive ? 'active' : ''}`}
            >
              <input {...getInputProps()} />
              <div className="dropzone-icon">📷</div>
              <p>
                {isDragActive
                  ? 'Drop the image here...'
                  : 'Drag & drop a waste image, or click to select'}
              </p>
              <p className="hint">Supports JPG, PNG, WebP</p>
            </div>
            {preview && (
              <img src={preview} alt="Preview" className="preview-image" />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>🔍 Classification Result</h3>
          </div>
          <div className="card-body classification-result">
            {loading && (
              <div className="loading">
                <div className="spinner"></div>
                Classifying...
              </div>
            )}
            {error && (
              <div className="alert-item critical">
                <div className="alert-icon">❌</div>
                <div className="alert-content">
                  <div className="alert-message">{error}</div>
                </div>
              </div>
            )}
            {result && !loading && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                    {categoryIcons[result.category] || '❓'}
                  </div>
                  <div className="result-category">{result.category}</div>
                  <div className="result-confidence">
                    {(result.confidence * 100).toFixed(1)}% confidence
                  </div>
                </div>
                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  All Probabilities
                </h4>
                <ul className="probabilities-list">
                  {result.all_probabilities &&
                    Object.entries(result.all_probabilities)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cls, prob]) => (
                        <li key={cls} className="probability-item">
                          <span className="probability-label">{cls}</span>
                          <div className="probability-bar-bg">
                            <div
                              className="probability-bar"
                              style={{ width: `${prob * 100}%` }}
                            />
                          </div>
                          <span className="probability-value">
                            {(prob * 100).toFixed(1)}%
                          </span>
                        </li>
                      ))}
                </ul>
              </>
            )}
            {!result && !loading && !error && (
              <div className="empty-state">
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤖</p>
                <p>Upload an image to see classification results</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClassifyPage;
