import { useState, useEffect } from "react";
import { useAdmin } from "../contexts/AdminContext";
import styles from "../styles/AdminMode.module.css";

export default function AdminMode() {
  const { adminMode, setAdminMode } = useAdmin();
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [showActivated, setShowActivated] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (clickCount > 0) {
        setClickCount(0);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [clickCount, lastClickTime]);

  const handleFooterClick = () => {
    const now = Date.now();
    
    if (now - lastClickTime > 1000) {
      setClickCount(1);
    } else {
      setClickCount(prev => prev + 1);
    }
    
    setLastClickTime(now);

    if (clickCount === 2) {
      const newState = !adminMode;
      setAdminMode(newState);
      setShowActivated(true);
      setTimeout(() => setShowActivated(false), 3000);
      setClickCount(0);
    }
  };

  const toastClass = `${styles.toast} ${adminMode ? styles.enabled : styles.disabled}`;

  return (
    <>
      {showActivated && (
        <div className={toastClass}>
          {adminMode ? "Admin Mode Enabled" : "Admin Mode Disabled"}
        </div>
      )}

      <footer onClick={handleFooterClick} className={styles.footer} title="Triple-click to enable admin mode">
        Uses OpenAI Vision (gpt-4o-mini) • Max 10MB • Optimized to 800px JPEG
      </footer>
    </>
  );
}