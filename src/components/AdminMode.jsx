// src/components/AdminMode.jsx
import { useState, useEffect } from "react";

export default function AdminMode({ enabled, onToggle }) {
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [showActivated, setShowActivated] = useState(false);

  useEffect(() => {
    // Reset click count after 2 seconds of no clicks
    const timeout = setTimeout(() => {
      if (clickCount > 0) {
        setClickCount(0);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [clickCount, lastClickTime]);

  const handleFooterClick = () => {
    const now = Date.now();
    
    // Reset if more than 1 second between clicks
    if (now - lastClickTime > 1000) {
      setClickCount(1);
    } else {
      setClickCount(prev => prev + 1);
    }
    
    setLastClickTime(now);

    // Activate admin mode on 3rd click
    if (clickCount === 2) {
      const newState = !enabled;
      onToggle(newState);
      setShowActivated(true);
      setTimeout(() => setShowActivated(false), 3000);
      setClickCount(0);
    }
  };

  return (
    <>
      {showActivated && (
        <div style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          background: enabled ? "rgba(34, 197, 94, 0.95)" : "rgba(107, 114, 128, 0.95)",
          color: "white",
          padding: "0.75rem 1.5rem",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 2000,
          fontWeight: 600,
          fontSize: "0.9rem"
        }}>
          {enabled ? "Admin Mode Enabled" : "Admin Mode Disabled"}
        </div>
      )}

      <footer 
        onClick={handleFooterClick}
        style={{ 
          marginTop: "2rem", 
          textAlign: "center", 
          fontSize: "0.85rem", 
          opacity: 0.7,
          cursor: "pointer",
          userSelect: "none"
        }}
        title="Triple-click to enable admin mode"
      >
        Uses OpenAI Vision (gpt-4o-mini) • Max 10MB • Optimized to 800px JPEG
      </footer>
    </>
  );
}