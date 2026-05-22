# QR Management — ניהול מדבקות QR

A desktop admin tool for generating and printing QR-code stickers for inventory items. Built with React + Firebase, designed for Hebrew RTL.

---

## Overview

This app lets admins manage QR code stickers for products imported from an encrypted inventory snapshot. It connects to two Firebase projects:

| Role | Project ID |
|---|---|
| Auth + product catalog | target project (configured via env vars) |
| Source inventory snapshot | source project (configured via env vars) |

Products are imported from an encrypted SQLite snapshot stored in the source project, then managed (QR generation, printing) in the target project.

---

## Features

- **Login** — Firebase Authentication, admin-only access
- **Product list** — searchable, filterable table with QR status indicators
- **Multi-select print** — select any products → print A4 sheet of stickers
- **Product page** — generate and save QR codes, print single sticker
- **Snapshot import** — one-click import from the source system (decrypts, decompresses, parses SQLite, batch-writes to Firestore)
- **Local SQLite import** — import from a bundled `items.sqlite` file (no internet required)
- **Demo data** — load 10 fake products for testing without touching the real snapshot

---

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 18, React Router 6 |
| Backend | Firebase 10 (Firestore + Auth) |
| QR generation | `qrcode` |
| Snapshot decryption | Web Crypto API (PBKDF2 + AES-256-GCM) |
| Decompression | `pako` (GZip) |
| SQLite parsing | `sql.js` (WASM) |
| Hosting | GitLab Pages |

No UI component libraries — plain CSS only.

---

## Prerequisites

- Node.js 18+
- A Firebase project for the new app (`qr-managment`) with **Authentication** (Email/Password) and **Firestore** enabled
- At least one admin user created in Firebase Authentication

---

## Setup

### 1. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

### 2. Install dependencies

```bash
npm install
```

The `postinstall` script automatically copies `sql-wasm.wasm` from `node_modules/sql.js/dist/` into `public/`. Verify it exists:

```
public/sql-wasm.wasm   ← must be present for snapshot import to work
```

If it's missing, copy it manually:

```bash
cp node_modules/sql.js/dist/sql-wasm.wasm public/
```

### 3. Run locally

```bash
npm start
```

Opens at `http://localhost:3000`. Log in with a Firebase Auth user you created in the console.

### 4. Build for production

```bash
npm run build
```

Output is in `build/`.

---

## Deploying to GitLab Pages

The repo includes `.gitlab-ci.yml`. Push to `main` and GitLab CI will:

1. Inject environment variables from GitLab CI/CD Variables
2. Install dependencies
3. Build the app
4. Copy `build/` → `public/` (the directory GitLab Pages serves)
5. Copy `index.html` → `404.html` (handles client-side routing on page refresh)

The app will be available at:

```
https://<username>.gitlab.io/qr-management
```

> **Note:** Update the `homepage` field in `package.json` if your Pages URL uses a subpath:
> ```json
> "homepage": "https://username.gitlab.io/qr-management"
> ```

**Required CI/CD Variables** (Settings → CI/CD → Variables):

| Variable | Description |
|---|---|
| `REACT_APP_FIREBASE_API_KEY` | Target Firebase project API key |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Target Firebase auth domain |
| `REACT_APP_FIREBASE_PROJECT_ID` | Target Firebase project ID |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | Target Firebase storage bucket |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | Target Firebase messaging sender ID |
| `REACT_APP_FIREBASE_APP_ID` | Target Firebase app ID |
| `REACT_APP_SOURCE_API_KEY` | Source Firebase project API key |
| `REACT_APP_SOURCE_AUTH_DOMAIN` | Source Firebase auth domain |
| `REACT_APP_SOURCE_PROJECT_ID` | Source Firebase project ID |
| `REACT_APP_SOURCE_STORAGE_BUCKET` | Source Firebase storage bucket |
| `REACT_APP_SOURCE_MESSAGING_SENDER_ID` | Source Firebase messaging sender ID |
| `REACT_APP_SOURCE_APP_ID` | Source Firebase app ID |

---

## Firebase Configuration

### Target project (`qr-managment`)
Configured in `src/firebase.js`. Handles authentication and stores the product catalog in a `products` collection.

### Source project
Configured inline in `src/utils/snapshotImport.js` via `REACT_APP_SOURCE_*` env vars. Used read-only during snapshot import. No authentication is performed against this project — ensure its Firestore rules allow reads of the `Snapshots` collection, or adjust accordingly.

### Firestore rules (target project)

The `firestore.rules` file in the repo root restricts writes to users with the `admin` custom claim. Deploy with:

```bash
firebase deploy --only firestore:rules
```

To set admin claims on a user, use the Firebase Admin SDK or a Cloud Function:

```js
admin.auth().setCustomUserClaims(uid, { admin: true });
```

---

## Snapshot Import

The import pipeline (Settings page → "ייבא מוצרים") runs entirely in the browser. A decryption password is required — enter it in the password field before clicking import.

```
Firestore (source project)
  └─ Snapshots/main/chunks/chunk_0..N   ← Firestore Bytes, ~800 KB each
         │
         ▼
  Reassemble byte array
         │
         ▼
  Decrypt  ──  Encrypted binary format v1
               Magic header (3 B) + version (1 B) + salt (16 B)
               + AES-GCM nonce (12 B) + ciphertext + GCM tag (16 B)
               Key derivation: PBKDF2-HMAC-SHA256, 600 000 iterations
               Password: entered by admin at import time
         │
         ▼
  GZip decompress  (pako.ungzip)
         │
         ▼
  SQLite binary  →  sql.js
         │
         ▼
  SELECT id, code, tags FROM CommonItem
         │
         ▼
  Batch-write to Firestore (qr-managment) → products/{id}
```

**Expected duration:** 15–40 seconds. The PBKDF2 key derivation (600k iterations) runs on the main thread and accounts for most of the time. Do not close the tab during import.

---

## QR Code Format

Each QR code encodes a URL pointing to the item's detail page in the mobile inventory app. The base URL is configurable via the `REACT_APP_QR_BASE_URL` environment variable (see `.env.example`).

> **Warning:** Changing `REACT_APP_QR_BASE_URL` after stickers have been printed in the field will make existing QR codes point to a dead link.

---

## Data Model

### `products/{id}` (Firestore, target project)

| Field | Type | Description |
|---|---|---|
| `id` | string | Product identifier (= document ID) |
| `name` | string | Display name |
| `code` | string | Barcode / scan code |
| `tags` | string | Comma-separated tags |
| `qrCode` | string \| null | Base64 PNG data URL of the generated QR image |
| `qrUrl` | string \| null | The URL encoded in the QR code |
| `qrGeneratedAt` | string \| null | ISO timestamp of last QR generation |
| `importedAt` | string | ISO timestamp of when the product was imported |

---

## Project Structure

```
qr-management/
├── public/
│   ├── index.html          # RTL Hebrew entry point
│   └── sql-wasm.wasm       # Copied by postinstall; required for import
├── src/
│   ├── firebase.js         # Target Firebase app (qr-managment)
│   ├── context/
│   │   └── AuthContext.js  # Firebase Auth state provider
│   ├── pages/
│   │   ├── Login.js        # Email/password sign-in
│   │   ├── ProductList.js  # Main product table with search + filter
│   │   ├── ProductPage.js  # Per-product QR generation + print
│   │   └── Settings.js     # Snapshot import + demo data
│   ├── components/
│   │   ├── Navbar.js       # Top navigation
│   │   └── PrintStickers.js  # Print dialog (opens popup window for A4 print)
│   └── utils/
│       ├── qrUtils.js        # QR code generation helpers
│       └── snapshotImport.js # Full import pipeline
├── firestore.rules
├── firebase.json
├── .gitlab-ci.yml
└── package.json
```

---

## Known Limitations

- **Single-threaded decryption** — PBKDF2 runs on the main thread; the UI freezes for ~15s during import. A Web Worker would fix this but adds complexity.
- **QR stored as base64** — each QR image is ~20 KB stored in Firestore. For large catalogs consider storing only `qrUrl` and regenerating on-demand.
- **No auth against source project** — if the source project's Firestore rules require authentication, import will fail with a permission error.
- **Desktop only** — no mobile layout, by design.
