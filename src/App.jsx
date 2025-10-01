// src/App.jsx
import { useState } from "react";
import Dropzone from "./components/Dropzone";
import DataManager from "./components/DataManager";
import WarningBanner from "./components/WarningBanner";
import AdminMode from "./components/AdminMode";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles/theme.css";

export default function App() {
  const [adminMode, setAdminMode] = useState(() => {
    // Persist admin mode state in localStorage
    const saved = localStorage.getItem('admin-mode-enabled');
    return saved === 'true';
  });
  const [dataVersion, setDataVersion] = useState(0);

  const handleAdminToggle = (enabled) => {
    setAdminMode(enabled);
    localStorage.setItem('admin-mode-enabled', String(enabled));
    console.log('[Admin Mode]', enabled ? 'Enabled' : 'Disabled');
  };

  const handleDataChange = () => {
    // Trigger re-render when data changes
    setDataVersion(prev => prev + 1);
  };

  return (
    <ErrorBoundary>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ 
          marginTop: 0, 
          marginBottom: "0.5rem",
          color: "var(--primary)",
          textAlign: "center"
        }}>
          Doc Scan (Lite)
        </h1>
        <p style={{ 
          marginTop: 0,
          marginBottom: "1.5rem",
          textAlign: "center",
          opacity: 0.9
        }}>
          Upload a PDF or image. AI will parse key fields and save locally. {adminMode && "Google Sheets sync enabled."}
        </p>

        {adminMode && (
          <div style={{
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            fontSize: "0.9rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span>
              <strong>🔐 Admin Mode Active:</strong> Documents will sync to Google Sheets
            </span>
            <button
              onClick={() => handleAdminToggle(false)}
              style={{
                padding: "0.4rem 0.8rem",
                background: "rgba(220, 38, 38, 0.9)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem"
              }}
            >
              Disable Admin
            </button>
          </div>
        )}

        <WarningBanner />
        
        <Dropzone key={dataVersion} adminMode={adminMode} />
        
        <DataManager onDataChange={handleDataChange} />

        <AdminMode enabled={adminMode} onToggle={handleAdminToggle} />
      </main>
    </ErrorBoundary>
  );
}