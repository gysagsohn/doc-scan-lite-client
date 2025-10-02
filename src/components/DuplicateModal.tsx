import { DocumentData, getDaysAgo } from "../lib/storage";
import styles from "../styles/DuplicateModal.module.css";

interface DuplicateModalProps {
  document: DocumentData;
  onUseCached: () => void;
  onReprocess: () => void;
  onCancel: () => void;
}

export default function DuplicateModal({ document, onUseCached, onReprocess, onCancel }: DuplicateModalProps) {
  const daysAgo = getDaysAgo(document.timestamp);
  const timeAgoText = daysAgo === 0 
    ? "today" 
    : daysAgo === 1 
    ? "yesterday" 
    : `${daysAgo} days ago`;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Document Already Processed</h2>

        <div className={styles.fileInfo}>
          <p className={styles.infoRow}>
            <strong>File:</strong> {document.file?.file_name || document.file_name}
          </p>
          <p className={styles.infoRow}>
            <strong>Processed:</strong> {timeAgoText}
          </p>
          <p className={styles.infoRow}>
            <strong>Size:</strong> {((document.file?.file_size || document.file_size || 0) / 1024).toFixed(0)} KB
          </p>
        </div>

        {document.document_type && (
          <div className={styles.preview}>
            <h3 className={styles.previewTitle}>Cached Data Preview</h3>
            
            <div className={styles.previewContent}>
              {document.document_type && (
                <p className={styles.previewRow}>
                  <strong>Type:</strong> {document.document_type}
                </p>
              )}
              {document.name_full && (
                <p className={styles.previewRow}>
                  <strong>Name:</strong> {document.name_full}
                </p>
              )}
              {document.document_number && (
                <p className={styles.previewRow}>
                  <strong>Number:</strong> {document.document_number}
                </p>
              )}
              {document.date_expiry && (
                <p className={styles.previewRow}>
                  <strong>Expiry:</strong> {document.date_expiry}
                </p>
              )}
            </div>
          </div>
        )}

        <div className={styles.warning}>
          <p>
            <strong>Note:</strong> Reprocessing will cost ~$0.001-0.01 in OpenAI API fees. 
            Using cached data is instant and free.
          </p>
        </div>

        <div className={styles.actions}>
          <button onClick={onUseCached} className={`btn ${styles.useCachedButton}`}>
            Use Cached Data
          </button>
          
          <button onClick={onReprocess} className={`btn ${styles.reprocessButton}`}>
            Reprocess Anyway
          </button>
          
          <button onClick={onCancel} className={styles.cancelButton}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}