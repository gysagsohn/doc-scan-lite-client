const STORAGE_KEY = "doc-scan-v1";
const STORAGE_VERSION = "1.0";

export interface DocumentData {
  timestamp: string;
  document_type?: string | null;
  name_full?: string | null;
  date_issued?: string | null;
  date_expiry?: string | null;
  document_number?: string | null;
  document_number_type?: string | null;
  issuer?: string | null;
  file?: {
    file_name: string;
    mime_type: string;
    file_size: number;
    file_hash: string;
  };
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  file_hash?: string;
  extras?: Record<string, unknown>;
  confidence?: Record<string, unknown>;
  audit?: Record<string, unknown>;
}

interface StorageData {
  documents: DocumentData[];
  meta: {
    version: string;
    lastModified: string;
    count: number;
  };
}

export interface StorageStats {
  count: number;
  sizeKB: string;
  oldestDate: string | null;
  newestDate: string | null;
}

export function getAllDocuments(): DocumentData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    
    const data: StorageData = JSON.parse(raw);
    return data.documents || [];
  } catch (err) {
    console.error("[Storage] Failed to read documents:", err);
    return [];
  }
}

export function findDocumentByHash(hash: string): DocumentData | null {
  const docs = getAllDocuments();
  return docs.find(doc => {
    const docHash = doc.file?.file_hash || doc.file_hash;
    return docHash === hash;
  }) || null;
}

export function saveDocument(document: DocumentData): boolean {
  try {
    const docs = getAllDocuments();
    
    if (!document.timestamp) {
      document.timestamp = new Date().toISOString();
    }
    
    const newDocHash = document.file?.file_hash || document.file_hash;
    
    if (!newDocHash) {
      console.error("[Storage] Cannot save document without file_hash");
      return false;
    }
    
    const existingIndex = docs.findIndex(d => {
      const existingHash = d.file?.file_hash || d.file_hash;
      return existingHash === newDocHash;
    });
    
    if (existingIndex >= 0) {
      docs[existingIndex] = document;
    } else {
      docs.push(document);
    }
    
    const data: StorageData = {
      documents: docs,
      meta: {
        version: STORAGE_VERSION,
        lastModified: new Date().toISOString(),
        count: docs.length
      }
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event('doc-scan-storage-updated'));
    
    return true;
  } catch (err) {
    console.error("[Storage] Failed to save document:", err);
    
    if ((err as Error).name === "QuotaExceededError") {
      throw new Error("Storage quota exceeded. Please export and clear old data.");
    }
    
    return false;
  }
}

export function clearAllDocuments(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('doc-scan-storage-updated'));
    return true;
  } catch (err) {
    console.error("[Storage] Failed to clear documents:", err);
    return false;
  }
}

export function getStorageStats(): StorageStats {
  const docs = getAllDocuments();
  const raw = localStorage.getItem(STORAGE_KEY) || "{}";
  
  return {
    count: docs.length,
    sizeKB: (raw.length / 1024).toFixed(2),
    oldestDate: docs.length > 0 
      ? new Date(Math.min(...docs.map(d => new Date(d.timestamp).getTime()))).toISOString() 
      : null,
    newestDate: docs.length > 0 
      ? new Date(Math.max(...docs.map(d => new Date(d.timestamp).getTime()))).toISOString() 
      : null
  };
}

export function getDaysAgo(timestamp: string): number {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.floor(diffDays);
}