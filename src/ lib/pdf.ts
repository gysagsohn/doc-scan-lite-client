import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.mjs";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

export async function pdfToPageDataURLs(file: File, maxPages = 2, scale = 1.5): Promise<string[]> {
  const arrayBuf = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuf }).promise;

  const pageCount = Math.min(maxPages, pdf.numPages);
  const urls: string[] = [];

  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    urls.push(dataUrl);
  }

  return urls;
}
