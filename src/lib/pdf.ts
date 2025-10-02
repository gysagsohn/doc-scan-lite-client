import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.mjs";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

export async function pdfToPageDataURLs(
  file: File, 
  maxPages = 2, 
  scale = 1.5,  // 1.5x scale provides good quality while keeping file size reasonable
  maxDimension = 800  // 800px keeps images under OpenAI's token limits while preserving readability
): Promise<string[]> {
  const arrayBuf = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuf }).promise;

  const pageCount = Math.min(maxPages, pdf.numPages);
  const urls: string[] = [];

  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p);
    let viewport = page.getViewport({ scale });
    
    // Downsample if dimensions exceed maxDimension to prevent large payloads
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
    
    // JPEG at 70% quality balances file size vs readability for OCR
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    urls.push(dataUrl);
    
    // Clean up canvas to prevent memory leaks
    canvas.width = 0;
    canvas.height = 0;
  }

  return urls;
}