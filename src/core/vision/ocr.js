// ---------------------------------------------------------------------------
// OCR via tesseract.js — reads text from a captured photo or screenshot
// (Camera module: "đọc tài liệu / OCR"). The worker and language data load
// lazily on first use. Vietnamese + English by default.
// ---------------------------------------------------------------------------

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      // 'vie+eng' gives good coverage for this app's audience.
      const worker = await createWorker('vie+eng');
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Run OCR on an image source (dataURL, blob URL, HTMLCanvasElement or File).
 * @returns {Promise<{text:string, confidence:number}>}
 */
export async function ocrImage(image, onProgress) {
  const worker = await getWorker();
  if (onProgress) onProgress(0.1);
  const { data } = await worker.recognize(image);
  if (onProgress) onProgress(1);
  return { text: (data.text || '').trim(), confidence: data.confidence ?? 0 };
}

export async function disposeOcr() {
  if (workerPromise) {
    try { const w = await workerPromise; await w.terminate(); } catch (_) {}
    workerPromise = null;
  }
}
