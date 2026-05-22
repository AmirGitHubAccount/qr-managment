import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import pako from 'pako';
import initSqlJs from 'sql.js';

const SOURCE_CONFIG = {
  apiKey: "AIzaSyBqSry2oE-ULAyW0oTV93rCwJ6IlfIVnEY",
  authDomain: "acepk-5d2fc.firebaseapp.com",
  projectId: "acepk-5d2fc",
  storageBucket: "acepk-5d2fc.firebasestorage.app",
  messagingSenderId: "113790092753",
  appId: "1:113790092753:web:5ee8a38425c520b4d44cf0",
};

const SOURCE_APP_NAME = 'acepk-source';
const PASSWORD = 'pakar';

function getSourceApp() {
  const existing = getApps().find((a) => a.name === SOURCE_APP_NAME);
  return existing || initializeApp(SOURCE_CONFIG, SOURCE_APP_NAME);
}

// Decrypt TAL format: [TAL(3)][v1(1)][salt(16)][nonce(12)][ciphertext][mac(16)]
// Key derivation: PBKDF2-HMAC-SHA256, 600 000 iterations, 256-bit key
async function decryptTAL(data, password) {
  if (data.length < 20) throw new Error('Data too short to be a valid TAL file');

  if (data[0] !== 0x54 || data[1] !== 0x41 || data[2] !== 0x4C) {
    throw new Error('Invalid TAL header — expected bytes 54 41 4C ("TAL")');
  }
  if (data[3] !== 1) {
    throw new Error(`Unsupported TAL version: ${data[3]}`);
  }

  const salt = data.slice(4, 20); // 16 bytes
  // encryptedPart = nonce(12) + ciphertext(N) + mac(16)
  const encryptedPart = data.slice(20);
  const iv = encryptedPart.slice(0, 12);
  // Web Crypto AES-GCM expects ciphertext with the 16-byte GCM tag appended
  const ciphertextWithTag = encryptedPart.slice(12);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    ciphertextWithTag
  );

  return new Uint8Array(decrypted);
}

// Handles both Firebase Bytes objects and plain Uint8Arrays
function toUint8Array(value) {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (typeof value.toUint8Array === 'function') return value.toUint8Array();
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return new Uint8Array(value);
  return null;
}

export async function importFromSnapshot(targetDb, onProgress) {
  const sourceApp = getSourceApp();
  const sourceFirestore = getFirestore(sourceApp);

  onProgress('מאחזר מידע על ה-snapshot...', 5);

  const snapshotDocRef = doc(sourceFirestore, 'Snapshots', 'main');
  let snapshotDoc;
  try {
    snapshotDoc = await getDoc(snapshotDocRef);
  } catch (err) {
    throw new Error(`שגיאה בגישה לבסיס הנתונים המקורי: ${err.message}`);
  }

  if (!snapshotDoc.exists()) {
    throw new Error('ה-snapshot "main" לא נמצא בפרויקט המקורי');
  }

  const { chunksCount } = snapshotDoc.data();
  onProgress(`נמצאו ${chunksCount} חלקים. מוריד...`, 10);

  const chunksRef = collection(sourceFirestore, 'Snapshots', 'main', 'chunks');
  const chunksSnap = await getDocs(chunksRef);

  if (chunksSnap.docs.length !== chunksCount) {
    throw new Error(
      `מצאתי ${chunksSnap.docs.length} חלקים, ציפיתי ל-${chunksCount}`
    );
  }

  onProgress(`הורדו ${chunksSnap.docs.length} חלקים. מרכיב...`, 35);

  const sorted = [...chunksSnap.docs].sort(
    (a, b) => (a.data().index ?? 0) - (b.data().index ?? 0)
  );

  const parts = sorted.map((d) => toUint8Array(d.data().data)).filter(Boolean);
  const totalSize = parts.reduce((sum, p) => sum + p.length, 0);
  const assembled = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of parts) {
    assembled.set(part, offset);
    offset += part.length;
  }

  onProgress('מפענח (עשוי לקחת 10-30 שניות)...', 40);

  let compressed;
  try {
    compressed = await decryptTAL(assembled, PASSWORD);
  } catch (err) {
    throw new Error(`שגיאת פענוח: ${err.message}`);
  }

  onProgress('מבטל דחיסה...', 72);

  let sqliteBytes;
  try {
    sqliteBytes = pako.ungzip(compressed);
  } catch (err) {
    throw new Error(`שגיאת דחיסה: ${err.message}`);
  }

  onProgress('טוען מנוע SQLite...', 78);

  let SQL;
  try {
    SQL = await initSqlJs({
      locateFile: (file) => `${process.env.PUBLIC_URL}/${file}`,
    });
  } catch (err) {
    throw new Error(
      'שגיאה בטעינת sql-wasm.wasm. ודא שהקובץ נמצא בתיקיית public/'
    );
  }

  onProgress('מנתח בסיס נתונים SQLite...', 82);

  const sqlDb = new SQL.Database(sqliteBytes);

  let rows;
  try {
    const result = sqlDb.exec('SELECT id, code, tags FROM CommonItem');
    rows = result.length > 0 ? result[0].values : [];
  } catch (err) {
    sqlDb.close();
    throw new Error(`שגיאה בשאילתת SQLite: ${err.message}`);
  }

  sqlDb.close();

  if (rows.length === 0) {
    throw new Error('לא נמצאו מוצרים בבסיס הנתונים');
  }

  onProgress(`נמצאו ${rows.length} מוצרים. שומר...`, 86);

  const BATCH_SIZE = 400;
  let saved = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = writeBatch(targetDb);
    const chunk = rows.slice(i, i + BATCH_SIZE);

    for (const [id, code, tags] of chunk) {
      if (!id) continue;
      const productRef = doc(targetDb, 'products', String(id));
      batch.set(
        productRef,
        {
          id: String(id),
          name: String(id),
          code: code ? String(code) : '',
          tags: tags ? String(tags) : '',
          importedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    await batch.commit();
    saved += chunk.length;
    onProgress(
      `שמר ${saved} / ${rows.length} מוצרים...`,
      86 + (saved / rows.length) * 13
    );
  }

  return rows.length;
}
