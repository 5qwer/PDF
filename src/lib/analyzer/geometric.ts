/**
 * Phase 1: Geometric Model Builder
 *
 * Analyzes a PDF page as a visual entity: page dimensions, orientation,
 * margins, columns, whitespace gaps, and rough region detection —
 * BEFORE any semantic interpretation of the text.
 */

import type {
  PageGeometry,
  PageMargins,
  PageElement,
  WhitespaceGap,
  ColumnInfo,
} from './types';

const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

interface RawTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
  dir?: string;
}

interface OperatorItem {
  fn: number;
  args: unknown[];
}

/** Build the geometric model of a page from pdf.js data. */
export async function buildPageGeometry(
  page: import('pdfjs-dist').PDFPageProxy,
  pageNumber: number,
): Promise<{ geometry: PageGeometry; elements: PageElement[] }> {
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;
  const rotation = viewport.rotation;
  const orientation: 'portrait' | 'landscape' =
    pageWidth >= pageHeight ? 'landscape' : 'portrait';

  const elements: PageElement[] = [];
  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}_${pageNumber}_${idCounter++}`;

  // ── Extract text items with per-item bounding boxes ─────────────────────
  let textContent: { items: RawTextItem[] } | null = null;
  try {
    textContent = (await page.getTextContent({
      includeMarkedContent: false,
      // @ts-expect-error - runtime option
      disableCombineTextItems: true,
    })) as unknown as { items: RawTextItem[] };
  } catch {
    textContent = null;
  }

  const textItems = textContent?.items ?? [];
  for (const it of textItems) {
    if (!it.str || !it.str.trim()) continue;
    // PDF.js transform: [a, b, c, d, e, f] — [e,f] is origin in PDF space (bottom-left)
    const [a, b, , d, e, f] = it.transform;
    const fontSize = Math.hypot(a, b) || Math.abs(d) || 10;
    // Convert to top-left origin
    const x = e;
    const y = pageHeight - f - it.height;
    const width = it.width || fontSize * it.str.length * 0.5;
    const height = it.height || fontSize;
    const isRtl = RTL_RE.test(it.str);
    const isBold = /bold|black|heavy/i.test(it.fontName ?? '');
    const italic = /italic|oblique/i.test(it.fontName ?? '');
    elements.push({
      id: nextId('t'),
      type: 'text',
      bbox: { x, y, width, height },
      rotation: (Math.atan2(b, a) * 180) / Math.PI,
      scale: 1,
      baseline: pageHeight - f,
      text: it.str,
      font: {
        fontName: it.fontName,
        fontFamily: guessFontFamily(it.fontName),
        fontSize,
        fontWeight: isBold ? 'bold' : 'normal',
        italic,
        direction: isRtl ? 'rtl' : 'ltr',
      },
      source: 'pdf',
      raw: it,
    });
  }

  // ── Extract images and drawings from operator list ─────────────────────
  try {
    const opList = await page.getOperatorList();
    // pdf.js op codes we care about — pull dynamically so bundle stays small
    const OPS = (await import('pdfjs-dist')).OPS;
    const commonObjs = page.commonObjs;
    const objs = page.objs;
    const ctm: number[][] = [[1, 0, 0, 1, 0, 0]];
    const stack: number[][] = [];
    const current = () => ctm[ctm.length - 1];

    const applyTransform = (m: number[]) => {
      const c = current();
      const [a1, b1, c1, d1, e1, f1] = c;
      const [a2, b2, c2, d2, e2, f2] = m;
      ctm[ctm.length - 1] = [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
      ];
    };

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i] as unknown[];
      if (fn === OPS.save) {
        stack.push([...current()]);
        ctm.push([...current()]);
      } else if (fn === OPS.restore) {
        ctm.pop();
        if (ctm.length === 0) ctm.push(stack.pop() ?? [1, 0, 0, 1, 0, 0]);
      } else if (fn === OPS.transform) {
        applyTransform(args as number[]);
      } else if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
        const [a, b, c, d, e, f] = current();
        // The image occupies unit square (0,0)-(1,1) mapped via CTM
        const corners = [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ].map(([px, py]) => [a * px + c * py + e, b * px + d * py + f]);
        const xs = corners.map((p) => p[0]);
        const ys = corners.map((p) => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        elements.push({
          id: nextId('img'),
          type: 'image',
          bbox: {
            x: minX,
            y: pageHeight - maxY,
            width: maxX - minX,
            height: maxY - minY,
          },
          rotation: (Math.atan2(b, a) * 180) / Math.PI,
          scale: 1,
          source: 'pdf',
          raw: { name: args?.[0] },
        });
      } else if (fn === OPS.rectangle) {
        const [x, y, w, h] = args as number[];
        // We record only meaningfully sized rectangles as frames/lines
        if (Math.abs(w) < 0.5 || Math.abs(h) < 0.5) continue;
        const [ca, cb, , cd, ce, cf] = current();
        const tx = ca * x + ce;
        const ty = cb * x + cd * y + cf;
        const tw = ca * w;
        const th = cd * h;
        const absW = Math.abs(tw);
        const absH = Math.abs(th);
        const isLine = absW < 3 || absH < 3;
        elements.push({
          id: nextId(isLine ? 'ln' : 'rect'),
          type: isLine ? 'line' : 'frame',
          bbox: {
            x: Math.min(tx, tx + tw),
            y: pageHeight - Math.max(ty, ty + th),
            width: absW,
            height: absH,
          },
          rotation: 0,
          scale: 1,
          source: 'pdf',
        });
      }
    }
    void commonObjs;
    void objs;
  } catch {
    // ignore operator-list failures — geometry from text/images is still valuable
  }

  // ── Compute margins from element extents ────────────────────────────────
  const margins = computeMargins(elements, pageWidth, pageHeight);

  // ── Detect columns via vertical whitespace analysis ─────────────────────
  const columns = detectColumns(elements, pageWidth, margins);

  // ── Whitespace gaps (horizontal bands used for section segmentation) ───
  const whitespace = detectHorizontalGaps(elements, pageHeight, margins);

  // ── Header / footer / page-number / watermark heuristics ───────────────
  const { headerIds, footerIds, pageNumberIds, watermarkIds } = detectPagePeripherals(
    elements,
    pageWidth,
    pageHeight,
    margins,
  );

  const isScanned =
    textItems.length === 0 &&
    elements.filter((e) => e.type === 'image').length >= 1;

  const geometry: PageGeometry = {
    pageNumber,
    width: pageWidth,
    height: pageHeight,
    rotation,
    orientation,
    margins,
    columnCount: columns.length,
    columns,
    whitespace,
    headerIds,
    footerIds,
    pageNumberIds,
    watermarkIds,
    isScanned,
  };

  return { geometry, elements };
}

function guessFontFamily(fontName?: string): string | undefined {
  if (!fontName) return undefined;
  const clean = fontName.replace(/^[A-Z]{6}\+/, ''); // strip subset prefix
  return clean.split(/[,\-_]/)[0];
}

function computeMargins(
  elements: PageElement[],
  pageW: number,
  pageH: number,
): PageMargins {
  const text = elements.filter((e) => e.type === 'text');
  if (text.length === 0) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const minX = Math.min(...text.map((e) => e.bbox.x));
  const maxX = Math.max(...text.map((e) => e.bbox.x + e.bbox.width));
  const minY = Math.min(...text.map((e) => e.bbox.y));
  const maxY = Math.max(...text.map((e) => e.bbox.y + e.bbox.height));
  return {
    left: Math.max(0, minX),
    right: Math.max(0, pageW - maxX),
    top: Math.max(0, minY),
    bottom: Math.max(0, pageH - maxY),
  };
}

function detectColumns(
  elements: PageElement[],
  pageW: number,
  margins: PageMargins,
): ColumnInfo[] {
  const text = elements.filter((e) => e.type === 'text' && e.text?.trim());
  if (text.length < 8) {
    // Single column by default
    return [
      {
        index: 0,
        x: margins.left,
        width: Math.max(1, pageW - margins.left - margins.right),
        elementIds: text.map((e) => e.id),
      },
    ];
  }

  const usableW = pageW - margins.left - margins.right;
  const bins = 40;
  const counts = new Array(bins).fill(0);
  for (const el of text) {
    const cx = el.bbox.x + el.bbox.width / 2;
    const rel = (cx - margins.left) / usableW;
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(rel * bins)));
    counts[idx] += 1;
  }
  // Look for a valley in the middle 40-60% region
  const mid = Math.floor(bins / 2);
  const window = 6;
  let valleyMin = Infinity;
  let valleyIdx = mid;
  for (let i = mid - window; i <= mid + window; i++) {
    if (counts[i] < valleyMin) {
      valleyMin = counts[i];
      valleyIdx = i;
    }
  }
  const avg = counts.reduce((s, v) => s + v, 0) / bins;
  const isTwoCol = valleyMin < avg * 0.25;

  if (!isTwoCol) {
    return [
      {
        index: 0,
        x: margins.left,
        width: usableW,
        elementIds: text.map((e) => e.id),
      },
    ];
  }

  const splitX = margins.left + (valleyIdx / bins) * usableW;
  const left: string[] = [];
  const right: string[] = [];
  for (const el of text) {
    const cx = el.bbox.x + el.bbox.width / 2;
    if (cx < splitX) left.push(el.id);
    else right.push(el.id);
  }
  return [
    {
      index: 0,
      x: margins.left,
      width: splitX - margins.left,
      elementIds: left,
    },
    {
      index: 1,
      x: splitX,
      width: pageW - margins.right - splitX,
      elementIds: right,
    },
  ];
}

function detectHorizontalGaps(
  elements: PageElement[],
  pageH: number,
  margins: PageMargins,
): WhitespaceGap[] {
  const text = elements
    .filter((e) => e.type === 'text')
    .map((e) => ({ start: e.bbox.y, end: e.bbox.y + e.bbox.height }))
    .sort((a, b) => a.start - b.start);
  if (text.length < 3) return [];
  const gaps: WhitespaceGap[] = [];
  let cursor = margins.top;
  for (const t of text) {
    if (t.start > cursor + 6) {
      gaps.push({ axis: 'h', start: cursor, end: t.start, size: t.start - cursor });
    }
    cursor = Math.max(cursor, t.end);
  }
  if (pageH - margins.bottom - cursor > 6) {
    gaps.push({
      axis: 'h',
      start: cursor,
      end: pageH - margins.bottom,
      size: pageH - margins.bottom - cursor,
    });
  }
  const avg = gaps.reduce((s, g) => s + g.size, 0) / Math.max(1, gaps.length);
  // Keep only "significant" gaps larger than 1.6× average line gap
  return gaps.filter((g) => g.size > Math.max(10, avg * 1.6));
}

function detectPagePeripherals(
  elements: PageElement[],
  pageW: number,
  pageH: number,
  margins: PageMargins,
) {
  const headerZone = margins.top * 0.9;
  const footerZone = pageH - margins.bottom * 0.9;
  const headerIds: string[] = [];
  const footerIds: string[] = [];
  const pageNumberIds: string[] = [];
  const watermarkIds: string[] = [];

  for (const el of elements) {
    if (el.type !== 'text') continue;
    const cy = el.bbox.y + el.bbox.height / 2;
    if (cy < headerZone) headerIds.push(el.id);
    else if (cy > footerZone) {
      footerIds.push(el.id);
      const t = (el.text ?? '').trim();
      if (/^[\d\u0660-\u0669IVX]+$/.test(t) && t.length < 6) pageNumberIds.push(el.id);
    }
    // Watermark heuristic: large text near center with rotation
    const cx = el.bbox.x + el.bbox.width / 2;
    const centered = Math.abs(cx - pageW / 2) < pageW * 0.15;
    const midY = Math.abs(cy - pageH / 2) < pageH * 0.25;
    const rotated = Math.abs(el.rotation) > 10;
    if (centered && midY && (rotated || (el.font && el.font.fontSize > 40))) {
      watermarkIds.push(el.id);
    }
  }
  return { headerIds, footerIds, pageNumberIds, watermarkIds };
}
