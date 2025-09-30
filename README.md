# Doc Scan Lite Client

A lightweight React app that extracts metadata from documents (PDFs and images) using OpenAI Vision API and stores results in Google Sheets via Apps Script.

## ✨ Features

- **Drag & drop or file picker** for PDF/PNG/JPG/WEBP uploads
- **Client-side PDF processing** - extracts first 2 pages as images
- **AI metadata extraction** using OpenAI GPT-4o-mini Vision
- **Direct Google Sheets integration** via Apps Script webhook
- **Duplicate detection** - flags re-uploads within 7 days using SHA-256 hashing
- **Image optimization** - auto-resizes to 800px, converts to JPEG 70%
- **Mobile-friendly UI** with Inter font and green palette

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- Google account with Sheets access

### Installation

```bash
git clone git@github.com:gysagsohn/doc-scan-lite-client.git
cd doc-scan-lite-client
npm install
```

### Environment Setup

Create `.env` in the project root:

```bash
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
OPENAI_MODEL=gpt-4o-mini
APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

⚠️ **Never commit `.env` to git**

---

## 📊 Google Sheets Setup

### 1. Create Your Sheet

Create a Google Sheet with a tab named **"Extracts"** and these headers in Row 1:

```
timestamp | document_type | name_full | date_issued | date_expiry | 
document_number | document_number_type | issuer | file_name | mime_type | 
file_size | file_hash | extras_json | confidence_json | audit_json
```

### 2. Add Apps Script

1. Go to **Extensions → Apps Script**
2. Paste the following code:

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

1. Click **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Click **Deploy**
6. Copy the URL ending in `/exec` (NOT `/dev`)
7. Add this URL to your `.env` as `APPS_SCRIPT_URL`

---

## 🛠️ Local Development

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
# → http://localhost:5173

# Terminal 2 - Functions
netlify functions:serve
# → http://localhost:9999/.netlify/functions/extract
```

⚠️ **Note:** Local dev has 10s timeout. Production has 26s.

---

## 🚢 Deployment to Netlify

### Initial Setup

1. Push code to GitHub
2. Go to [Netlify](https://app.netlify.com)
3. Click **Add new site → Import an existing project**
4. Connect your GitHub repo
5. Build settings (auto-detected):
   - Build command: `vite build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`

### Environment Variables

In Netlify → **Site settings → Environment variables**, add:

```
OPENAI_API_KEY = sk-proj-YOUR_KEY_HERE
OPENAI_MODEL = gpt-4o-mini
APPS_SCRIPT_URL = https://script.google.com/macros/s/YOUR_ID/exec
```

### Deploy

```bash
git add .
git commit -m "Initial deploy"
git push origin main
```

Netlify auto-deploys on every push to `main`.

---

## 📁 Project Structure

```
doc-scan-lite-client/
├── netlify/
│   └── functions/
│       └── extract.ts              # Serverless AI extraction endpoint
├── src/
│   ├── components/
│   │   ├── Dropzone.jsx            # Main upload component
│   │   └── ErrorBoundary.jsx       # React error boundary
│   ├── lib/
│   │   ├── pdf.ts                  # PDF → image conversion
│   │   ├── hash.ts                 # SHA-256 file hashing
│   │   └── constants.ts            # Shared configuration
│   ├── styles/
│   │   └── theme.css               # Green palette + Inter font
│   ├── App.jsx                     # Main app component
│   └── main.jsx                    # React entry point
├── public/
├── netlify.toml                    # Netlify configuration
├── package.json
├── tsconfig.json
├── vite.config.js
└── .env                            # Local environment (gitignored)
```

---

## 🔧 Recent Improvements (Pending Implementation)

The following improvements have been designed but not yet implemented:

### High Priority

1. **Token Cost Optimization (85% savings)**
   - Change OpenAI `detail: "high"` to `detail: "low"` in `extract.ts`
   - Reduces cost from ~$0.0015 to ~$0.0003 per upload

2. **Consistent Image Processing**
   - Standardize max dimension to 800px in both `pdf.ts` and `Dropzone.jsx`
   - Standardize JPEG quality to 70% across all image conversions

3. **Early Duplicate Detection**
   - Move duplicate check before OpenAI API call to save costs
   - Option to hard-block duplicates vs. soft-warning

4. **Error Boundary**
   - Add React error boundary to prevent full app crashes
   - Graceful error handling with recovery options

5. **TypeScript Type Safety**
   - Add proper interfaces for OpenAI responses
   - Type-safe validation of extracted data

6. **Unified Size Validation**
   - Create shared constants file for consistent validation
   - Single source of truth for max file sizes and limits

### Medium Priority

- Add explicit warning against `date_issued` hallucination in system prompt
- CSV export functionality
- Batch upload support
- Server-side rate limiting via Netlify Edge

---

## 💰 Cost Analysis

### Current Per-Upload Cost

| Service | Cost |
|---------|------|
| OpenAI API (with `detail: "high"`) | ~$0.0015 |
| OpenAI API (with `detail: "low"`) | ~$0.0003 |
| Netlify Functions | Free (125k/month) |
| Google Apps Script | Free |

### Monthly Estimates (with optimization)

- 100 uploads/month: **$0.03**
- 1,000 uploads/month: **$0.30**
- 10,000 uploads/month: **$3.00**

---

## ⚡ Performance

**Typical upload times:**
- Image preprocessing: 1-2 seconds
- OpenAI Vision: 4-7 seconds
- Apps Script write: 2-4 seconds
- **Total: 7-13 seconds**

**Image optimization:**
- Original (1204×1600 PNG): 516KB
- Optimized (602×800 JPEG 70%): 125KB
- **Compression: 75.7% smaller**

---

## 🔒 Security Features

- Client-side SHA-256 file hashing
- Server-side MIME type validation
- File size limits (10MB)
- No PII in logs
- Rate limiting (5s between uploads)
- Environment variables never bundled
- CORS properly configured

---

## 🐛 Troubleshooting

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
- Re-deploy with new version

### Duplicate Detection Not Working

**Check:**
- Netlify function logs for `[Duplicate check]` messages
- Verify Apps Script `doGet` endpoint works
- Test manually: `YOUR_APPS_SCRIPT_URL?hash=sha256:abc123`

---

## 📋 Testing Checklist

- [ ] Upload PDF with 2+ pages
- [ ] Upload single image (JPG, PNG, WEBP)
- [ ] Drag & drop file
- [ ] Upload file >10MB (should reject)
- [ ] Upload unsupported type (should reject)
- [ ] Upload same file twice within 1 minute (should show duplicate warning)
- [ ] Click "View in Google Sheet" button
- [ ] Click "Upload Another Document" (input should clear)
- [ ] Test on mobile (iOS Safari, Android Chrome)
- [ ] Verify data appears correctly in Google Sheet

---

## 🔗 Links

- **Live Site:** https://doc-scan-ai.netlify.app/
- **GitHub:** https://github.com/gysagsohn/doc-scan-lite-client
- **Google Sheet:** [Your Sheet URL]

---

## 📦 Dependencies

### Production
- `react@19.1.1` - UI framework
- `react-dom@19.1.1` - React DOM renderer
- `openai@5.23.1` - OpenAI API client
- `pdfjs-dist@5.4.149` - PDF parsing
- `node-fetch@3.3.2` - HTTP client

### Development
- `@netlify/functions@4.2.6` - Netlify Functions SDK
- `vite@7.1.7` - Build tool
- `typescript@5.9.2` - Type safety
- `@vitejs/plugin-react@5.0.3` - Vite React plugin

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

- OpenAI for GPT-4o-mini Vision API
- Mozilla for PDF.js
- Netlify for serverless hosting
- Google for Apps Script platform