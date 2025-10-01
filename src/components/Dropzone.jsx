// src/components/Dropzone.jsx
import { useState, useCallback, useRef } from "react";
import { pdfToPageDataURLs } from "../lib/pdf";
import { sha256File } from "../lib/hash";
import { findDocumentByHash, saveDocument } from "../lib/storage";
import DuplicateModal from "./DuplicateModal";
import NonDocumentModal from "./NonDocumentModal";
import styles from "../styles/Dropzone.module.css";

const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/*": [".png", ".jpg", ".jpeg", ".webp"],
};
const MAX_MB = 10;
const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const RATE_LIMIT_MS = 5000;

// Confidence threshold for pre-check
const CONFIDENCE_THRESHOLD = 0.6; // If confidence < 60%, show warning modal

export default function Dropzone({ adminMode = false }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState(null);
  const [nonDocumentModal, setNonDocumentModal] = useState(null);
  const lastUploadRef = useRef(0);
  const pendingFileRef = useRef(null);
  const adminModeRef = useRef(adminMode);

  adminModeRef.current = adminMode;

  const reset = useCallback(() => {
    setError("");
    setResult(null);
    setProgress("");
    setFileInputKey(prev => prev + 1);
    setDuplicateModal(null);
    setNonDocumentModal(null);
    pendingFileRef.current = null;
  }, []);

  const processFile = useCallback(async (file, forceReprocess = false, skipPreCheck = false) => {
    try {
      setBusy(true);
      setProgress("Reading file...");

      let images = [];
      if (file.type === "application/pdf") {
        setProgress("Converting PDF pages to images...");
        images = await pdfToPageDataURLs(file, 2);
      } else if (file.type.startsWith("image/")) {
        setProgress("Processing image...");
        const dataUrl = await fileToDataURL(file);
        setProgress("Optimizing image for AI processing...");
        const resized = await resizeImage(dataUrl, 800);
        images = [resized];
      } else {
        setError("Unsupported file type");
        setBusy(false);
        return;
      }

      // PRE-CHECK: Verify it's a document (unless skipped via override)
      if (!skipPreCheck) {
        setProgress("Checking if this is a valid document type...");
        
        try {
          const preCheckRes = await fetch("/.netlify/functions/pre-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: images[0] }), // Check first image only
          });

          const preCheckJson = await preCheckRes.json();

          // Handle API budget errors
          if (!preCheckRes.ok) {
            if (preCheckJson.error === "insufficient_quota") {
              setError(preCheckJson.userMessage);
              setBusy(false);
              return;
            }
            
            if (preCheckJson.error === "rate_limit_exceeded") {
              setError(preCheckJson.userMessage);
              setBusy(false);
              return;
            }

            // For other errors, warn but allow continuation
            console.warn('[PreCheck] Failed:', preCheckJson.error);
            setProgress("Pre-check failed, continuing anyway...");
          } else {
            const { is_document, confidence, detected_type, reasoning } = preCheckJson.result;

            // If not a document OR low confidence, show warning modal
            if (!is_document || confidence < CONFIDENCE_THRESHOLD) {
              setNonDocumentModal({
                detectedType: detected_type,
                confidence: confidence,
                reasoning: reasoning
              });
              pendingFileRef.current = { file, images };
              setBusy(false);
              setProgress("");
              return;
            }
          }
        } catch (preCheckErr) {
          console.warn('[PreCheck] Network error:', preCheckErr);
          // Continue anyway - better to process than block on pre-check failure
        }
      }

      setProgress("Computing file hash...");
      const file_hash = await sha256File(file);
      
      if (!forceReprocess) {
        const existingDoc = findDocumentByHash(file_hash);
        if (existingDoc) {
          setDuplicateModal(existingDoc);
          pendingFileRef.current = { file, images, file_hash };
          setBusy(false);
          setProgress("");
          return;
        }
      }
      
      const totalPayloadSize = images.reduce((sum, img) => sum + img.length, 0);
      
      if (totalPayloadSize > 10 * 1024 * 1024) {
        throw new Error(`Images still too large after processing: ${(totalPayloadSize / 1024 / 1024).toFixed(2)}MB. Please use a smaller file.`);
      }
      
      const skipGoogleSheets = !adminModeRef.current;
      
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

      setProgress("Sending to AI for analysis... (this may take 10-30 seconds)");
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      
      if (!res.ok) {
        // Handle budget errors from main extraction
        if (json.error === "insufficient_quota") {
          throw new Error(json.userMessage);
        }
        
        if (json.error === "rate_limit_exceeded") {
          throw new Error(json.userMessage);
        }

        const errorMsg = json.error || "Server error";
        const hint = json.hint ? `\n\n💡 ${json.hint}` : "";
        throw new Error(`${errorMsg}${hint}`);
      }

      const docToSave = {
        ...json.result,
        timestamp: new Date().toISOString(),
      };
      saveDocument(docToSave);

      setResult(json);
      setProgress("");
      setDuplicateModal(null);
      setNonDocumentModal(null);
      pendingFileRef.current = null;
    } catch (e) {
      console.error('[Upload Error]', e.message);
      const errorMsg = String(e.message || e);
      setError(errorMsg.length > 300 ? errorMsg.slice(0, 300) + "..." : errorMsg);
      setProgress("");
    } finally {
      setBusy(false);
    }
  }, []);

  const onSelect = useCallback(async (file) => {
    reset();
    if (!file) return;

    const now = Date.now();
    const timeSinceLastUpload = now - lastUploadRef.current;

    if (timeSinceLastUpload < RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_MS - timeSinceLastUpload) / 1000);
      setError(`Please wait ${waitSeconds} seconds between uploads. This is a personal project with API costs - rate limiting helps protect against abuse and keeps costs manageable. Thank you for your patience!`);
      return;
    }

    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_MB} MB limit`);
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(`Unsupported file type: ${file.type}. Please upload PDF, PNG, JPG, or WEBP.`);
      return;
    }

    lastUploadRef.current = now;
    await processFile(file, false, false);
  }, [reset, processFile]);

  const handleUseCached = useCallback(() => {
    if (duplicateModal) {
      setResult({ ok: true, result: duplicateModal, fromCache: true });
      setDuplicateModal(null);
      pendingFileRef.current = null;
    }
  }, [duplicateModal]);

  const handleReprocess = useCallback(async () => {
    if (pendingFileRef.current) {
      setDuplicateModal(null);
      await processFile(pendingFileRef.current.file, true, true); // Skip pre-check on reprocess
    }
  }, [processFile]);

  const handleCancelDuplicate = useCallback(() => {
    setDuplicateModal(null);
    pendingFileRef.current = null;
    reset();
  }, [reset]);

  // Non-document modal handlers
  const handleNonDocumentContinue = useCallback(async () => {
    if (pendingFileRef.current) {
      setNonDocumentModal(null);
      // Skip pre-check since user overrode the warning
      await processFile(pendingFileRef.current.file, false, true);
    }
  }, [processFile]);

  const handleNonDocumentCancel = useCallback(() => {
    setNonDocumentModal(null);
    pendingFileRef.current = null;
    reset();
  }, [reset]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!busy) setIsDragging(true);
  }, [busy]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (busy) return;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      onSelect(files[0]);
    }
  }, [busy, onSelect]);

  const handleFileInputChange = useCallback((e) => {
    onSelect(e.target.files?.[0] || null);
  }, [onSelect]);

  const dropzoneClasses = [
    styles.dropzone,
    busy ? styles.disabled : styles.enabled,
    isDragging ? styles.dragging : ''
  ].filter(Boolean).join(' ');

  const titleClasses = [
    styles.dropzoneTitle,
    isDragging ? styles.dragging : styles.normal
  ].join(' ');

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

      {nonDocumentModal && (
        <NonDocumentModal
          detectedType={nonDocumentModal.detectedType}
          confidence={nonDocumentModal.confidence}
          reasoning={nonDocumentModal.reasoning}
          onContinue={handleNonDocumentContinue}
          onCancel={handleNonDocumentCancel}
        />
      )}

      <div className={styles.card}>
        <label 
          htmlFor="file-upload"
          className={dropzoneClasses}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={styles.dropzoneContent}>
            <p className={titleClasses}>
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
              className={styles.fileInput}
            />
            
            <p id="file-instructions" className={styles.instructions}>
              <strong>Supported:</strong> Driver licenses, passports, work certificates (White Card, HRWL, VOC), insurance certificates<br/>
              Max {MAX_MB} MB — Images auto-optimized to 800px JPEG<br/>
              <em>Duplicate files detected automatically to save API costs.</em>
            </p>
          </div>
        </label>

        {busy && (
          <div className={styles.busyContainer}>
            <div className={styles.spinner} />
            <p className={styles.progressText}>{progress}</p>
          </div>
        )}

        {error && (
          <div className={styles.errorContainer}>
            <strong>Error:</strong>
            <pre className={styles.errorMessage}>{error}</pre>
            <button onClick={reset} className={`btn ${styles.errorButton}`}>
              Try Again
            </button>
          </div>
        )}

        {result && (
          <div className={styles.resultContainer}>
            <p className={styles.resultTitle}>
              {result.fromCache ? "✅ Used cached data (instant!)" : "✅ Successfully processed!"}
            </p>
            
            {result.fromCache && (
              <p className={styles.cachedBanner}>
                <strong>Saved API cost!</strong> This document was previously processed. No OpenAI call needed.
              </p>
            )}

            {result.result?.document_type && (
              <div className={styles.documentInfo}>
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
                className={styles.sheetLink}
              >
                View in Google Sheet
              </a>
            )}
            
            <details className={styles.jsonDetails}>
              <summary className={styles.jsonSummary}>
                Show Full JSON
              </summary>
              <pre className={styles.jsonContent}>
                {JSON.stringify(result.result, null, 2)}
              </pre>
            </details>

            <button onClick={reset} className={`btn ${styles.resetButton}`}>
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
      const currentMax = Math.max(img.width, img.height);
      const needsResize = currentMax > maxDimension;
      
      const canvas = document.createElement('canvas');
      
      if (needsResize) {
        const scale = maxDimension / currentMax;
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };

    img.src = dataUrl;
  });
}