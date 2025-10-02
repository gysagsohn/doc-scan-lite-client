import styles from "../styles/NonDocumentModal.module.css";

interface NonDocumentModalProps {
  detectedType: string;
  confidence: number;
  reasoning: string;
  onContinue: () => void;
  onCancel: () => void;
}

export default function NonDocumentModal({ 
  detectedType, 
  confidence, 
  reasoning, 
  onContinue, 
  onCancel 
}: NonDocumentModalProps) {
  const confidencePercent = (confidence * 100).toFixed(0);
  
  const getDetectedTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
      receipt: "Receipt or Invoice",
      photo: "Personal Photo",
      screenshot: "Screenshot",
      letter: "Letter or Email",
      handwritten: "Handwritten Note",
      blank: "Blank Page",
      text_document: "Text Document",
      unknown: "Unknown Type"
    };
    
    return typeMap[type] || type;
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>⚠️ This Doesn't Look Like a Document</h2>

        <div className={styles.detection}>
          <p className={styles.detectionRow}>
            <strong>Detected as:</strong> {getDetectedTypeLabel(detectedType)}
          </p>
          <p className={styles.detectionRow}>
            <strong>Confidence:</strong> {confidencePercent}%
          </p>
          {reasoning && (
            <p className={styles.reasoning}>
              {reasoning}
            </p>
          )}
        </div>

        <div className={styles.supported}>
          <h3 className={styles.supportedTitle}>Supported Documents</h3>
          <ul className={styles.supportedList}>
            <li>Driver licenses, passports, national IDs</li>
            <li>Work safety cards (White Card, High Risk Work Licence)</li>
            <li>Professional certificates (VOC, training certificates)</li>
            <li>Insurance certificates (Certificate of Currency)</li>
          </ul>
        </div>

        <div className={styles.warning}>
          <p>
            <strong>Cost Warning:</strong> This is a personal project running on limited API credits. 
            Processing non-documents wastes money and doesn't produce useful results.
          </p>
          <p className={styles.warningSubtext}>
            If you're confident this is actually a supported document and the AI made a mistake, 
            you can continue. Otherwise, please upload the correct document type.
          </p>
        </div>

        <div className={styles.actions}>
          <button onClick={onCancel} className={`btn ${styles.cancelButton}`}>
            Cancel & Upload Different File
          </button>
          
          <button onClick={onContinue} className={`btn ${styles.continueButton}`}>
            Continue Anyway (Costs Money)
          </button>
        </div>
      </div>
    </div>
  );
}