import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import PrintStickers from '../components/PrintStickers';
import './ProductList.css';

const FILTER_ALL = 'all';
const FILTER_HAS_QR = 'has_qr';
const FILTER_NO_QR = 'no_qr';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(FILTER_ALL);
  const [selected, setSelected] = useState(new Set());
  const [showPrint, setShowPrint] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setProducts(snap.docs.map((d) => ({ ...d.data(), docId: d.id })));
        setLoading(false);
      },
      (err) => {
        console.error('ProductList load error:', err);
        setError('שגיאה בטעינת מוצרים. נסה שוב מאוחר יותר.');
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const filtered = products.filter((p) => {
    const matchSearch =
      !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.id?.toLowerCase().includes(search.toLowerCase()) ||
      p.code?.toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filter === FILTER_ALL ||
      (filter === FILTER_HAS_QR && p.qrCode) ||
      (filter === FILTER_NO_QR && !p.qrCode);

    return matchSearch && matchFilter;
  });

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const selectedProducts = products.filter((p) => selected.has(p.id));

  const hasQrCount = products.filter((p) => p.qrCode).length;
  const missingQrCount = products.length - hasQrCount;

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <span>טוען מוצרים...</span>
      </div>
    );
  }

  return (
    <div className="product-list-page">
      {showPrint && (
        <PrintStickers
          products={selectedProducts}
          onClose={() => setShowPrint(false)}
        />
      )}

      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">מוצרים</h1>
          <div className="summary-chips">
            <span className="chip chip-green">{hasQrCount} עם QR</span>
            <span className="chip chip-red">{missingQrCount} ללא QR</span>
            <span className="chip chip-neutral">{products.length} סה"כ</span>
          </div>
        </div>

        <div className="toolbar">
          <input
            className="search-input"
            type="text"
            placeholder="חיפוש לפי שם, מזהה, ברקוד..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="חיפוש מוצרים"
          />

          <div className="filter-tabs">
            {[
              { key: FILTER_ALL, label: 'הכל' },
              { key: FILTER_HAS_QR, label: 'יש QR' },
              { key: FILTER_NO_QR, label: 'חסר QR' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`filter-tab ${filter === key ? 'active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {selected.size > 0 && (
            <button className="btn-print-selected" onClick={() => setShowPrint(true)}>
              הדפס {selected.size} מדבקות
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {products.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">אין מוצרים עדיין</div>
          <div className="empty-sub">
            יבא מוצרים מהמערכת הקיימת דרך <Link to="/settings">הגדרות</Link>, או טען נתוני דמו לבדיקה.
          </div>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      aria-label="בחר הכל"
                    />
                  </th>
                  <th>שם / מזהה</th>
                  <th>ברקוד</th>
                  <th>תגיות</th>
                  <th className="col-qr">QR</th>
                  <th className="col-actions"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr
                    key={product.id}
                    className={selected.has(product.id) ? 'row-selected' : ''}
                    onClick={() => toggleSelect(product.id)}
                  >
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        aria-label={`בחר ${product.name || product.id}`}
                      />
                    </td>
                    <td className="col-name">
                      <span className="product-name">{product.name || product.id}</span>
                    </td>
                    <td className="col-code">
                      <span className="mono">{product.code || '—'}</span>
                    </td>
                    <td className="col-tags">
                      <span className="tags-text">{product.tags || '—'}</span>
                    </td>
                    <td className="col-qr">
                      {product.qrCode ? (
                        <span className="qr-status qr-status-yes">
                          <span className="qr-dot qr-dot-yes" />QR
                        </span>
                      ) : (
                        <span className="qr-status qr-status-no">
                          <span className="qr-dot qr-dot-no" />חסר
                        </span>
                      )}
                    </td>
                    <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/products/${encodeURIComponent(product.id)}`}
                        className="btn-view"
                      >
                        פתח
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="no-results">אין תוצאות לחיפוש זה</div>
          )}

          <div className="table-footer">
            מציג {filtered.length} מתוך {products.length} מוצרים
          </div>
        </>
      )}
    </div>
  );
}
