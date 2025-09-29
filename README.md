# Doc Scan Lite Client

A lightweight proof-of-concept app that lets you upload a document (PDF or image), extracts metadata using OpenAI Vision, and appends the results to a private Google Sheet via Google Apps Script.

## ✨ Features

- Upload PDF (first 2 pages) or image (PNG/JPG/WEBP).
- Convert PDF pages to images client-side using `pdfjs-dist`.
- Extract structured metadata (name, document number, issue/expiry dates, issuer, etc.) with **OpenAI GPT-4o-mini**.
- Forward results to a **Google Sheet** using a deployed Google Apps Script.
- Duplicate detection (flags re-uploads of the same file hash within 7 days).
- Clean, mobile-friendly UI using Inter font and a green theme.

---

## 🗂 Project Structure

```bash
doc-scan-lite-client/
├── netlify/functions/extract.ts # Netlify serverless function
├── src/
│ ├── components/Dropzone.jsx # File upload + API call UI
│ ├── lib/
│ │ ├── pdf.ts # Convert PDF pages → images
│ │ └── hash.ts # SHA-256 file hashing
│ ├── styles/theme.css # Custom palette + Inter font
│ ├── App.jsx # Main entry (renders Dropzone)
│ └── main.jsx
├── public/
├── netlify.toml
├── package.json
└── README.md
```

## ⚙️ Setup

### 1. Clone & install

```bash
git clone git@github.com:gysagsohn/doc-scan-lite-client.git
cd doc-scan-lite-client
npm install
```

### 2. Environment variables

Create a .env file in the project root:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

OPENAI_API_KEY → get from OpenAI API keys dashboard
APPS_SCRIPT_URL → deploy your Google Apps Script as a Web App (access = Anyone) and copy the /exec URL.

### 3.Google Sheet & Apps Script
Create a sheet named Extracts with headers:

```bash
timestamp | document_type | name_full | date_issued | date_expiry |
document_number | document_number_type | issuer | file_name | mime_type |
file_size | file_hash | extras_json | confidence_json | audit_json
```
Add the provided doPost + doGet Apps Script and deploy as Web App.

## Local Development
Run Vite (frontend) and Netlify Functions (backend) in separate terminals:

``` bash
# Terminal A - Vite app
npm run dev
# → http://localhost:5173

# Terminal B - Netlify functions
netlify functions:serve
# → http://localhost:9999/.netlify/functions/extract
```