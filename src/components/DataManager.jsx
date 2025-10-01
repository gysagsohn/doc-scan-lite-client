// src/components/DataManager.jsx
import { useState, useRef, useCallback } from "react";
import { getAllDocuments, clearAllDocuments, saveDocument, getStorageStats } from "../lib/storage";
import { documentsToCSV, csvToDocuments, downloadCSV } from "../lib/csv";

export default function DataManager({ onDataChange }) {
  const [stats, setStats] = useState(getStorageStats());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importMode, setImportMode] = useState("merge"); // "merge" or "replace"
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);

  const refreshStats = useCallback(() => {
    setStats(getStorageStats());
    if (onDataChange) onDataChange();
  }, [onDataChange]);

  const handleExport = useCallback(() => {
    try {
      const docs = getAllDocuments();
      
      if (docs.length === 0) {
        alert("No data to export");
        return;
      }

      const csvContent = documentsToCSV(docs);
      downloadCSV(csvContent);
      
      console.log(`[Export] Exported ${docs.length} documents`);
    } catch (err) {
      console.error("[Export] Error:", err);
      alert(`Export failed: ${err.message}`);
    }
  }, []);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input
    e.target.value = "";

    try {
      setImportStatus({ type: "loading", message: "Reading CSV..." });

      const text = await file.text();
      const importedDocs = csvToDocuments(text);

      if (importedDocs.length === 0) {
        throw new Error("No valid documents found in CSV");
      }

      // Handle merge vs replace
      if (importMode === "replace") {
        clearAllDocuments();
        console.log("[Import] Cleared existing data (replace mode)");
      }

      // Save each document
      let savedCount = 0;
      let skippedCount = 0;
      let updatedCount = 0;

      importedDocs.forEach(doc => {
        const existingDocs = getAllDocuments();
        const existingDoc = existingDocs.find(d => 
          d.file?.file_hash === doc.file_hash || d.file_hash === doc.file_hash
        );

        if (importMode === "merge" && existingDoc) {
          // Skip duplicates in merge mode
          skippedCount++;
          console.log(`[Import] Skipped duplicate:`, doc.file_hash);
        } else {
          const success = saveDocument(doc);
          if (success) {
            if (existingDoc) {
              updatedCount++;
            } else {
              savedCount++;
            }
          } else {
            skippedCount++;
          }
        }
      });

      refreshStats();
      
      const message = importMode === "merge"
        ? `Imported ${savedCount} new documents. ${updatedCount > 0 ? `Updated ${updatedCount}.` : ''} ${skippedCount > 0 ? `Skipped ${skippedCount} duplicates.` : ""}`
        : `Replaced all data with ${savedCount} documents.`;
      
      setImportStatus({
        type: "success",
        message
      });

      setTimeout(() => setImportStatus(null), 5000);
      
      console.log(`[Import] Mode: ${importMode}, New: ${savedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);
    } catch (err) {
      console.error("[Import] Error:", err);
      setImportStatus({
        type: "error",
        message: `Import failed: ${err.message}`
      });
      setTimeout(() => setImportStatus(null), 5000);
    }
  }, [importMode, refreshStats]);

  const handleClearAll = useCallback(() => {
    const success = clearAllDocuments();
    if (success) {
      refreshStats();
      setShowClearConfirm(false);
      console.log("[DataManager] Cleared all data");
    } else {
      alert("Failed to clear data");
    }
  }, [refreshStats]);

  return (
    <div className="card" style={{ marginTop: "1.5rem" }}>
      <h3 style={{ marginTop: 0, marginBottom: "1rem", color: "var(--primary)" }}>
        Data Management
      </h3>

      {/* Storage Stats */}
      <div style={{
        background: "var(--surface)",
        padding: "0.75rem 1rem",
        borderRadius: "6px",
        marginBottom: "1rem",
        fontSize: "0.9rem"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <span>Stored documents:</span>
          <strong>{stats.count}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <span>Storage used:</span>
          <strong>{stats.sizeKB} KB</strong>
        </div>
        {stats.oldestDate && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Date range:</span>
            <strong style={{ fontSize: "0.85rem" }}>
              {new Date(stats.oldestDate).toLocaleDateString()} - {new Date(stats.newestDate).toLocaleDateString()}
            </strong>
          </div>
        )}
      </div>

      {/* Import Status */}
      {importStatus && (
        <div style={{
          padding: "0.75rem",
          borderRadius: "6px",
          marginBottom: "1rem",
          fontSize: "0.9rem",
          background: importStatus.type === "success" 
            ? "rgba(34, 197, 94, 0.1)"
            : importStatus.type === "error"
            ? "rgba(220, 38, 38, 0.1)"
            : "var(--surface)",
          border: importStatus.type === "success"
            ? "1px solid rgba(34, 197, 94, 0.3)"
            : importStatus.type === "error"
            ? "1px solid rgba(220, 38, 38, 0.3)"
            : "1px solid var(--border)"
        }}>
          {importStatus.message}
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={stats.count === 0}
        className="btn"
        style={{
          width: "100%",
          marginBottom: "0.75rem",
          background: "var(--primary)",
          opacity: stats.count === 0 ? 0.5 : 1
        }}
      >
        Export All Data to CSV ({stats.count} docs)
      </button>

      {/* Import Section */}
      <div style={{
        border: "1px solid var(--border)",
        borderRadius: "6px",
        padding: "1rem",
        marginBottom: "0.75rem"
      }}>
        <p style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "0.9rem", fontWeight: 600 }}>
          Import from CSV
        </p>

        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem", cursor: "pointer" }}>
            <input
              type="radio"
              name="importMode"
              value="merge"
              checked={importMode === "merge"}
              onChange={(e) => setImportMode(e.target.value)}
              style={{ marginRight: "0.5rem" }}
            />
            <span style={{ fontSize: "0.9rem" }}>
              <strong>Merge:</strong> Keep existing data, skip duplicates by hash
            </span>
          </label>

          <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
            <input
              type="radio"
              name="importMode"
              value="replace"
              checked={importMode === "replace"}
              onChange={(e) => setImportMode(e.target.value)}
              style={{ marginRight: "0.5rem" }}
            />
            <span style={{ fontSize: "0.9rem" }}>
              <strong>Replace:</strong> Clear all existing data first
            </span>
          </label>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleImportFile}
          style={{ display: "none" }}
        />

        <button
          onClick={handleImportClick}
          className="btn"
          style={{
            width: "100%",
            background: "var(--primary-600)"
          }}
        >
          Choose CSV File to Import
        </button>
      </div>

      {/* Clear All Button */}
      {!showClearConfirm ? (
        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={stats.count === 0}
          className="btn"
          style={{
            width: "100%",
            background: "#dc2626",
            opacity: stats.count === 0 ? 0.5 : 1
          }}
        >
          Clear All Data
        </button>
      ) : (
        <div style={{
          background: "rgba(220, 38, 38, 0.1)",
          border: "1px solid rgba(220, 38, 38, 0.3)",
          borderRadius: "6px",
          padding: "1rem"
        }}>
          <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem", fontWeight: 600, color: "#991b1b" }}>
            Are you sure? This will permanently delete all {stats.count} documents from localStorage.
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={handleClearAll}
              className="btn"
              style={{
                flex: 1,
                background: "#dc2626",
                fontSize: "0.9rem"
              }}
            >
              Yes, Delete All
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              style={{
                flex: 1,
                padding: "0.6rem 1rem",
                background: "white",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.9rem"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}