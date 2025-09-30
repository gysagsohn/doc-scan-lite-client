// src/lib/pdf.ts
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.mjs";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

/**
 * Converts PDF pages to PNG data URLs with automatic downsampling
 * @param file - PDF file to convert
 * @param maxPages - Maximum number of pages to extract (default: 2)
 * @param scale - Initial render scale (default: 1.5)
 * @param maxDimension - Maximum width/height in pixels (default: 1600)
 * @returns Array of PNG data URLs
 */
export async function pdfToPageDataURLs(
  file: File, 
  maxPages = 2, 
  scale = 1.5,
  maxDimension = 1600
): Promise<string[]> {
  const arrayBuf = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuf }).promise;

  const pageCount = Math.min(maxPages, pdf.numPages);
  const urls: string[] = [];

  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p);
    let viewport = page.getViewport({ scale });
    
    // Downsample if dimensions exceed maxDimension
    const maxCurrentDim = Math.max(viewport.width, viewport.height);
    if (maxCurrentDim > maxDimension) {
      const scaleFactor = maxDimension / maxCurrentDim;
      viewport = page.getViewport({ scale: scale * scaleFactor });
    }
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      throw new Error(`Failed to get canvas context for page ${p}`);
    }
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;
    
    // Use JPEG with 85% quality for smaller file size
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    urls.push(dataUrl);
    
    // Clean up
    canvas.width = 0;
    canvas.height = 0;
  }

  return urls;
}