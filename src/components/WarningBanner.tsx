import { useState } from "react";
import styles from "../styles/WarningBanner.module.css";

export default function WarningBanner() {
  const [dismissed, setDismissed] = useState(() => 
    sessionStorage.getItem("warning-dismissed") === "true"
  );

  const handleDismiss = () => {
    sessionStorage.setItem("warning-dismissed", "true");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className={styles.banner}>
      <button onClick={handleDismiss} className={styles.closeButton} aria-label="Dismiss warning">
        ×
      </button>

      <p className={styles.text}>
        <strong>Data Storage:</strong> All extracted data is stored in your browser only. 
        If you're on a shared computer, others can see your data. 
        Export your data as CSV before closing the browser to keep a backup.
      </p>
    </div>
  );
}