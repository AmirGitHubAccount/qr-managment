# QR Management — ניהול מדבקות QR

A desktop admin tool for generating and printing QR-code stickers for inventory items. Built with React + Firebase, designed for Hebrew RTL.

---

## Overview

This app lets admins manage QR code stickers for products tracked in the *Tal* inventory system. It connects to two Firebase projects:

| Role | Project ID |
|---|---|
| Auth + product catalog | `qr-managment` |
| Source inventory snapshot | `acepk-5d2fc` |

Products are imported from an encrypted SQLite snapshot stored in the source project, then managed (QR generation, printing) in the new project.

---

## Features

- **Login** — Firebase Authentication, admin-only access
- **Product list** — searchable, filterable table with QR status indicators
- **Multi-select print** — select any products → print A4 sheet of stickers
- **Product page** — generate and save QR codes, print single sticker
- **Snapshot import** — one-click import from the existing Tal system (decrypts, decompresses, parses SQLite, batch-writes to Firestore)
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

### 1. Install dependencies

```bash
cd qr-management
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

### 2. Run locally

```bash
npm start
```

Opens at `http://localhost:3000`. Log in with a Firebase Auth user you created in the console.

### 3. Build for production

```bash
npm run build
```

Output is in `build/`.

---

## Deploying to GitLab Pages

The repo includes `.gitlab-ci.yml`. Push to `main` and GitLab CI will:

1. Install dependencies
2. Build the app
3. Copy `build/` → `public/` (the directory GitLab Pages serves)
4. Copy `index.html` → `404.html` (handles client-side routing on page refresh)

The app will be available at:

```
https://<username>.gitlab.io/qr-management
```

> **Note:** Update the `homepage` field in `package.json` if your Pages URL uses a subpath:
> ```json
> "homepage": "https://username.gitlab.io/qr-management"
> ```

---

## Firebase Configuration

### Target project (`qr-managment`)
Configured in `src/firebase.js`. Handles authentication and stores the product catalog in a `products` collection.

### Source project (`acepk-5d2fc`)
Configured inline in `src/utils/snapshotImport.js`. Used read-only during snapshot import. No authentication is performed against this project — ensure Firestore rules on `acepk-5d2fc` allow unauthenticated reads of the `Snapshots` collection, or adjust accordingly.

### Firestore rules (target project)

Minimal rules to get started — tighten before production:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{id} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## Snapshot Import

The import pipeline (Settings page → "ייבא מוצרים") runs entirely in the browser:

```
Firestore (acepk-5d2fc)
  └─ Snapshots/main/chunks/chunk_0..N   ← Firestore Bytes, ~800 KB each
         │
         ▼
  Reassemble byte array
         │
         ▼
  Decrypt  ──  TAL v1 format
               [TAL magic (3 B)] [version (1 B)] [salt (16 B)]
               [AES-GCM nonce (12 B)] [ciphertext] [GCM tag (16 B)]
               Key derivation: PBKDF2-HMAC-SHA256, 600 000 iterations
               Password: "pakar"
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

Each QR code encodes the following URL:

```
https://psrar.github.io/tal_web_app/#/home/items/{productId}
```

This links directly to the item's detail page in the Tal web app.

---

## Data Model

### `products/{id}` (Firestore, target project)

| Field | Type | Description |
|---|---|---|
| `id` | string | Product identifier (= document ID) |
| `name` | string | Display name (same as `id` in the Tal schema) |
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
├── .gitlab-ci.yml
└── package.json
```

---

## Known Limitations

- **Single-threaded decryption** — PBKDF2 runs on the main thread; the UI freezes for ~15s during import. A Web Worker would fix this but adds complexity.
- **QR stored as base64** — each QR image is ~20 KB stored in Firestore. For large catalogs consider storing only `qrUrl` and regenerating on-demand.
- **No auth against source project** — if `acepk-5d2fc` Firestore rules require authentication, import will fail with a permission error.
- **Desktop only** — no mobile layout, by design.
