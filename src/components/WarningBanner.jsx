// src/components/WarningBanner.jsx
import { useState, useEffect } from "react";

export default function WarningBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has dismissed this session
    const isDismissed = sessionStorage.getItem("warning-dismissed");
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem("warning-dismissed", "true");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      style={{
        background: "rgba(251, 191, 36, 0.15)",
        border: "1px solid rgba(251, 191, 36, 0.4)",
        borderRadius: "8px",
        padding: "1rem",
        marginBottom: "1.5rem",
        position: "relative"
      }}
    >
      <button
        onClick={handleDismiss}
        style={{
          position: "absolute",
          top: "0.75rem",
          right: "0.75rem",
          background: "transparent",
          border: "none",
          fontSize: "1.25rem",
          cursor: "pointer",
          color: "var(--text)",
          opacity: 0.6,
          lineHeight: 1,
          padding: "0.25rem"
        }}
        aria-label="Dismiss warning"
      >
        ×
      </button>

      <p style={{ 
        margin: 0,
        fontSize: "0.9rem",
        paddingRight: "2rem"
      }}>
        <strong>Data Storage:</strong> All extracted data is stored in your browser only. 
        If you're on a shared computer, others can see your data. 
        Export your data as CSV before closing the browser to keep a backup.
      </p>
    </div>
  );
}