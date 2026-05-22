import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { generateQrDataUrl } from '../utils/qrUtils';
import PrintStickers from '../components/PrintStickers';
import './ProductPage.css';

export default function ProductPage() {
  const { id } = useParams();
  const productId = decodeURIComponent(id);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'products', productId));
        if (!cancelled) {
          if (snap.exists()) {
            setProduct({ ...snap.data(), docId: snap.id });
          } else {
            setError('מוצר לא נמצא');
          }
        }
      } catch (err) {
        if (!cancelled) setError(`שגיאה: ${err.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [productId]);

  const handleGenerateQr = async () => {
    setGenerating(true);
    setError('');
    try {
      const qrCode = await generateQrDataUrl(productId);
      await updateDoc(doc(db, 'products', productId), {
        qrCode,
        qrUrl: `https://psrar.github.io/tal_web_app/#/home/items/${encodeURIComponent(productId)}`,
        qrGeneratedAt: new Date().toISOString(),
      });
      setProduct((prev) => ({ ...prev, qrCode }));
    } catch (err) {
      setError(`שגיאה ביצירת QR: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <span>טוען מוצר...</span>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="product-page">
        <div className="alert-error">{error}</div>
        <Link to="/" className="btn-back">← חזרה לרשימה</Link>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="product-page">
      {showPrint && (
        <PrintStickers
          products={[product]}
          onClose={() => setShowPrint(false)}
        />
      )}

      <div className="product-header">
        <Link to="/" className="btn-back">← חזרה לרשימה</Link>
        <h1 className="product-title">{product.name || product.id}</h1>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="product-layout">
        <div className="product-details-card">
          <div className="card-title">פרטי מוצר</div>

          <div className="detail-list">
          <div className="detail-row">
            <span className="detail-label">מזהה</span>
            <span className="detail-value mono">{product.id}</span>
          </div>

          {product.code && (
            <div className="detail-row">
              <span className="detail-label">ברקוד</span>
              <span className="detail-value mono">{product.code}</span>
            </div>
          )}

          {product.tags && (
            <div className="detail-row">
              <span className="detail-label">תגיות</span>
              <span className="detail-value">{product.tags}</span>
            </div>
          )}

          {product.importedAt && (
            <div className="detail-row">
              <span className="detail-label">יובא ב</span>
              <span className="detail-value text-muted">
                {new Date(product.importedAt).toLocaleString('he-IL')}
              </span>
            </div>
          )}

          {product.qrGeneratedAt && (
            <div className="detail-row">
              <span className="detail-label">QR נוצר ב</span>
              <span className="detail-value text-muted">
                {new Date(product.qrGeneratedAt).toLocaleString('he-IL')}
              </span>
            </div>
          )}

          {product.qrUrl && (
            <div className="detail-row">
              <span className="detail-label">כתובת QR</span>
              <span className="detail-value qr-url-text">{product.qrUrl}</span>
            </div>
          )}
          </div>
        </div>

        <div className="product-qr-card">
          <div className="card-title">קוד QR</div>

          {product.qrCode ? (
            <div className="qr-section">
              <div className="qr-image-wrapper">
                <img
                  src={product.qrCode}
                  alt={`QR עבור ${product.id}`}
                  className="qr-image"
                />
              </div>
              <div className="qr-actions">
                <button
                  className="btn-secondary"
                  onClick={handleGenerateQr}
                  disabled={generating}
                >
                  {generating ? 'מעדכן...' : 'צור מחדש'}
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setShowPrint(true)}
                >
                  הדפס מדבקה
                </button>
              </div>
            </div>
          ) : (
            <div className="qr-empty">
              <div className="qr-empty-icon">?</div>
              <div className="qr-empty-text">אין QR עבור מוצר זה</div>
              <button
                className="btn-generate"
                onClick={handleGenerateQr}
                disabled={generating}
              >
                {generating ? (
                  <><span className="spinner-sm" /> יוצר...</>
                ) : (
                  'צור QR'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
