import React, { useState } from 'react';
import { db } from '../firebase';
import { importFromSnapshot, importFromLocalSqlite } from '../utils/snapshotImport';
import { writeBatch, doc } from 'firebase/firestore';
import './Settings.css';

const DEMO_PRODUCTS = [
  { id: 'M16A1-001', code: '7290000000011', tags: 'נשק,רובה' },
  { id: 'MAG-5.56-30', code: '7290000000028', tags: 'תחמושת,מגזין' },
  { id: 'HELMET-M1-042', code: '7290000000035', tags: 'ציוד מגן,קסדה' },
  { id: 'VEST-IDF-L', code: '7290000000042', tags: 'ציוד מגן,אפוד' },
  { id: 'GPS-GARMIN-07', code: '7290000000059', tags: 'ניווט,אלקטרוניקה' },
  { id: 'RADIO-PRC77-3', code: '7290000000066', tags: 'תקשורת,רדיו' },
  { id: 'BOOTS-IDF-43', code: '7290000000073', tags: 'הלבשה,נעליים' },
  { id: 'CANTEEN-1L-19', code: '7290000000080', tags: 'ציוד שטח,מימייה' },
  { id: 'MEDKIT-BASIC-5', code: '7290000000097', tags: 'רפואה,עזרה ראשונה' },
  { id: 'NVG-PVS14-002', code: '7290000000103', tags: 'אלקטרוניקה,ראיית לילה' },
];

async function loadDemoData() {
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  for (const p of DEMO_PRODUCTS) {
    batch.set(doc(db, 'products', p.id), {
      id: p.id,
      name: p.id,
      code: p.code,
      tags: p.tags,
      qrCode: null,
      importedAt: now,
    });
  }
  await batch.commit();
  return DEMO_PRODUCTS.length;
}

export default function Settings() {
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const [localRunning, setLocalRunning] = useState(false);
  const [localStatus, setLocalStatus] = useState('');
  const [localProgress, setLocalProgress] = useState(0);
  const [localResult, setLocalResult] = useState(null);
  const [localError, setLocalError] = useState('');

  const handleLocalImport = async () => {
    setLocalRunning(true);
    setLocalError('');
    setLocalResult(null);
    setLocalStatus('');
    setLocalProgress(0);

    try {
      const count = await importFromLocalSqlite(db, (msg, pct) => {
        setLocalStatus(msg);
        setLocalProgress(Math.round(pct));
      });
      setLocalResult(`ייבוא הושלם! יובאו ${count} מוצרים.`);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setLocalRunning(false);
    }
  };

  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResult, setDemoResult] = useState(null);
  const [demoError, setDemoError] = useState('');

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    setDemoError('');
    setDemoResult(null);
    try {
      const count = await loadDemoData();
      setDemoResult(`נטענו ${count} מוצרי דמו בהצלחה.`);
    } catch (err) {
      setDemoError(err.message);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleImport = async () => {
    setRunning(true);
    setError('');
    setResult(null);
    setStatus('');
    setProgress(0);

    try {
      const count = await importFromSnapshot(db, (msg, pct) => {
        setStatus(msg);
        setProgress(Math.round(pct));
      });
      setResult(`ייבוא הושלם! יובאו ${count} מוצרים.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">הגדרות</h1>
      </div>

      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">ייבוא מוצרים מהמערכת הקיימת</h2>
          <p className="section-desc">
            מוריד ומעבד snapshot מפרויקט Firebase{' '}
            <code>acepk-5d2fc</code> ומייבא את המוצרים לבסיס הנתונים הנוכחי.
          </p>
          <p className="section-desc section-warn">
            שים לב: תהליך הפענוח עשוי לקחת עד 30 שניות. אל תסגור את הדף.
          </p>
        </div>

        <div className="section-body"><div className="import-box">
          <div className="import-info">
            <div className="info-row">
              <span className="info-label">מקור</span>
              <span className="info-value mono">acepk-5d2fc → Snapshots/main</span>
            </div>
            <div className="info-row">
              <span className="info-label">פורמט</span>
              <span className="info-value">TAL v1 · AES-256-GCM · PBKDF2-SHA256 · GZip · SQLite</span>
            </div>
            <div className="info-row">
              <span className="info-label">טבלה</span>
              <span className="info-value mono">CommonItem (id, code, tags)</span>
            </div>
          </div>

          {(running || status) && (
            <div className="progress-area">
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="progress-status">{status}</div>
            </div>
          )}

          {error && (
            <div className="alert-error">
              <strong>שגיאה:</strong> {error}
            </div>
          )}

          {result && (
            <div className="alert-success">
              {result}
            </div>
          )}

          <button className="btn-import" onClick={handleImport} disabled={running}>
            {running ? <><span className="spinner-sm" /> מייבא...</> : 'ייבא מוצרים'}
          </button>
        </div></div>
      </section>

      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">ייבוא מקובץ SQLite מקומי</h2>
          <p className="section-desc">
            מייבא מוצרים מקובץ <code>items.sqlite</code> המצורף לאפליקציה.
            לא נדרש חיבור לאינטרנט.
          </p>
        </div>

        <div className="section-body"><div className="import-box">
          <div className="import-info">
            <div className="info-row">
              <span className="info-label">מקור</span>
              <span className="info-value mono">items.sqlite (מובנה באפליקציה)</span>
            </div>
            <div className="info-row">
              <span className="info-label">טבלה</span>
              <span className="info-value mono">CommonItem (id, code, tags)</span>
            </div>
          </div>

          {(localRunning || localStatus) && (
            <div className="progress-area">
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${localProgress}%` }}
                />
              </div>
              <div className="progress-status">{localStatus}</div>
            </div>
          )}

          {localError && (
            <div className="alert-error">
              <strong>שגיאה:</strong> {localError}
            </div>
          )}

          {localResult && (
            <div className="alert-success">
              {localResult}
            </div>
          )}

          <button className="btn-import" onClick={handleLocalImport} disabled={localRunning}>
            {localRunning ? <><span className="spinner-sm" /> מייבא...</> : 'ייבא מקובץ מקומי'}
          </button>
        </div></div>
      </section>

      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">נתוני דמו</h2>
          <p className="section-desc">
            טוען 10 מוצרים מומצאים לבדיקת האפליקציה לפני ייבוא הנתונים האמיתיים.
            מוצרים קיימים עם אותו מזהה יידרסו.
          </p>
        </div>

        <div className="section-body"><div className="demo-products-preview">
          {DEMO_PRODUCTS.map((p) => (
            <span key={p.id} className="demo-chip">{p.id}</span>
          ))}
        </div>

        {demoError && <div className="alert-error" style={{ marginTop: 10 }}><strong>שגיאה:</strong> {demoError}</div>}
        {demoResult && <div className="alert-success" style={{ marginTop: 10 }}>{demoResult}</div>}

        <button className="btn-demo" onClick={handleLoadDemo} disabled={demoLoading}>
          {demoLoading ? <><span className="spinner-sm" /> טוען...</> : 'טען נתוני דמו'}
        </button>
        </div>
      </section>

      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">דרישות מוקדמות</h2>
        </div>
        <div className="requirements-list">
          <div className="requirement-item">
            <span className="req-icon">📄</span>
            <div>
              <div className="req-title">קובץ WASM של SQLite</div>
              <div className="req-desc">
                העתק את <code>node_modules/sql.js/dist/sql-wasm.wasm</code> לתיקיית{' '}
                <code>public/</code>. ה-<code>postinstall</code> script מבצע זאת
                אוטומטית לאחר <code>npm install</code>.
              </div>
            </div>
          </div>
          <div className="requirement-item">
            <span className="req-icon">🔑</span>
            <div>
              <div className="req-title">גישה לפרויקט המקורי</div>
              <div className="req-desc">
                ייבוא מתחבר לפרויקט <code>acepk-5d2fc</code> ללא אימות.
                ודא שכללי האבטחה של Firestore מאפשרים קריאה מה-snapshot.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
