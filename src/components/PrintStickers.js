import React, { useEffect, useState } from 'react';
import { generateQrDataUrl } from '../utils/qrUtils';
import './PrintStickers.css';

const SAFE_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

export default function PrintStickers({ products, onClose }) {
  const [stickers, setStickers] = useState([]);
  const [preparing, setPreparing] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function prepare() {
      try {
        const result = await Promise.all(
          products.map(async (p) => {
            const qr = p.qrCode || (await generateQrDataUrl(p.id));
            return { ...p, qrCode: qr };
          })
        );
        if (!cancelled) {
          setStickers(result);
          setPreparing(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('שגיאה ביצירת מדבקות. נסה שוב.');
          setPreparing(false);
        }
      }
    }
    prepare();
    return () => { cancelled = true; };
  }, [products]);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('לא ניתן לפתוח חלון הדפסה. אפשר חלונות קופצים בדפדפן.');
      return;
    }

    const stickerHtml = stickers.map((p) => {
      const safeQr = p.qrCode && SAFE_DATA_URL.test(p.qrCode) ? p.qrCode : null;
      return `
      <div class="sticker">
        ${safeQr ? `<img src="${safeQr}" class="sticker-qr" alt="QR" />` : ''}
        <div class="sticker-id">${escapeHtml(p.id)}</div>
        ${p.code ? `<div class="sticker-code">${escapeHtml(p.code)}</div>` : ''}
      </div>
    `;
    }).join('');

    win.document.write(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>מדבקות QR</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: white; }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4mm;
    }
    .sticker {
      border: 0.5pt solid #bbb;
      border-radius: 3mm;
      padding: 3mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2mm;
      min-height: 52mm;
      justify-content: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sticker-qr {
      width: 38mm;
      height: 38mm;
      display: block;
    }
    .sticker-id {
      font-size: 8.5pt;
      font-weight: 700;
      color: #000;
      text-align: center;
      word-break: break-all;
      max-width: 100%;
    }
    .sticker-code {
      font-size: 7pt;
      color: #444;
      font-family: 'Courier New', monospace;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="grid">${stickerHtml}</div>
  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
      setTimeout(function() { window.close(); }, 3000);
    };
  </script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <div
      className="print-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="הדפסת מדבקות"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="print-dialog">
        <div className="print-dialog-header">
          <h2>הדפסת מדבקות</h2>
          <span className="print-count">{products.length} מדבקות</span>
        </div>

        {preparing ? (
          <div className="print-preparing">
            <div className="spinner" />
            <span>מכין מדבקות...</span>
          </div>
        ) : error ? (
          <div className="alert-error">{error}</div>
        ) : (
          <div className="print-preview-scroll">
            <div className="print-preview-grid">
              {stickers.map((p) => (
                <StickerPreview key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        <div className="print-dialog-footer">
          <button className="btn-cancel" onClick={onClose} disabled={preparing}>
            ביטול
          </button>
          <button
            className="btn-print-confirm"
            onClick={handlePrint}
            disabled={preparing || !!error}
          >
            הדפס
          </button>
        </div>
      </div>
    </div>
  );
}

function StickerPreview({ product }) {
  return (
    <div className="sticker-preview">
      {product.qrCode && (
        <img
          src={product.qrCode}
          alt={`QR ${product.id}`}
          className="preview-qr"
        />
      )}
      <div className="preview-id">{product.id}</div>
      {product.code && (
        <div className="preview-code">{product.code}</div>
      )}
    </div>
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
