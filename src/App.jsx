// src/App.jsx
import { useState } from "react";
import Dropzone from "./components/Dropzone";
import DataManager from "./components/DataManager";
import WarningBanner from "./components/WarningBanner";
import AdminMode from "./components/AdminMode";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles/theme.css";

export default function App() {
  const [adminMode, setAdminMode] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

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
          Upload a PDF or image. {adminMode ? "AI will parse key fields and sync to Google Sheets." : "Files are saved locally for duplicate detection."}
        </p>

        {adminMode && (
          <div style={{
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            fontSize: "0.9rem",
            textAlign: "center"
          }}>
            <strong>Admin Mode Active:</strong> Documents will also sync to your private Google Sheet
          </div>
        )}

        <WarningBanner />
        
        <Dropzone key={dataVersion} adminMode={adminMode} />
        
        <DataManager onDataChange={handleDataChange} />

        <AdminMode enabled={adminMode} onToggle={setAdminMode} />
      </main>
    </ErrorBoundary>
  );
}