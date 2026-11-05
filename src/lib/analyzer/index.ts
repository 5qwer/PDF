/**
 * Advanced Document Understanding Engine — Phase 1 + Phase 2
 *
 * Entry point: analyzePdfPage / analyzePdfDocument
 * Runs entirely in the browser. Uses pdf.js for digital PDFs, and
 * lazy-loads Tesseract.js as an OCR fallback for scanned pages.
 */

import type { DocumentAnalysis, PageAnalysis } from './types';
import { ensurePdfWorker, pdfjsLib } from './pdfjs';
import { buildPageGeometry } from './geometric';
import { clusterTextBlocks, computeReadingOrder } from './elements';

export type { DocumentAnalysis, PageAnalysis, PageElement, PageGeometry } from './types';
export { detectQuestions, computeFontStats, extractBlockFeatures } from './questions';
export type { QuestionCandidate, BlockFeatures, PageFontStats } from './questions';
export { segmentPageByInk } from './visual';

/** Add locally-recognised words to a page and rebuild its visual line tree. */
export function enrichAnalysisWithOcr(
  analysis: PageAnalysis,
  words: import('./types').PageElement[],
): PageAnalysis {
  const base = analysis.elements.filter((e) => e.source !== 'derived' && e.type !== 'text');
  const elements = clusterTextBlocks([...base, ...words], analysis.geometry);
  return { ...analysis, elements, rootIds: computeReadingOrder(elements, true) };
}

export async function loadPdfFromArrayBuffer(data: ArrayBuffer) {
  ensurePdfWorker();
  // pdf.js mutates the buffer, so clone
  const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
  return await loadingTask.promise;
}

export async function analyzePdfPage(
  pdf: import('pdfjs-dist').PDFDocumentProxy,
  pageNumber: number,
): Promise<PageAnalysis> {
  const page = await pdf.getPage(pageNumber);
  const { geometry, elements } = await buildPageGeometry(page, pageNumber);
  const withBlocks = clusterTextBlocks(elements, geometry);
  const rootIds = computeReadingOrder(withBlocks, true);
  return { geometry, elements: withBlocks, rootIds, scale: 1 };
}

/** Analyze every page (or a range) of a document. */
export async function analyzePdfDocument(
  data: ArrayBuffer,
  opts: { fileName?: string; docId?: number; maxPages?: number } = {},
): Promise<DocumentAnalysis> {
  const pdf = await loadPdfFromArrayBuffer(data);
  const total = pdf.numPages;
  const limit = Math.min(total, opts.maxPages ?? total);
  const pages: PageAnalysis[] = [];
  for (let i = 1; i <= limit; i++) {
    pages.push(await analyzePdfPage(pdf, i));
  }
  return {
    docId: opts.docId ?? 0,
    fileName: opts.fileName ?? 'document.pdf',
    totalPages: total,
    pages,
    createdAt: Date.now(),
  };
}

/** OCR fallback — lazy-loaded. Returns text-elements with bounding boxes in page-pt space. */
export async function ocrPageImage(
  canvas: HTMLCanvasElement,
  pageWidthPt: number,
  pageHeightPt: number,
  lang: string = 'ara+eng',
) {
  const { createWorker, PSM } = await import('tesseract.js');
  // Upscale small canvases so tesseract can resolve small answer letters.
  // Aim for at least ~1600px on the long edge — small MCQ font sizes
  // (~8pt) collapse into blobs below this resolution.
  const longEdge = Math.max(canvas.width, canvas.height);
  const upscale = longEdge < 1600 ? Math.min(3, 1600 / longEdge) : 1;
  let ocrCanvas: HTMLCanvasElement = canvas;
  if (upscale > 1.05) {
    const up = document.createElement('canvas');
    up.width = Math.round(canvas.width * upscale);
    up.height = Math.round(canvas.height * upscale);
    const uctx = up.getContext('2d')!;
    uctx.imageSmoothingEnabled = true;
    uctx.imageSmoothingQuality = 'high';
    uctx.drawImage(canvas, 0, 0, up.width, up.height);
    ocrCanvas = up;
  }
  const worker = await createWorker(lang);
  try {
    // PSM.AUTO_OSD handles dense, multi-orientation Arabic pages best.
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO_OSD,
      preserve_interword_spaces: '1',
    });
    const { data } = await worker.recognize(ocrCanvas, {}, { blocks: true } as never);
    const scaleX = pageWidthPt / ocrCanvas.width;
    const scaleY = pageHeightPt / ocrCanvas.height;
    // tesseract.js v7 exposes words on data.words
    const words = (data as unknown as { words?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number }> }).words ?? [];
    return words
      // Drop noisy low-confidence junk that pollutes downstream clustering.
      .filter((w) => (w.confidence ?? 0) >= 45 && w.text.trim().length > 0)
      .map((w, i) => ({
      id: `ocr_${i}`,
      type: 'text' as const,
      bbox: {
        x: w.bbox.x0 * scaleX,
        y: w.bbox.y0 * scaleY,
        width: (w.bbox.x1 - w.bbox.x0) * scaleX,
        height: (w.bbox.y1 - w.bbox.y0) * scaleY,
      },
      rotation: 0,
      scale: 1,
      text: w.text,
      font: {
        fontSize: (w.bbox.y1 - w.bbox.y0) * scaleY,
        fontWeight: 'normal' as const,
        italic: false,
        direction: /[\u0590-\u08FF]/.test(w.text) ? ('rtl' as const) : ('ltr' as const),
      },
      source: 'ocr' as const,
      raw: { confidence: w.confidence },
    }));
  } finally {
    await worker.terminate();
  }
}
