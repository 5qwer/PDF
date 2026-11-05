import type { BoundingBox, PageGeometry } from './types';

/**
 * Offline visual fallback for scanned/image-only pages. It measures ink
 * density row-by-row and cuts at unusually large white bands. It never
 * rewrites or OCR-renders the page; it only returns geometric regions.
 */
export function segmentPageByInk(
  canvas: HTMLCanvasElement,
  geometry: PageGeometry,
): BoundingBox[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width < 2 || canvas.height < 2) return [];
  const sampleW = Math.min(900, canvas.width);
  const sampleH = Math.max(1, Math.round(canvas.height * (sampleW / canvas.width)));
  const sample = document.createElement('canvas');
  sample.width = sampleW;
  sample.height = sampleH;
  const sctx = sample.getContext('2d', { willReadFrequently: true });
  if (!sctx) return [];
  sctx.drawImage(canvas, 0, 0, sampleW, sampleH);
  const data = sctx.getImageData(0, 0, sampleW, sampleH).data;
  const density = new Float32Array(sampleH);
  for (let y = 0; y < sampleH; y++) {
    let ink = 0;
    for (let x = 0; x < sampleW; x += 2) {
      const i = (y * sampleW + x) * 4;
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (data[i + 3] > 24 && lum < 225) ink++;
    }
    density[y] = ink / Math.ceil(sampleW / 2);
  }
  const active = Array.from(density, (v) => v > 0.006);
  const runs: Array<{ start: number; end: number }> = [];
  let start = -1;
  for (let y = 0; y <= sampleH; y++) {
    if (y < sampleH && active[y] && start < 0) start = y;
    if ((y === sampleH || !active[y]) && start >= 0) {
      if (y - start >= 2) runs.push({ start, end: y });
      start = -1;
    }
  }
  if (runs.length === 0) return [];
  const gaps = runs.slice(1).map((r, i) => r.start - runs[i].end).filter((g) => g > 0);
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)] ?? 4;
  const splitGap = Math.max(12, medianGap * 2.4, sampleH * 0.018);
  const groups: Array<{ start: number; end: number }> = [];
  let group = { ...runs[0] };
  for (let i = 1; i < runs.length; i++) {
    const gap = runs[i].start - group.end;
    if (gap >= splitGap && group.end - group.start >= sampleH * 0.025) {
      groups.push(group);
      group = { ...runs[i] };
    } else {
      group.end = runs[i].end;
    }
  }
  groups.push(group);
  const contentX = Math.max(0, geometry.margins.left);
  const contentW = Math.max(1, geometry.width - geometry.margins.left - geometry.margins.right);
  return groups
    .filter((g) => g.end - g.start >= sampleH * 0.025)
    .map((g) => ({
      x: contentX,
      y: Math.max(0, (g.start / sampleH) * geometry.height - 4),
      width: contentW,
      height: Math.min(geometry.height, ((g.end - g.start) / sampleH) * geometry.height + 8),
    }));
}