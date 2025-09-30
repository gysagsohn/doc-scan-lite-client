// src/components/Dropzone.jsx
import { useState, useCallback } from "react";
import { pdfToPageDataURLs } from "../lib/pdf";
import { sha256File } from "../lib/hash";

const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/*": [".png", ".jpg", ".jpeg", ".webp"], // HEIC dropped for now; browser support is patchy
};
const MAX_MB = 10;

export default function Dropzone() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const onSelect = useCallback(async (file) => {
    setError("");
    setResult(null);
    if (!file) return;

    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_MB} MB`);
      return;
    }

    try {
      setBusy(true);

      // Convert to up to 2 image data URLs
      let images = [];
      if (file.type === "application/pdf") {
        images = await pdfToPageDataURLs(file, 2);
      } else if (file.type.startsWith("image/")) {
        images = [await fileToDataURL(file)];
      } else {
        setError("Unsupported file type");
        setBusy(false);
        return;
      }

      const file_hash = await sha256File(file);
      const payload = {
        images,
        file: {
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          file_hash,
        },
      };

      // Use different endpoint locally vs deployed
      const fnUrl = import.meta.env.DEV
        ? "http://localhost:9999/.netlify/functions/extract"
        : "/.netlify/functions/extract";

      const res = await fetch(fnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Server error");

      setResult(json);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="card">
      <div className="drop">
        <p style={{ marginTop: 0, fontWeight: 600, color: "var(--primary)" }}>
          Upload a document (PDF, PNG, JPG, WEBP) — max {MAX_MB} MB
        </p>
        <input
          type="file"
          accept={Object.keys(ACCEPT).join(",")}
          onChange={(e) => onSelect(e.target.files?.[0] || null)}
        />
        <p style={{ opacity: 0.8, marginBottom: 0 }}>
          We don’t store your file. Parsed data is appended to a private Google Sheet.
        </p>
      </div>

      {busy && <p>Processing…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: "1rem", textAlign: "left" }}>
          <p>
            <strong>Duplicate within 7 days:</strong>{" "}
            {result.duplicate ? "Yes" : "No"}
          </p>
          <details>
            <summary style={{ cursor: "pointer" }}>Show JSON</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(result.result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
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
