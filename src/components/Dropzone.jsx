// src/components/Dropzone.jsx
import { useState, useCallback, useRef } from "react";
import { pdfToPageDataURLs } from "../lib/pdf";
import { sha256File } from "../lib/hash";
import { findDocumentByHash, saveDocument } from "../lib/storage";
import DuplicateModal from "./DuplicateModal";

const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/*": [".png", ".jpg", ".jpeg", ".webp"],
};
const MAX_MB = 10;
const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const RATE_LIMIT_MS = 5000;

export default function Dropzone({ adminMode = false }) {
  console.log('[Dropzone] Render - adminMode:', adminMode);
  
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState(null);
  const lastUploadRef = useRef(0);
  const pendingFileRef = useRef(null);
  const adminModeRef = useRef(adminMode);

  // Keep adminMode in sync via ref to avoid dependency issues
  adminModeRef.current = adminMode;

  const reset = useCallback(() => {
    console.log('[Dropzone] Reset called');
    setError("");
    setResult(null);
    setProgress("");
    setFileInputKey(prev => prev + 1);
    setDuplicateModal(null);
    pendingFileRef.current = null;
  }, []);

  const processFile = useCallback(async (file, forceReprocess = false) => {
    console.log('[processFile] Started', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      forceReprocess,
      adminMode: adminModeRef.current
    });

    try {
      setBusy(true);
      setProgress("Reading file...");

      // Convert to image data URLs
      let images = [];
      if (file.type === "application/pdf") {
        console.log('[processFile] Processing PDF');
        setProgress("Converting PDF pages to images...");
        images = await pdfToPageDataURLs(file, 2);
        console.log('[processFile] PDF converted to', images.length, 'images');
      } else if (file.type.startsWith("image/")) {
        console.log('[processFile] Processing image');
        setProgress("Processing image...");
        const dataUrl = await fileToDataURL(file);
        console.log('[processFile] Image loaded, size:', dataUrl.length);
        setProgress("Optimizing image for AI processing...");
        const resized = await resizeImage(dataUrl, 800);
        images = [resized];
        console.log('[Image processed]', {
          original: dataUrl.length,
          resized: resized.length,
          reduction: `${((1 - resized.length / dataUrl.length) * 100).toFixed(1)}%`
        });
      } else {
        console.error('[processFile] Unsupported file type:', file.type);
        setError("Unsupported file type");
        setBusy(false);
        return;
      }

      setProgress("Computing file hash...");
      const file_hash = await sha256File(file);
      console.log('[processFile] File hash computed:', file_hash);
      
      // Check for duplicate BEFORE calling OpenAI
      if (!forceReprocess) {
        console.log('[processFile] Checking for duplicates...');
        const existingDoc = findDocumentByHash(file_hash);
        if (existingDoc) {
          console.log('[processFile] Duplicate detected!', file_hash);
          setDuplicateModal(existingDoc);
          pendingFileRef.current = { file, images, file_hash };
          setBusy(false);
          setProgress("");
          return;
        }
        console.log('[processFile] No duplicate found, proceeding...');
      } else {
        console.log('[processFile] Skipping duplicate check (forceReprocess=true)');
      }
      
      const totalPayloadSize = images.reduce((sum, img) => sum + img.length, 0);
      console.log('[Payload] Total size:', (totalPayloadSize / 1024 / 1024).toFixed(2), 'MB');
      
      if (totalPayloadSize > 10 * 1024 * 1024) {
        const errorMsg = `Images still too large after processing: ${(totalPayloadSize / 1024 / 1024).toFixed(2)}MB. Please use a smaller file.`;
        console.error('[processFile]', errorMsg);
        throw new Error(errorMsg);
      }
      
      // Use ref to get current adminMode value
      const skipGoogleSheets = !adminModeRef.current;
      console.log('[processFile] Building payload', {
        skipGoogleSheets,
        adminMode: adminModeRef.current,
        imageCount: images.length
      });
      
      const payload = {
        images,
        file: {
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          file_hash,
        },
        skipGoogleSheets
      };

      const fnUrl = "/.netlify/functions/extract";
      console.log('[processFile] Calling API:', fnUrl);

      setProgress("Sending to AI for analysis... (this may take 10-30 seconds)");
      const fetchStart = Date.now();
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      console.log('[processFile] API response received', {
        status: res.status,
        statusText: res.statusText,
        duration: Date.now() - fetchStart + 'ms'
      });

      const json = await res.json();
      console.log('[processFile] Response JSON:', json);
      
      if (!res.ok) {
        const errorMsg = json.error || "Server error";
        const hint = json.hint ? `\n\n💡 ${json.hint}` : "";
        console.error('[processFile] API error:', errorMsg, hint);
        throw new Error(`${errorMsg}${hint}`);
      }

      // Save to localStorage
      console.log('[processFile] Saving to localStorage...');
      const docToSave = {
        ...json.result,
        timestamp: new Date().toISOString(),
      };
      const saved = saveDocument(docToSave);
      console.log('[Storage] Save result:', saved ? 'success' : 'failed', file_hash);

      setResult(json);
      setProgress("");
      setDuplicateModal(null);
      pendingFileRef.current = null;
      console.log('[processFile] Completed successfully');
    } catch (e) {
      console.error('[processFile] Error caught:', e);
      console.error('[processFile] Error stack:', e.stack);
      const errorMsg = String(e.message || e);
      setError(errorMsg.length > 300 ? errorMsg.slice(0, 300) + "..." : errorMsg);
      setProgress("");
    } finally {
      setBusy(false);
      console.log('[processFile] Finally block - busy set to false');
    }
  }, []); // No dependencies - uses refs instead

  const onSelect = useCallback(async (file) => {
    console.log('[onSelect] Called', {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size
    });

    reset();
    if (!file) {
      console.log('[onSelect] No file provided, exiting');
      return;
    }

    const now = Date.now();
    const timeSinceLastUpload = now - lastUploadRef.current;
    console.log('[onSelect] Rate limit check:', {
      timeSinceLastUpload,
      rateLimitMs: RATE_LIMIT_MS,
      blocked: timeSinceLastUpload < RATE_LIMIT_MS
    });

    if (timeSinceLastUpload < RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_MS - timeSinceLastUpload) / 1000);
      const errorMsg = `Please wait ${waitSeconds} seconds between uploads. This is a personal project with API costs - rate limiting helps protect against abuse and keeps costs manageable. Thank you for your patience!`;
      console.warn('[onSelect] Rate limited:', errorMsg);
      setError(errorMsg);
      return;
    }

    console.log('[onSelect] Validating file size...', {
      fileSize: file.size,
      maxSize: MAX_MB * 1024 * 1024,
      valid: file.size <= MAX_MB * 1024 * 1024
    });

    if (file.size > MAX_MB * 1024 * 1024) {
      const errorMsg = `File exceeds ${MAX_MB} MB limit`;
      console.error('[onSelect]', errorMsg);
      setError(errorMsg);
      return;
    }

    console.log('[onSelect] Validating file type...', {
      fileType: file.type,
      acceptedTypes: ACCEPTED_TYPES,
      valid: ACCEPTED_TYPES.includes(file.type)
    });

    if (!ACCEPTED_TYPES.includes(file.type)) {
      const errorMsg = `Unsupported file type: ${file.type}. Please upload PDF, PNG, JPG, or WEBP.`;
      console.error('[onSelect]', errorMsg);
      setError(errorMsg);
      return;
    }

    lastUploadRef.current = now;
    console.log('[onSelect] Validation passed, calling processFile...');
    await processFile(file, false);
    console.log('[onSelect] processFile completed');
  }, [reset, processFile]);

  const handleUseCached = useCallback(() => {
    console.log('[handleUseCached] Called', {
      hasDuplicateModal: !!duplicateModal,
      hash: duplicateModal?.file_hash || duplicateModal?.file?.file_hash
    });
    
    if (duplicateModal) {
      console.log('[Using cached data]', duplicateModal.file_hash || duplicateModal.file?.file_hash);
      setResult({ ok: true, result: duplicateModal, fromCache: true });
      setDuplicateModal(null);
      pendingFileRef.current = null;
    }
  }, [duplicateModal]);

  const handleReprocess = useCallback(async () => {
    console.log('[handleReprocess] Called', {
      hasPendingFile: !!pendingFileRef.current,
      hash: pendingFileRef.current?.file_hash
    });
    
    if (pendingFileRef.current) {
      console.log('[Reprocessing file]', pendingFileRef.current.file_hash);
      setDuplicateModal(null);
      await processFile(pendingFileRef.current.file, true);
    }
  }, [processFile]);

  const handleCancelDuplicate = useCallback(() => {
    console.log('[handleCancelDuplicate] Called');
    setDuplicateModal(null);
    pendingFileRef.current = null;
    reset();
  }, [reset]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!busy) {
      console.log('[handleDragOver] Setting isDragging=true');
      setIsDragging(true);
    }
  }, [busy]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[handleDragLeave] Setting isDragging=false');
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    console.log('[handleDrop] Called', {
      busy,
      filesCount: e.dataTransfer?.files?.length
    });
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (busy) {
      console.log('[handleDrop] Busy, ignoring drop');
      return;
    }
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      console.log('[handleDrop] Calling onSelect with file:', files[0].name);
      onSelect(files[0]);
    } else {
      console.warn('[handleDrop] No files in drop event');
    }
  }, [busy, onSelect]);

  const handleFileInputChange = useCallback((e) => {
    console.log('[handleFileInputChange] Called', {
      filesCount: e.target.files?.length,
      firstFile: e.target.files?.[0]?.name
    });
    onSelect(e.target.files?.[0] || null);
  }, [onSelect]);

  console.log('[Dropzone] Render state:', {
    busy,
    hasError: !!error,
    hasResult: !!result,
    hasDuplicateModal: !!duplicateModal,
    isDragging,
    progress,
    fileInputKey
  });

  return (
    <>
      {duplicateModal && (
        <DuplicateModal
          document={duplicateModal}
          onUseCached={handleUseCached}
          onReprocess={handleReprocess}
          onCancel={handleCancelDuplicate}
        />
      )}

      <div className="card">
        <label 
          htmlFor="file-upload"
          className="drop"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            display: "block",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
            border: isDragging ? "2px solid var(--accent)" : "2px dashed var(--primary)",
            background: isDragging ? "rgba(223, 101, 77, 0.1)" : "white",
            transition: "all 0.2s ease"
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p style={{ 
              marginTop: 0,
              marginBottom: "0.75rem",
              fontWeight: 600, 
              color: isDragging ? "var(--accent)" : "var(--primary)",
              fontSize: "1.1rem"
            }}>
              {isDragging ? "Drop file here" : "Upload a document"}
            </p>
            
            <input
              id="file-upload"
              key={fileInputKey}
              type="file"
              accept={Object.keys(ACCEPT).join(",")}
              onChange={handleFileInputChange}
              disabled={busy}
              aria-describedby="file-instructions"
              style={{ display: "block", margin: "0 auto 0.75rem" }}
            />
            
            <p 
              id="file-instructions" 
              style={{ 
                opacity: 0.8, 
                marginBottom: 0,
                fontSize: "0.9rem" 
              }}
            >
              Accepts PDF, PNG, JPG, WEBP — max {MAX_MB} MB<br/>
              Images are automatically optimized to 800px and converted to JPEG.<br/>
              <em>Duplicate files are detected automatically to save API costs.</em>
            </p>
          </div>
        </label>

        {busy && (
          <div style={{ 
            marginTop: "1rem", 
            padding: "1rem",
            background: "var(--surface)",
            borderRadius: "8px",
            textAlign: "center"
          }}>
            <div className="spinner" style={{ 
              display: "inline-block",
              width: "20px",
              height: "20px",
              border: "3px solid var(--border)",
              borderTop: "3px solid var(--primary)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }}/>
            <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>{progress}</p>
          </div>
        )}

        {error && (
          <div style={{ 
            marginTop: "1rem",
            padding: "1rem",
            background: "rgba(220, 38, 38, 0.1)",
            border: "1px solid rgba(220, 38, 38, 0.3)",
            borderRadius: "8px",
            color: "#991b1b",
            textAlign: "center"
          }}>
            <strong>Error:</strong>
            <pre style={{ 
              whiteSpace: "pre-wrap", 
              wordBreak: "break-word",
              marginTop: "0.5rem",
              marginBottom: "0.75rem",
              fontFamily: "monospace",
              fontSize: "0.9rem",
              textAlign: "left",
              background: "rgba(255, 255, 255, 0.5)",
              padding: "0.75rem",
              borderRadius: "6px"
            }}>
              {error}
            </pre>
            <button 
              onClick={reset} 
              className="btn"
              style={{ fontSize: "0.9rem", padding: "0.4rem 0.8rem" }}
            >
              Try Again
            </button>
          </div>
        )}

        {result && (
          <div style={{ 
            marginTop: "1rem", 
            padding: "1rem",
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "8px",
            textAlign: "left" 
          }}>
            <p style={{ marginTop: 0, color: "var(--primary)", fontWeight: 600 }}>
              {result.fromCache ? "✅ Used cached data (instant!)" : "✅ Successfully processed!"}
            </p>
            
            {result.fromCache && (
              <p style={{ 
                padding: "0.5rem",
                background: "rgba(34, 197, 94, 0.2)",
                border: "1px solid rgba(34, 197, 94, 0.4)",
                borderRadius: "6px",
                fontSize: "0.9rem",
                marginBottom: "0.75rem"
              }}>
                <strong>Saved API cost!</strong> This document was previously processed. No OpenAI call needed.
              </p>
            )}

            {result.result?.document_type && (
              <div style={{ marginTop: "0.75rem", marginBottom: "0.75rem" }}>
                <strong>Document Type:</strong> {result.result.document_type}<br/>
                {result.result.name_full && <><strong>Name:</strong> {result.result.name_full}<br/></>}
                {result.result.document_number && <><strong>Number:</strong> {result.result.document_number}<br/></>}
                {result.result.date_expiry && <><strong>Expiry:</strong> {result.result.date_expiry}</>}
              </div>
            )}
            
            {adminModeRef.current && !result.fromCache && (
              <a 
                href="https://docs.google.com/spreadsheets/d/1BRCQE9HO3N4kUZT-3OLAUddcSqCDpFfEHBxdhferuig/edit?gid=1127136393#gid=1127136393"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "0.5rem 1rem",
                  background: "var(--primary)",
                  color: "white",
                  borderRadius: "6px",
                  textDecoration: "none",
                  fontWeight: 600,
                  marginTop: "0.75rem",
                  marginBottom: "0.75rem"
                }}
              >
                View in Google Sheet
              </a>
            )}
            
            <details style={{ marginTop: "0.75rem" }}>
              <summary style={{ 
                cursor: "pointer",
                fontWeight: 600,
                color: "var(--primary)",
                userSelect: "none"
              }}>
                Show Full JSON
              </summary>
              <pre style={{ 
                whiteSpace: "pre-wrap",
                background: "white",
                padding: "0.75rem",
                borderRadius: "6px",
                marginTop: "0.5rem",
                fontSize: "0.85rem",
                overflow: "auto",
                maxHeight: "400px"
              }}>
                {JSON.stringify(result.result, null, 2)}
              </pre>
            </details>

            <button 
              onClick={reset}
              className="btn"
              style={{ 
                marginTop: "1rem",
                fontSize: "0.9rem",
                padding: "0.4rem 0.8rem"
              }}
            >
              Upload Another Document
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Failed to read file"));
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(file);
  });
}

async function resizeImage(dataUrl, maxDimension = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onerror = () => reject(new Error("Failed to load image"));
    
    img.onload = () => {
      console.log('[Resize] Original dimensions:', img.width, 'x', img.height);
      
      const currentMax = Math.max(img.width, img.height);
      const needsResize = currentMax > maxDimension;
      
      const canvas = document.createElement('canvas');
      
      if (needsResize) {
        const scale = maxDimension / currentMax;
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        console.log('[Resize] Resizing to:', canvas.width, 'x', canvas.height, `(${(scale * 100).toFixed(1)}% scale)`);
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
        console.log('[Resize] Keeping dimensions, converting to JPEG');
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const resized = canvas.toDataURL('image/jpeg', 0.7);
      console.log('[Resize] Size reduction:', 
        `${(dataUrl.length / 1024).toFixed(0)}KB → ${(resized.length / 1024).toFixed(0)}KB`,
        `(${((1 - resized.length / dataUrl.length) * 100).toFixed(1)}% smaller)`
      );
      
      resolve(resized);
    };

    img.src = dataUrl;
  });
}