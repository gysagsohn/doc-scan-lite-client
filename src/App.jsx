// src/App.jsx
import { useState } from "react";
import Dropzone from "./components/Dropzone";
import DataManager from "./components/DataManager";
import WarningBanner from "./components/WarningBanner";
import AdminMode from "./components/AdminMode";
import ErrorBoundary from "./components/ErrorBoundary";
import styles from "./styles/App.module.css"; // ← FIXED: Was AdminMode.module.css
import "./styles/theme.css";

export default function App() {
  const [adminMode, setAdminMode] = useState(() => {
    const saved = localStorage.getItem('admin-mode-enabled');
    return saved === 'true';
  });

  const handleAdminToggle = (enabled) => {
    setAdminMode(enabled);
    localStorage.setItem('admin-mode-enabled', String(enabled));
  };

  const handleDataChange = () => {
    // Callback for when DataManager updates
  };

  return (
    <ErrorBoundary>
      <main className={styles.main}>
        <h1 className={styles.title}>Doc Scan (Lite)</h1>
        <p className={styles.subtitle}>
          Upload a PDF or image. AI will parse key fields and save locally. {adminMode && "Google Sheets sync enabled."}
        </p>

        {adminMode && (
          <div className={styles.adminBanner}>
            <span>
              <strong>🔐 Admin Mode Active:</strong> Documents will sync to Google Sheets
            </span>
            <button onClick={() => handleAdminToggle(false)} className={styles.disableButton}>
              Disable Admin
            </button>
          </div>
        )}

        <WarningBanner />
        
        <Dropzone adminMode={adminMode} />
        
        <DataManager onDataChange={handleDataChange} />

        <AdminMode enabled={adminMode} onToggle={handleAdminToggle} />
      </main>
    </ErrorBoundary>
  );
}