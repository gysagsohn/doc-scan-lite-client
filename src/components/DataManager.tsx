import { useState, useRef, useCallback, useEffect, ChangeEvent } from "react";
import { getAllDocuments, clearAllDocuments, saveDocument, getStorageStats, StorageStats } from "../lib/storage";
import { documentsToCSV, csvToDocuments, downloadCSV } from "../lib/csv";
import styles from "../styles/DataManager.module.css";

export default function DataManager() {
  const [stats, setStats] = useState<StorageStats>(getStorageStats());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importStatus, setImportStatus] = useState<{
    type: "loading" | "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshStats = useCallback(() => {
    setStats(getStorageStats());
  }, []);

  useEffect(() => {
    const handleStorageUpdate = () => {
      refreshStats();
    };

    refreshStats();
    window.addEventListener('doc-scan-storage-updated', handleStorageUpdate);

    return () => {
      window.removeEventListener('doc-scan-storage-updated', handleStorageUpdate);
    };
  }, [refreshStats]);

  const handleExport = useCallback(() => {
    try {
      const docs = getAllDocuments();
      
      if (docs.length === 0) {
        alert("No data to export");
        return;
      }

      const csvContent = documentsToCSV(docs);
      downloadCSV(csvContent);
    } catch (err) {
      console.error("[Export] Error:", err);
      alert(`Export failed: ${(err as Error).message}`);
    }
  }, []);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    try {
      setImportStatus({ type: "loading", message: "Reading CSV..." });

      const text = await file.text();
      const importedDocs = csvToDocuments(text);

      if (importedDocs.length === 0) {
        throw new Error("No valid documents found in CSV");
      }

      if (importMode === "replace") {
        clearAllDocuments();
      }

      let savedCount = 0;
      let skippedCount = 0;
      let updatedCount = 0;

      importedDocs.forEach(doc => {
        const existingDocs = getAllDocuments();
        const existingDoc = existingDocs.find(d => 
          d.file?.file_hash === doc.file_hash || d.file_hash === doc.file_hash
        );

        if (importMode === "merge" && existingDoc) {
          skippedCount++;
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
    } catch (err) {
      console.error("[Import] Error:", err);
      setImportStatus({
        type: "error",
        message: `Import failed: ${(err as Error).message}`
      });
      setTimeout(() => setImportStatus(null), 5000);
    }
  }, [importMode, refreshStats]);

  const handleClearAll = useCallback(() => {
    const success = clearAllDocuments();
    if (success) {
      refreshStats();
      setShowClearConfirm(false);
    } else {
      alert("Failed to clear data");
    }
  }, [refreshStats]);

  const getStatusClass = () => {
    if (!importStatus) return '';
    if (importStatus.type === "success") return styles.statusSuccess;
    if (importStatus.type === "error") return styles.statusError;
    return styles.statusLoading;
  };

  return (
    <div className={`card ${styles.container}`}>
      <h3 className={styles.title}>Data Management</h3>

      <div className={styles.statsContainer}>
        <div className={styles.statRow}>
          <span>Stored documents:</span>
          <strong>{stats.count}</strong>
        </div>
        <div className={styles.statRow}>
          <span>Storage used:</span>
          <strong>{stats.sizeKB} KB</strong>
        </div>
        {stats.oldestDate && (
          <div className={styles.statRow}>
            <span>Date range:</span>
            <strong className={styles.dateRange}>
              {new Date(stats.oldestDate).toLocaleDateString()} - {new Date(stats.newestDate!).toLocaleDateString()}
            </strong>
          </div>
        )}
      </div>

      {importStatus && (
        <div className={`${styles.statusContainer} ${getStatusClass()}`}>
          {importStatus.message}
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={stats.count === 0}
        className={`btn ${styles.exportButton}`}
      >
        Export All Data to CSV ({stats.count} docs)
      </button>

      <div className={styles.importSection}>
        <p className={styles.importTitle}>Import from CSV</p>

        <div className={styles.importModes}>
          <label className={styles.modeLabel}>
            <input
              type="radio"
              name="importMode"
              value="merge"
              checked={importMode === "merge"}
              onChange={(e) => setImportMode(e.target.value as "merge" | "replace")}
              className={styles.modeRadio}
            />
            <span className={styles.modeText}>
              <strong>Merge:</strong> Keep existing data, skip duplicates by hash
            </span>
          </label>

          <label className={styles.modeLabel}>
            <input
              type="radio"
              name="importMode"
              value="replace"
              checked={importMode === "replace"}
              onChange={(e) => setImportMode(e.target.value as "merge" | "replace")}
              className={styles.modeRadio}
            />
            <span className={styles.modeText}>
              <strong>Replace:</strong> Clear all existing data first
            </span>
          </label>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleImportFile}
          className={styles.fileInput}
        />

        <button onClick={handleImportClick} className={`btn ${styles.importButton}`}>
          Choose CSV File to Import
        </button>
      </div>

      {!showClearConfirm ? (
        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={stats.count === 0}
          className={`btn ${styles.clearButton}`}
        >
          Clear All Data
        </button>
      ) : (
        <div className={styles.confirmContainer}>
          <p className={styles.confirmText}>
            Are you sure? This will permanently delete all {stats.count} documents from localStorage.
          </p>
          <div className={styles.confirmButtons}>
            <button onClick={handleClearAll} className={`btn ${styles.confirmYes}`}>
              Yes, Delete All
            </button>
            <button onClick={() => setShowClearConfirm(false)} className={styles.confirmCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}