// src/components/DuplicateModal.jsx
import { getDaysAgo } from "../lib/storage";

export default function DuplicateModal({ document, onUseCached, onReprocess, onCancel }) {
  const daysAgo = getDaysAgo(document.timestamp);
  const timeAgoText = daysAgo === 0 
    ? "today" 
    : daysAgo === 1 
    ? "yesterday" 
    : `${daysAgo} days ago`;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem"
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "2rem",
          maxWidth: "500px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          maxHeight: "90vh",
          overflow: "auto"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ 
          marginTop: 0, 
          color: "var(--primary)",
          fontSize: "1.5rem"
        }}>
          Document Already Processed
        </h2>

        <div style={{
          background: "var(--surface)",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1.5rem"
        }}>
          <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", opacity: 0.8 }}>
            <strong>File:</strong> {document.file_name}
          </p>
          <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", opacity: 0.8 }}>
            <strong>Processed:</strong> {timeAgoText}
          </p>
          <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.8 }}>
            <strong>Size:</strong> {(document.file_size / 1024).toFixed(0)} KB
          </p>
        </div>

        {document.document_type && (
          <div style={{
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "1.5rem"
          }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: "0.75rem",
              fontSize: "1rem",
              color: "var(--primary)"
            }}>
              Cached Data Preview
            </h3>
            
            <div style={{ fontSize: "0.9rem", lineHeight: "1.6" }}>
              {document.document_type && (
                <p style={{ margin: "0 0 0.5rem 0" }}>
                  <strong>Type:</strong> {document.document_type}
                </p>
              )}
              {document.name_full && (
                <p style={{ margin: "0 0 0.5rem 0" }}>
                  <strong>Name:</strong> {document.name_full}
                </p>
              )}
              {document.document_number && (
                <p style={{ margin: "0 0 0.5rem 0" }}>
                  <strong>Number:</strong> {document.document_number}
                </p>
              )}
              {document.date_expiry && (
                <p style={{ margin: 0 }}>
                  <strong>Expiry:</strong> {document.date_expiry}
                </p>
              )}
            </div>
          </div>
        )}

        <div style={{
          background: "rgba(251, 191, 36, 0.1)",
          border: "1px solid rgba(251, 191, 36, 0.3)",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "1.5rem",
          fontSize: "0.9rem"
        }}>
          <p style={{ margin: 0 }}>
            <strong>Note:</strong> Reprocessing will cost ~$0.001-0.01 in OpenAI API fees. 
            Using cached data is instant and free.
          </p>
        </div>

        <div style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap"
        }}>
          <button
            onClick={onUseCached}
            className="btn"
            style={{
              flex: 1,
              minWidth: "140px",
              background: "var(--primary)",
              padding: "0.75rem 1rem"
            }}
          >
            Use Cached Data
          </button>
          
          <button
            onClick={onReprocess}
            className="btn"
            style={{
              flex: 1,
              minWidth: "140px",
              background: "var(--accent)",
              padding: "0.75rem 1rem"
            }}
          >
            Reprocess Anyway
          </button>
          
          <button
            onClick={onCancel}
            style={{
              flex: "0 0 100%",
              padding: "0.5rem 1rem",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              color: "var(--text)",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}