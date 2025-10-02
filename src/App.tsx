import Dropzone from "./components/Dropzone";
import DataManager from "./components/DataManager";
import WarningBanner from "./components/WarningBanner";
import AdminMode from "./components/AdminMode";
import ErrorBoundary from "./components/ErrorBoundary";
import { AdminProvider, useAdmin } from "./contexts/AdminContext";
import styles from "./styles/App.module.css";
import "./styles/theme.css";

function AppContent() {
  const { adminMode, setAdminMode } = useAdmin();

  const handleDisableAdmin = () => {
    setAdminMode(false);
  };

  return (
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
          <button onClick={handleDisableAdmin} className={styles.disableButton}>
            Disable Admin
          </button>
        </div>
      )}

      <WarningBanner />
      
      <Dropzone />
      
      <DataManager />

      <AdminMode />
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AdminProvider>
        <AppContent />
      </AdminProvider>
    </ErrorBoundary>
  );
}