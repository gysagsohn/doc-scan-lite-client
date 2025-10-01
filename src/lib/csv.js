// src/lib/csv.js

/**
 * Convert documents to CSV format
 * Columns match your spec: timestamp, document_type, name_full, date_issued, date_expiry, 
 * document_number, document_number_type, issuer, file_name, mime_type, file_size, 
 * file_hash, extras_json, confidence_json, audit_json
 */
export function documentsToCSV(documents) {
  if (!documents || documents.length === 0) {
    throw new Error("No documents to export");
  }

  const headers = [
    "timestamp",
    "document_type",
    "name_full",
    "date_issued",
    "date_expiry",
    "document_number",
    "document_number_type",
    "issuer",
    "file_name",
    "mime_type",
    "file_size",
    "file_hash",
    "extras_json",
    "confidence_json",
    "audit_json"
  ];

  const rows = documents.map(doc => {
    return [
      doc.timestamp || "",
      doc.document_type || "",
      doc.name_full || "",
      doc.date_issued || "",
      doc.date_expiry || "",
      doc.document_number || "",
      doc.document_number_type || "",
      doc.issuer || "",
      doc.file_name || "",
      doc.mime_type || "",
      doc.file_size || "",
      doc.file_hash || "",
      JSON.stringify(doc.extras || {}),
      JSON.stringify(doc.confidence || {}),
      JSON.stringify(doc.audit || {})
    ];
  });

  // Escape CSV fields
  const escapeCsvField = (field) => {
    const str = String(field);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCsvField).join(','))
  ];

  return csvLines.join('\n');
}

/**
 * Parse CSV string back to documents array
 */
export function csvToDocuments(csvString) {
  const lines = csvString.trim().split('\n');
  
  if (lines.length < 2) {
    throw new Error("CSV file is empty or invalid");
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // Validate required columns
  const requiredColumns = ["file_hash", "timestamp", "file_name"];
  const missingColumns = requiredColumns.filter(col => !headers.includes(col));
  
  if (missingColumns.length > 0) {
    throw new Error(`CSV missing required columns: ${missingColumns.join(', ')}`);
  }

  // Parse data rows
  const documents = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseCSVLine(line);
    
    if (values.length !== headers.length) {
      console.warn(`Row ${i + 1} has ${values.length} values but expected ${headers.length}. Skipping.`);
      continue;
    }

    const doc = {};
    headers.forEach((header, index) => {
      const value = values[index];
      
      // Parse JSON fields
      if (header.endsWith('_json')) {
        try {
          doc[header.replace('_json', '')] = value ? JSON.parse(value) : {};
        } catch {
          doc[header.replace('_json', '')] = {};
        }
      } else if (header === 'file_size') {
        doc[header] = value ? parseInt(value, 10) : 0;
      } else {
        doc[header] = value || null;
      }
    });

    documents.push(doc);
  }

  return documents;
}

/**
 * Parse a single CSV line handling quotes and commas
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);

  return result;
}

/**
 * Trigger download of CSV file
 */
export function downloadCSV(csvContent, filename = null) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const defaultFilename = `doc-scan-data-${timestamp}.csv`;
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename || defaultFilename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}