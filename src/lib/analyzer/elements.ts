/**
 * Phase 2: Element Analysis — cluster raw text spans into logical text-blocks,
 * derive per-element padding/margins, and build a shallow Layout Tree.
 */

import type { PageElement, PageGeometry, BoundingBox } from './types';

/** Merge overlapping / adjacent text spans on the same line into blocks. */
export function clusterTextBlocks(
  elements: PageElement[],
  geometry: PageGeometry,
): PageElement[] {
  const result: PageElement[] = [...elements];
  const texts = elements
    .filter((e) => e.type === 'text' && e.text?.trim())
    .sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);

  if (texts.length === 0) return result;

  // Group into lines by y-proximity (baseline)
  const avgFont =
    texts.reduce((s, e) => s + (e.font?.fontSize ?? 10), 0) / texts.length;
  const lineTol = avgFont * 0.6;

  interface Line {
    y: number;
    items: PageElement[];
  }
  const lines: Line[] = [];
  for (const el of texts) {
    const y = el.baseline ?? el.bbox.y + el.bbox.height;
    const line = lines.find((l) => Math.abs(l.y - y) <= lineTol);
    if (line) line.items.push(el);
    else lines.push({ y, items: [el] });
  }

  // Keep one logical block per visual line. Merging neighbouring lines into a
  // paragraph erased question boundaries on tightly-set Arabic worksheets.
  const sortedLines = lines.sort((a, b) => a.y - b.y);
  let idc = 0;
  for (const line of sortedLines) {
    const rtlCount = line.items.filter((i) => i.font?.direction === 'rtl').length;
    const isRtl = rtlCount >= line.items.length / 2;
    const items = [...line.items].sort((a, b) =>
      isRtl ? b.bbox.x - a.bbox.x : a.bbox.x - b.bbox.x,
    );
    const bbox = unionBBox(items.map((i) => i.bbox));
    const dominantFont = pickDominantFont(items);
    const blockId = `blk_${geometry.pageNumber}_${idc++}`;
    result.push({
      id: blockId,
      type: 'text-block',
      bbox,
      rotation: 0,
      scale: 1,
      text: items
        .map((i) => i.text ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
      font: dominantFont,
      childIds: items.map((i) => i.id),
      source: 'derived',
    });
    for (const it of items) it.parentId = blockId;
  }

  return result;
}

function unionBBox(boxes: BoundingBox[]): BoundingBox {
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function pickDominantFont(items: PageElement[]) {
  if (items.length === 0) return undefined;
  const counts = new Map<string, { count: number; sample: PageElement['font'] }>();
  for (const it of items) {
    if (!it.font) continue;
    const key = `${it.font.fontFamily}|${it.font.fontSize.toFixed(1)}|${it.font.fontWeight}`;
    const prev = counts.get(key);
    if (prev) prev.count += 1;
    else counts.set(key, { count: 1, sample: it.font });
  }
  let best: { count: number; sample: PageElement['font'] } | undefined;
  for (const v of counts.values()) if (!best || v.count > best.count) best = v;
  return best?.sample;
}

/** Reading order (RTL-aware): top→bottom, then within same line right→left for RTL */
export function computeReadingOrder(
  elements: PageElement[],
  isRtl = true,
): string[] {
  const blocks = elements.filter((e) => e.type === 'text-block' || e.type === 'image');
  const sorted = [...blocks].sort((a, b) => {
    const dy = a.bbox.y - b.bbox.y;
    if (Math.abs(dy) > 8) return dy;
    return isRtl ? b.bbox.x - a.bbox.x : a.bbox.x - b.bbox.x;
  });
  return sorted.map((e) => e.id);
}
