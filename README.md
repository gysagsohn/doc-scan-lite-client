# Doc Scan Lite

[![Netlify Status](https://api.netlify.com/api/v1/badges/82da127d-0b81-4b60-bc5e-738f6919860d/deploy-status)](https://app.netlify.com/projects/doc-scan-ai/deploys)
[![GitHub](https://img.shields.io/github/license/gysagsohn/doc-scan-lite-client)](https://github.com/gysagsohn/doc-scan-lite-client/blob/main/LICENSE)
[![React](https://img.shields.io/badge/React-19.1.1-61dafb?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-18%2B-339933?logo=node.js)](https://nodejs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?logo=openai)](https://platform.openai.com/)

A lightweight, fully TypeScript React app that extracts metadata from documents (PDFs and images) using OpenAI Vision API and stores results in Google Sheets via Apps Script.

**Live Demo:** https://doc-scan-ai.netlify.app/

---

## Features

### Core Functionality
- **Drag & drop or file picker** for PDF/PNG/JPG/WEBP uploads  
- **Client-side PDF processing** — extracts first 2 pages as images  
- **AI metadata extraction** using OpenAI GPT-4o-mini Vision (admin only) 
- **Direct Google Sheets integration** via Apps Script webhook  
- **Duplicate detection** — flags re-uploads within 7 days using SHA-256 hashing  
- **Image optimization** — auto-resizes to 800px, converts to JPEG 70%

### Additional Features
- **Document pre-screening** — validates document type before expensive API call  
- **Smart cost protection** — warns on non-documents (receipts, photos, screenshots)  
- **Budget error handling** — graceful degradation when API quota exhausted  
- **Admin mode** — toggle Google Sheets sync on/off via triple-click footer  
- **CSV export/import** — backup and restore localStorage data  
- **Responsive design** — mobile-first with progressive spacing  
- **Error boundaries** — robust error handling with recovery options  
- **Context API state management** — no prop drilling  
- **Type-safe codebase** — 100% TypeScript

---

## How It Works

```
User uploads file
    │
    ▼
File validation (type, size, rate limit)
    │
    ▼
Image processing (PDF → PNG, resize to 800px, JPEG 70%)
    │
    ▼
Pre-check with OpenAI Vision API
    │
    ├─ Not a document (< 60% confidence)
    │  └─ Show NonDocumentModal with warning
    │     ├─ Cancel → Reset
    │     └─ Continue Anyway → Proceed
    │
    └─ Is a document (≥ 60% confidence)
       │
       ▼
    Compute SHA-256 hash
       │
       ▼
    Check for duplicates in localStorage
       │
       ├─ Duplicate found
       │  └─ Show DuplicateModal
       │     ├─ Use Cached Data → Instant
       │     ├─ Reprocess Anyway → API call
       │     └─ Cancel → Reset
       │
       └─ New file
          │
          ▼
       Full extraction with OpenAI Vision API
          │
          ▼
       Save to localStorage
          │
          └─ If admin mode ON → Sync to Google Sheets
```

### Cost Optimization

```
Pre-Check Cost: ~$0.0003 (low detail)
Main Extract: ~$0.0003 (low detail)
─────────────────────────────────────
Total per doc: ~$0.0006

Rejected files: Only $0.0003 (saved 50%)
Duplicates: $0 (cached, instant)
```

---

## Quick Start

### Prerequisites

- Node.js 18+  
- OpenAI API key (get one at https://platform.openai.com/api-keys)  
- Google account with Sheets access  
- Netlify CLI (optional but recommended for local dev)

### Installation

```bash
git clone git@github.com:gysagsohn/doc-scan-lite-client.git
cd doc-scan-lite-client
npm install
```

### Environment Setup

Create `.env` in the project root:

```env
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
OPENAI_MODEL=gpt-4o-mini
APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

**IMPORTANT:** Never commit `.env` to git. Use `.env.example` as a template.

---

## Google Sheets Setup

### 1. Create Your Sheet

Create a Google Sheet with a tab named `Extracts` and these headers in Row 1:

```
timestamp | document_type | name_full | date_issued | date_expiry |
document_number | document_number_type | issuer | file_name | mime_type |
file_size | file_hash | extras_json | confidence_json | audit_json
```

### 2. Add Apps Script

Go to **Extensions → Apps Script** and paste this code:

```javascript
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);

    const sheet = SpreadsheetApp.getActive().getSheetByName('Extracts') ||
                  SpreadsheetApp.getActive().insertSheet('Extracts');
    const body = JSON.parse(e.postData.contents);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'timestamp','document_type','name_full','date_issued','date_expiry',
        'document_number','document_number_type','issuer','file_name','mime_type',
        'file_size','file_hash','extras_json','confidence_json','audit_json'
      ]);
    }

    const row = [
      new Date().toISOString(),
      body.document_type || '',
      body.name_full || '',
      body.date_issued || '',
      body.date_expiry || '',
      body.document_number || '',
      body.document_number_type || '',
      body.issuer || '',
      body.file?.file_name || '',
      body.file?.mime_type || '',
      body.file?.file_size || '',
      body.file?.file_hash || '',
      JSON.stringify(body.extras || {}),
      JSON.stringify(body.confidence || {}),
      JSON.stringify(body.audit || {})
    ];

    sheet.appendRow(row);
    lock.releaseLock();

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, timestamp: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    if (lock) lock.releaseLock();
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Extracts');
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ rows: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const values = sheet.getDataRange().getValues();
  const header = values.shift() || [];
  const tsIdx = header.indexOf('timestamp');
  const hashIdx = header.indexOf('file_hash');

  if (e.parameter.hash) {
    const target = e.parameter.hash;
    const filtered = [];

    for (const row of values) {
      if (row[hashIdx] === target) {
        filtered.push({ timestamp: row[tsIdx], file_hash: row[hashIdx] });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ rows: filtered }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const N = Math.min(parseInt(e.parameter.recent || '200', 10), 500);
  const recent = [];

  for (let i = Math.max(values.length - N, 0); i < values.length; i++) {
    recent.push({ timestamp: values[i][tsIdx], file_hash: values[i][hashIdx] });
  }

  return ContentService.createTextOutput(JSON.stringify({ rows: recent }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 3. Deploy Apps Script

- Click **Deploy → New deployment**
- Type: **Web app**
- Execute as: **Me**
- Who has access: **Anyone**
- Click **Deploy**
- Copy the URL ending with `/exec` (NOT `/dev`) and set it as `APPS_SCRIPT_URL` in `.env`

---

## Local Development

### Option 1: Netlify Dev (Recommended)

```bash
netlify dev
# Opens at http://localhost:8888
# Functions available at http://localhost:8888/.netlify/functions/extract
```

### Option 2: Separate Processes

```bash
# Terminal 1 - Frontend
npm run dev
# Opens at http://localhost:5173

# Terminal 2 - Functions (requires Netlify CLI)
netlify functions:serve
# Functions at http://localhost:9999/.netlify/functions/extract
```

**Note:** Local dev has ~10s timeout. Production has ~26s timeout.

---

## Deployment to Netlify

### Initial Setup

1. Push code to GitHub
2. Go to Netlify → **Add new site → Import an existing project**
3. Connect your GitHub repo

### Build Settings (Auto-detected)

- Build command: `vite build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

### Environment Variables

In Netlify → **Site settings → Environment variables**, add:

```
OPENAI_API_KEY = sk-proj-YOUR_KEY_HERE
OPENAI_MODEL   = gpt-4o-mini
APPS_SCRIPT_URL= https://script.google.com/macros/s/YOUR_ID/exec
```

### Deploy

```bash
git add .
git commit -m "Deploy updates"
git push origin main
```

Netlify auto-deploys on push to main.

---

## Project Structure

```
doc-scan-lite-client/
├── netlify/
│   └── functions/
│       ├── utils/
│       │   └── cors.ts              # Shared CORS utility
│       ├── extract.ts               # Main AI extraction endpoint
│       └── pre-check.ts             # Document validation endpoint
├── src/
│   ├── components/
│   │   ├── AdminMode.tsx            # Admin mode toggle
│   │   ├── DataManager.tsx          # CSV export/import
│   │   ├── Dropzone.tsx             # Main upload component
│   │   ├── DuplicateModal.tsx       # Duplicate warning modal
│   │   ├── ErrorBoundary.tsx        # Error handling
│   │   ├── NonDocumentModal.tsx     # Non-document warning
│   │   └── WarningBanner.tsx        # Privacy warning
│   ├── contexts/
│   │   └── AdminContext.tsx         # Admin mode state management
│   ├── lib/
│   │   ├── csv.ts                   # CSV export/import logic
│   │   ├── hash.ts                  # SHA-256 file hashing
│   │   ├── pdf.ts                   # PDF to image conversion
│   │   └── storage.ts               # localStorage management
│   ├── styles/
│   │   ├── theme.css                # Global styles + CSS variables
│   │   ├── App.module.css
│   │   ├── AdminMode.module.css
│   │   ├── DataManager.module.css
│   │   ├── Dropzone.module.css
│   │   ├── DuplicateModal.module.css
│   │   ├── ErrorBoundary.module.css
│   │   ├── NonDocumentModal.module.css
│   │   └── WarningBanner.module.css
│   ├── App.tsx                      # Main app component
│   └── main.tsx                     # React entry point
├── public/
│   ├── favicon.ico
│   └── og-image.png
├── .env.example                     # Environment variable template
├── netlify.toml                     # Netlify configuration
├── package.json
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite configuration
└── eslint.config.js                 # ESLint configuration
```

---

## Cost Analysis

### Per-Upload Cost Breakdown

| Service                                   | Cost         | Notes                      |
|-------------------------------------------|--------------|----------------------------|
| Pre-check (gpt-4o-mini, low detail)       | ~$0.0003     | Document validation        |
| Main extraction (gpt-4o-mini, low detail) | ~$0.0003     | Full field extraction      |
| Netlify Functions                         | Free         | 125k invocations/month     |
| Google Apps Script                        | Free         | Unlimited                  |
| **Total per upload**                      | **~$0.0006** | 50% cheaper than v1        |

### Cost Savings

- Rejected non-documents: $0.0003 (50% saved)
- Cached duplicates: $0 (instant retrieval)
- Low detail images: 80% cheaper than high detail

### Monthly Estimates

- 100 uploads/month: $0.06
- 1,000 uploads/month: $0.60
- 10,000 uploads/month: $6.00

---

## Performance

### Typical Upload Times

| Stage                | Duration    | Notes                   |
|----------------------|-------------|-------------------------|
| Image preprocessing  | 1-2s        | PDF conversion + resize |
| Pre-check API call   | 2-3s        | Document validation     |
| Hash computation     | <1s         | SHA-256                 |
| Duplicate check      | <1s         | localStorage lookup     |
| Main extraction      | 4-7s        | Full field parsing      |
| Apps Script write    | 2-4s        | Google Sheets sync      |
| **Total (new file)** | **10-17s**  | With pre-check          |
| **Total (duplicate)**| **<1s**     | Instant cache hit       |

### Image Optimization

- Original (1204×1600 PNG): 516KB
- Optimized (800×1064 JPEG 70%): 125KB
- Compression: 75.7% smaller

---

## Technology Stack

### Frontend
- **React 19.1.1** - UI library
- **TypeScript 5.9.2** - Type safety
- **Vite 7.1.7** - Build tool
- **CSS Modules** - Scoped styling
- **Context API** - State management

### Backend
- **Netlify Functions** - Serverless functions
- **OpenAI Vision API** - Document extraction
- **Google Apps Script** - Sheets integration

### Libraries
- **pdfjs-dist** - PDF rendering
- **crypto.subtle** - File hashing (native)

---

## Security Features

- Client-side hashing: SHA-256 file fingerprinting
- Server-side validation: MIME type + size checks
- File size limits: 10MB hard limit
- Rate limiting: 5s cooldown between uploads
- No PII in logs: only metadata logged
- Environment variables: never bundled in client code
- CORS configured for API endpoints
- Budget protection: graceful API quota handling
- Admin mode gating: Google Sheets sync requires activation

---

## Troubleshooting

### "The developer has run out of API credits..."

**Problem:** Message about API quota exhaustion  
**Solution:**
- OpenAI API quota is exhausted  
- Email gysagsohn@hotmail.com to notify the developer  
- Auto top-up disabled to prevent runaway costs  
- Service resumes once quota is replenished  

### Pre-Check Says Valid Document is Invalid

**Problem:** Warning modal appears for legitimate driver license/certificate  
**Solution:**
- Click "Continue Anyway" - AI might have low confidence  
- Report false negatives to improve the model  
- Admin mode bypasses warnings  

### Local Dev Timeouts

**Problem:** Uploads timeout after 10 seconds  
**Solution:**
- Test on production (26s timeout)  
- Reduce image size/quality  
- Check Apps Script response time  

### CORS Errors

**Problem:** Function calls blocked by browser  
**Solution:**
- Always use relative URL: `/.netlify/functions/extract`  
- Never hardcode `localhost:9999` in production code  

### Apps Script Returns HTML

**Problem:** Getting HTML instead of JSON from Apps Script  
**Check:**
- URL ends with `/exec` not `/dev`  
- Deployment access set to "Anyone"  
- Re-deploy the Web app  

### Duplicate Detection Not Working

**Check:**
- Netlify function logs for `[Duplicate check]` messages  
- Verify Apps Script `doGet` endpoint works  
- Test manually: `YOUR_APPS_SCRIPT_URL?hash=sha256:abc123`  

### CSV Import Fails

**Problem:** CSV import shows errors  
**Check:**
- CSV has required columns: `file_hash`, `timestamp`, `file_name`  
- File encoding is UTF-8  
- No extra commas or quotes in data  

---

## Testing Checklist

### Upload Tests
- Upload PDF with 2+ pages  
- Upload single image (JPG, PNG, WEBP)  
- Drag & drop file  
- Upload file >10MB (should reject)  
- Upload unsupported type (should reject)  

### Pre-Check Tests
- Upload receipt/invoice (should show warning modal)  
- Upload personal photo (should show warning modal)  
- Upload screenshot (should show warning modal)  
- Upload driver license (should proceed directly)  
- Click "Cancel" on warning modal (should reset)  
- Click "Continue Anyway" (should proceed)  

### Duplicate & Cache Tests
- Upload same file twice within 1 minute (duplicate modal)  
- Click "Use Cached Data" (instant)  
- Click "Reprocess Anyway" (calls API again)  

### Data Management Tests
- Export data as CSV  
- Import CSV in Merge mode  
- Import CSV in Replace mode  
- Clear all data  

### Admin Mode Tests
- Triple-click footer to enable admin mode  
- Verify documents sync to Google Sheets  
- Triple-click to disable admin mode  
- Verify documents stay in localStorage only  

### Mobile Tests
- Test on iOS Safari  
- Test on Android Chrome  
- Verify touch targets ≥ 44×44px  
- Responsive at 375px, 768px, 1024px  

### Error Tests
- Trigger rate limit (upload twice quickly)  
- Invalid `APPS_SCRIPT_URL` (should show error)  
- Exhausted API quota (shows message)  

---

## Changelog

### v3.0.0 (2025-10-02)

**Major Refactor: TypeScript Migration**
- Converted entire codebase to TypeScript (100% type coverage)
- Renamed all `.jsx` files to `.tsx`, all `.js` files to `.ts`
- Added comprehensive TypeScript interfaces and types
- Removed all JSDoc comments (redundant with TypeScript)
- Improved type safety across all components and utilities

**Architecture Improvements**
- Implemented Context API for admin mode state management
- Eliminated prop drilling throughout component tree
- Created `AdminContext` with `useAdmin` hook
- Refactored component hierarchy for better separation of concerns

**Code Quality**
- Removed "AI tells" (file path comments, excessive documentation)
- Fixed function naming inconsistencies (`handleAdminToggle` → `handleDisableAdmin`)
- Optimized `WarningBanner` performance (useState initializer vs useEffect)
- Added explanatory comments for magic numbers in `pdf.ts`
- Created shared CORS utility for Netlify Functions
- Moved all inline styles to CSS Modules for `ErrorBoundary`

**Developer Experience**
- Added `.env.example` template
- Updated ESLint configuration for TypeScript
- Converted `vite.config.js` to TypeScript
- Installed `@types/pdfjs-dist` for better type definitions
- Improved build configuration and type checking

**Bug Fixes**
- Fixed `index.html` reference to `main.tsx` (was `main.jsx`)
- Corrected CSS Module import in `App.tsx`
- Resolved all implicit `any` type errors
- Fixed type inconsistencies in event handlers

### v2.0.0 (2025-10-01)

**New Features**
- Document pre-screening with confidence scoring  
- Non-document warning modal with cost transparency  
- Admin mode for Google Sheets sync control  
- CSV export/import for data portability  
- localStorage-based data management  
- Enhanced error handling with budget awareness  
- Responsive design with progressive spacing  
- Privacy warning banner  
- Error boundary for crash prevention  

**Improvements**
- Switched to "low detail" OpenAI images (80% cost reduction)  
- Standardized image processing to 800px JPEG 70%  
- Moved duplicate check before API calls  
- Added comprehensive CSS modules  
- Improved mobile-first responsive design  
- Added Open Graph meta tags for social sharing  

**Bug Fixes**
- Fixed CSS module import in `App.jsx`  
- Added root-level container spacing  
- Resolved infinite render loops  
- Fixed storage hash comparison logic  

### v1.0.0 (2024-10-29)

**Initial Release**
- Basic file upload (drag & drop)  
- Linked directly to Google Sheets  
- No admin mode  
- Minimal error handling  
- Basic validation checks  

---

## Acknowledgments

- **OpenAI** for GPT-4o-mini Vision API  
- **Mozilla** for PDF.js library  
- **Netlify** for serverless hosting platform  
- **Google** for Apps Script platform  
- **Inter font** by Rasmus Andersson  

---

## License

MIT License

---

## Author

**Gysbert Agsohn**  
Email: gysagsohn@hotmail.com  
GitHub: [@gysagsohn](https://github.com/gysagsohn)