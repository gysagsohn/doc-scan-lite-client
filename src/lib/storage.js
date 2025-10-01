// src/lib/storage.js

const STORAGE_KEY = "doc-scan-v1";
const STORAGE_VERSION = "1.0";

/**
 * Get all documents from localStorage
 */
export function getAllDocuments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    
    const data = JSON.parse(raw);
    return data.documents || [];
  } catch (err) {
    console.error("[Storage] Failed to read documents:", err);
    return [];
  }
}

/**
 * Find document by hash
 * @param {string} hash - File hash (e.g., "sha256:abc123...")
 * @returns {object|null} Document or null if not found
 */
export function findDocumentByHash(hash) {
  const docs = getAllDocuments();
  return docs.find(doc => {
    // Check both root level and nested in file object
    return doc.file_hash === hash || doc.file?.file_hash === hash;
  }) || null;
}

/**
 * Save a new document to localStorage
 * @param {object} document - Complete document object from OpenAI response
 */
export function saveDocument(document) {
  try {
    const docs = getAllDocuments();
    
    // Add timestamp if not present
    if (!document.timestamp) {
      document.timestamp = new Date().toISOString();
    }
    
    // Check if document already exists (by hash in file object)
    const existingIndex = docs.findIndex(d => {
      return d.file_hash === document.file_hash || 
             d.file?.file_hash === document.file_hash ||
             d.file?.file_hash === document.file?.file_hash;
    });
    
    if (existingIndex >= 0) {
      // Update existing document
      docs[existingIndex] = document;
      console.log("[Storage] Updated existing document:", document.file?.file_hash || document.file_hash);
    } else {
      // Add new document
      docs.push(document);
      console.log("[Storage] Saved new document:", document.file?.file_hash || document.file_hash);
    }
    
    const data = {
      documents: docs,
      meta: {
        version: STORAGE_VERSION,
        lastModified: new Date().toISOString(),
        count: docs.length
      }
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error("[Storage] Failed to save document:", err);
    
    // Check if quota exceeded
    if (err.name === "QuotaExceededError") {
      throw new Error("Storage quota exceeded. Please export and clear old data.");
    }
    
    return false;
  }
}

/**
 * Clear all documents from localStorage
 */
export function clearAllDocuments() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log("[Storage] Cleared all documents");
    return true;
  } catch (err) {
    console.error("[Storage] Failed to clear documents:", err);
    return false;
  }
}

/**
 * Get storage statistics
 */
export function getStorageStats() {
  const docs = getAllDocuments();
  const raw = localStorage.getItem(STORAGE_KEY) || "{}";
  
  return {
    count: docs.length,
    sizeKB: (raw.length / 1024).toFixed(2),
    oldestDate: docs.length > 0 
      ? new Date(Math.min(...docs.map(d => new Date(d.timestamp)))).toISOString() 
      : null,
    newestDate: docs.length > 0 
      ? new Date(Math.max(...docs.map(d => new Date(d.timestamp)))).toISOString() 
      : null
  };
}

/**
 * Calculate how many days ago a document was processed
 * @param {string} timestamp - ISO timestamp
 * @returns {number} Days ago (rounded)
 */
export function getDaysAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.floor(diffDays);
}