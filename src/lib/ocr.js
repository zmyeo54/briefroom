import * as pdfjs from "pdfjs-dist";
import mammoth from "mammoth";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;
const TEXT_EXT = /\.(txt|md|csv|json)$/i;

async function loadTesseract() {
  const mod = await import("tesseract.js/dist/tesseract.esm.min.js");
  return mod.default || mod;
}

/**
 * Extract text from uploaded file.
 * - txt/md: read directly
 * - docx: mammoth
 * - pdf: text layer first; if thin, OCR rendered pages
 * - images: Tesseract OCR (chi_sim + eng)
 */
export async function extractTextFromFile(file, onProgress) {
  const name = file.name || "upload";
  const type = file.type || "";

  if (TEXT_EXT.test(name) || type.startsWith("text/")) {
    onProgress?.("Reading text file…");
    return await file.text();
  }

  if (name.toLowerCase().endsWith(".docx") || type.includes("wordprocessingml")) {
    onProgress?.("Parsing Word document…");
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return (result.value || "").trim();
  }

  if (name.toLowerCase().endsWith(".pdf") || type === "application/pdf") {
    return await extractPdf(file, onProgress);
  }

  if (IMAGE_EXT.test(name) || type.startsWith("image/")) {
    onProgress?.("Running OCR on image…");
    return await ocrCanvas(await fileToCanvas(file), onProgress);
  }

  onProgress?.("Trying plain text…");
  return await file.text();
}

async function extractPdf(file, onProgress) {
  onProgress?.("Reading PDF…");
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`PDF text layer ${i}/${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str || "").join(" ") + "\n";
  }

  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length >= 80) return compact;

  onProgress?.("Little text found — OCR scanning pages…");
  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker(["chi_sim", "eng"]);
  let ocr = "";
  try {
    const max = Math.min(pdf.numPages, 12);
    for (let i = 1; i <= max; i++) {
      onProgress?.(`OCR page ${i}/${max}…`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const {
        data: { text: pageOcr },
      } = await worker.recognize(canvas);
      ocr += pageOcr + "\n";
    }
  } finally {
    await worker.terminate();
  }
  return ocr.replace(/\s+/g, " ").trim() || compact;
}

async function fileToCanvas(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvas;
}

async function ocrCanvas(canvas, onProgress) {
  onProgress?.("OCR (Chinese + English)…");
  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker(["chi_sim", "eng"]);
  try {
    const {
      data: { text },
    } = await worker.recognize(canvas);
    return (text || "").trim();
  } finally {
    await worker.terminate();
  }
}
