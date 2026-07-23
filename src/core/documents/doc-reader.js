// ---------------------------------------------------------------------------
// Document reader — extracts text from PDF, DOCX and TXT so the assistant can
// answer questions grounded in the file (per TÀI LIỆU 3, Document module).
// ---------------------------------------------------------------------------

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

async function readTxt(file) {
  return await file.text();
}

async function readPdf(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(' ') + '\n\n';
  }
  return text.trim();
}

async function readDocx(file) {
  const mammoth = await import('mammoth');
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return (result.value || '').trim();
}

/**
 * @param {File} file
 * @returns {Promise<{name:string, type:string, text:string, chars:number}>}
 */
export async function readDocument(file) {
  const name = file.name || 'document';
  const lower = name.toLowerCase();
  let text = '';
  let type = 'txt';

  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    type = 'pdf';
    text = await readPdf(file);
  } else if (lower.endsWith('.docx') || file.type.includes('officedocument.wordprocessing')) {
    type = 'docx';
    text = await readDocx(file);
  } else {
    type = 'txt';
    text = await readTxt(file);
  }

  return { name, type, text, chars: text.length };
}

export const SUPPORTED_DOC_TYPES = '.pdf,.docx,.txt,text/plain,application/pdf';
