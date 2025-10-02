import { DocumentData } from "./storage";

export function documentsToCSV(documents: DocumentData[]): string {
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
    const fileObj = doc.file || {
      file_name: "",
      mime_type: "",
      file_size: 0,
      file_hash: ""
    };
    
    return [
      doc.timestamp || "",
      doc.document_type || "",
      doc.name_full || "",
      doc.date_issued || "",
      doc.date_expiry || "",
      doc.document_number || "",
      doc.document_number_type || "",
      doc.issuer || "",
      fileObj.file_name || doc.file_name || "",
      fileObj.mime_type || doc.mime_type || "",
      String(fileObj.file_size || doc.file_size || ""),
      fileObj.file_hash || doc.file_hash || "",
      JSON.stringify(doc.extras || {}),
      JSON.stringify(doc.confidence || {}),
      JSON.stringify(doc.audit || {})
    ];
  });

  const escapeCsvField = (field: string | number): string => {
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

export function csvToDocuments(csvString: string): DocumentData[] {
  const lines = csvString.trim().split('\n');
  
  if (lines.length < 2) {
    throw new Error("CSV file is empty or invalid");
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const requiredColumns = ["file_hash", "timestamp", "file_name"];
  const missingColumns = requiredColumns.filter(col => !headers.includes(col));
  
  if (missingColumns.length > 0) {
    throw new Error(`CSV missing required columns: ${missingColumns.join(', ')}`);
  }

  const documents: DocumentData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    
    if (values.length !== headers.length) {
      console.warn(`Row ${i + 1} has ${values.length} values but expected ${headers.length}. Skipping.`);
      continue;
    }

    const doc: DocumentData = { timestamp: "" };
    headers.forEach((header, index) => {
      const value = values[index];
      
      if (header.endsWith('_json')) {
        const key = header.replace('_json', '') as keyof DocumentData;
        try {
          (doc as any)[key] = value ? JSON.parse(value) : {};
        } catch {
          (doc as any)[key] = {};
        }
      } else if (header === 'file_size') {
        (doc as any)[header] = value ? parseInt(value, 10) : 0;
      } else {
        (doc as any)[header] = value || null;
      }
    });

    documents.push(doc);
  }

  return documents;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export function downloadCSV(csvContent: string, filename?: string): void {
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