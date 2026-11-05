import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is set exactly once
let workerConfigured = false;
export function ensurePdfWorker() {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  workerConfigured = true;
}

export { pdfjsLib };
