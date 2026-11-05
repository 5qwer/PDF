/**
 * Phases 3 → 7 of the Advanced Document Understanding Engine.
 *
 * Phase 3 — Font Analysis (page-level statistics: median size, weight
 *          distribution, dominant family, per-block features).
 * Phase 4 — Logical Structure (grouping blocks into question candidates
 *          using numbering, indentation, vertical gaps).
 * Phase 5 — Relationship Map (attaching images, tables, choices, notes
 *          to their parent question).
 * Phase 6 — Question-start detection using a weighted feature scoring
 *          engine — NOT a single rule.
 * Phase 7 — Question-end detection (next start, last choice, next big
 *          gap, image tail, page boundary with continuation).
 *
 * All decisions come from a linear combination of independent features,
 * each producing its own score. The final `confidence` is the sum,
 * normalized. This is the "features → scoring engine" approach.
 */

import type { PageAnalysis, PageElement, BoundingBox } from './types';

/** A block-level feature vector used by the scoring engine. */
export interface BlockFeatures {
  id: string;
  text: string;
  bbox: BoundingBox;
  fontSize: number;
  isBold: boolean;
  isRtl: boolean;
  gapAbove: number;         // vertical whitespace above this block (pt)
  gapBelow: number;
  indent: number;           // distance from column left (rtl: from right)
  startsWithNumber: boolean;
  numberValue?: number;
  startsWithChoiceLetter: boolean;
  choiceLetter?: string;
  /** ≥2 inline choice markers on the same line — a horizontal MCQ row */
  inlineChoiceCount: number;
  hasImageNearby: boolean;
  hasFrame: boolean;
  isPeripheral: boolean;
  fontSizeDelta: number;    // signed diff from page median font size
}

/** A detected question — a bounding region plus its constituent elements. */
export interface QuestionCandidate {
  id: string;
  index: number;             // 1-based order on the page
  number?: string;           // extracted question number if any
  bbox: BoundingBox;         // union of stem + choices + attached image
  stemBlockId: string;
  choiceBlockIds: string[];
  imageIds: string[];
  noteBlockIds: string[];
  confidence: number;        // 0..1
  reasons: string[];         // human-readable reasons (for the UI badge)
}

// ────────────────────────────────────────────────────────────────────────
// Regex catalogue — Arabic + Latin numbering & choice letters
// ────────────────────────────────────────────────────────────────────────
const AR_DIGITS = '٠-٩';
const NUM_RE = new RegExp(`^\\s*[(\\[]?\\s*([0-9${AR_DIGITS}]{1,3})\\s*[).\\-–:]`);
const AR_CHOICE_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'ه', 'و'];
const LATIN_CHOICE = ['A', 'B', 'C', 'D', 'E'];
const CHOICE_RE = new RegExp(
  // Accept "(أ)", "أ)", "أ.", "أ-", "أ:", "أ،", "A)", plus bare letter followed
  // by whitespace/text — small-font Arabic MCQs often print the letter alone
  // with no delimiter before the choice text.
  `^\\s*[(\\[]?\\s*(${[...AR_CHOICE_LETTERS, ...LATIN_CHOICE].join('|')})\\s*(?:[).\\-–:،]|\\s+\\S)`,
);
// Horizontal choices: one line containing ≥2 choice markers, e.g.
// "أ) ماء   ب) هواء   ج) نار   د) تراب"  — common in single-row MCQs.
const HORIZ_CHOICE_RE = new RegExp(
  `[(\\[\\s،]\\s*(${[...AR_CHOICE_LETTERS, ...LATIN_CHOICE].join('|')})\\s*[).\\-–:،]`,
  'g',
);
function countInlineChoices(text: string): number {
  const seen = new Set<string>();
  for (const m of text.matchAll(HORIZ_CHOICE_RE)) seen.add(m[1]);
  return seen.size;
}
const QUESTION_WORDS_RE = /(?:^|\s)(اختر|أكمل|اكمل|حدد|بيّن|بين|اشرح|اذكر|علّل|علل|قارن|استخرج|اكتب|وضّح|وضح|فسّر|فسر|حلل|ناقش|أعرب|دلل|استنتج|صحح|رتب|ما\s|كيف\s|لماذا\s|أي\s|اوجد|أوجد|احسب|برهن)(?:\s|$|[:؟?])/u;
const LOOSE_NUM_RE = new RegExp(`(?:^|\\s|[(\\[])\\s*([0-9${AR_DIGITS}]{1,3})\\s*(?:[).\\-–:،]|$)`);

function arabicToInt(s: string): number | undefined {
  const t = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

// ────────────────────────────────────────────────────────────────────────
// Phase 3 — page-level font statistics
// ────────────────────────────────────────────────────────────────────────
export interface PageFontStats {
  medianFontSize: number;
  meanFontSize: number;
  dominantFamily?: string;
  boldRatio: number;
  medianLineGap: number;
}

export function computeFontStats(analysis: PageAnalysis): PageFontStats {
  const texts = analysis.elements.filter((e) => e.type === 'text' && e.font);
  if (texts.length === 0) {
    return { medianFontSize: 10, meanFontSize: 10, boldRatio: 0, medianLineGap: 12 };
  }
  const sizes = texts.map((e) => e.font!.fontSize).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)];
  const mean = sizes.reduce((s, v) => s + v, 0) / sizes.length;
  const boldRatio = texts.filter((e) => e.font!.fontWeight === 'bold').length / texts.length;
  const familyCounts = new Map<string, number>();
  for (const e of texts) {
    const f = e.font!.fontFamily ?? e.font!.fontName ?? 'unknown';
    familyCounts.set(f, (familyCounts.get(f) ?? 0) + 1);
  }
  let dominantFamily: string | undefined;
  let best = 0;
  for (const [f, c] of familyCounts) if (c > best) { best = c; dominantFamily = f; }

  // median vertical gap between text baselines
  const ys = texts.map((e) => e.baseline ?? e.bbox.y + e.bbox.height).sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < ys.length; i++) {
    const d = ys[i] - ys[i - 1];
    if (d > 0.5 && d < 200) diffs.push(d);
  }
  diffs.sort((a, b) => a - b);
  const medianLineGap = diffs[Math.floor(diffs.length / 2)] ?? median * 1.2;

  return { medianFontSize: median, meanFontSize: mean, dominantFamily, boldRatio, medianLineGap };
}

// ────────────────────────────────────────────────────────────────────────
// Phase 3 (cont.) — per-block feature extraction
// ────────────────────────────────────────────────────────────────────────
export function extractBlockFeatures(analysis: PageAnalysis, stats: PageFontStats): BlockFeatures[] {
  const geo = analysis.geometry;
  const blocks = analysis.elements
    .filter((e) => e.type === 'text-block' && (e.text ?? '').trim())
    .sort((a, b) => a.bbox.y - b.bbox.y);
  const images = analysis.elements.filter((e) => e.type === 'image');
  const frames = analysis.elements.filter((e) => e.type === 'frame');
  const peripheralIds = new Set<string>([
    ...geo.headerIds, ...geo.footerIds, ...geo.pageNumberIds, ...geo.watermarkIds,
  ]);

  const feats: BlockFeatures[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const prev = blocks[i - 1];
    const next = blocks[i + 1];
    const text = (b.text ?? '').trim();
    const numMatch = NUM_RE.exec(text) ?? LOOSE_NUM_RE.exec(text);
    const choiceMatch = CHOICE_RE.exec(text);
    const gapAbove = prev
      ? b.bbox.y - (prev.bbox.y + prev.bbox.height)
      : b.bbox.y - geo.margins.top;
    const gapBelow = next
      ? next.bbox.y - (b.bbox.y + b.bbox.height)
      : geo.height - geo.margins.bottom - (b.bbox.y + b.bbox.height);

    const isRtl = b.font?.direction === 'rtl';
    const columnEdge = isRtl
      ? geo.width - geo.margins.right
      : geo.margins.left;
    const blockEdge = isRtl ? b.bbox.x + b.bbox.width : b.bbox.x;
    const indent = Math.abs(columnEdge - blockEdge);

    const nearImage = images.some((im) => {
      const dy = Math.min(
        Math.abs(im.bbox.y - (b.bbox.y + b.bbox.height)),
        Math.abs(b.bbox.y - (im.bbox.y + im.bbox.height)),
      );
      return dy < Math.max(30, stats.medianLineGap * 3);
    });

    const inFrame = frames.some((f) =>
      contains(f.bbox, b.bbox, 4),
    );

    feats.push({
      id: b.id,
      text,
      bbox: b.bbox,
      fontSize: b.font?.fontSize ?? stats.medianFontSize,
      isBold: b.font?.fontWeight === 'bold',
      isRtl: !!isRtl,
      gapAbove,
      gapBelow,
      indent,
      startsWithNumber: !!numMatch,
      numberValue: numMatch ? arabicToInt(numMatch[1]) : undefined,
      startsWithChoiceLetter: !!choiceMatch,
      choiceLetter: choiceMatch?.[1],
      inlineChoiceCount: countInlineChoices(text),
      hasImageNearby: nearImage,
      hasFrame: inFrame,
      isPeripheral: peripheralIds.has(b.id) || (b.childIds?.some((id) => peripheralIds.has(id)) ?? false),
      fontSizeDelta: (b.font?.fontSize ?? stats.medianFontSize) - stats.medianFontSize,
    });
  }
  return feats;
}

function contains(outer: BoundingBox, inner: BoundingBox, tol = 0): boolean {
  return (
    outer.x - tol <= inner.x &&
    outer.y - tol <= inner.y &&
    outer.x + outer.width + tol >= inner.x + inner.width &&
    outer.y + outer.height + tol >= inner.y + inner.height
  );
}

// ────────────────────────────────────────────────────────────────────────
// Phase 6 — Scoring engine for "is this the start of a question?"
// Each feature contributes an independent, tunable weight.
// ────────────────────────────────────────────────────────────────────────
interface Scored { score: number; reasons: string[]; }

function scoreQuestionStart(
  f: BlockFeatures,
  stats: PageFontStats,
  prev?: BlockFeatures,
): Scored {
  let score = 0;
  const reasons: string[] = [];

  if (f.isPeripheral) return { score: -10, reasons: ['peripheral'] };
  if (f.startsWithChoiceLetter) return { score: -5, reasons: ['choice letter'] };
  // A single line packed with multiple inline choice markers is itself an
  // answer row — never a stem. Penalise so it's not picked as a start.
  if (f.inlineChoiceCount >= 2) return { score: -5, reasons: ['inline choices'] };

  // Numbering — the strongest single signal, but never sufficient alone
  if (f.startsWithNumber) {
    score += 4;
    reasons.push('numbered');
    if (f.numberValue !== undefined && f.numberValue >= 1 && f.numberValue <= 200) {
      score += 1;
      reasons.push(`n=${f.numberValue}`);
    }
    // continuation of the previous number → strong confirmation
    if (prev?.numberValue !== undefined && f.numberValue === prev.numberValue + 1) {
      score += 2;
      reasons.push('sequence');
    }
  }

  if (QUESTION_WORDS_RE.test(f.text)) {
    score += 3;
    reasons.push('question wording');
  }

  // Vertical spacing above — new questions get more breathing room
  const gapRatio = f.gapAbove / Math.max(4, stats.medianLineGap);
  if (gapRatio > 2.2) { score += 2; reasons.push('big gap ↑'); }
  else if (gapRatio > 1.4) { score += 1; reasons.push('gap ↑'); }

  // Font-size uplift (question stems often slightly bigger or bolder)
  if (f.fontSizeDelta > stats.medianFontSize * 0.15) {
    score += 1.2; reasons.push('bigger font');
  }
  if (f.isBold && stats.boldRatio < 0.4) {
    score += 1; reasons.push('bold');
  }

  // Left/right-flushed to column edge (start of paragraph)
  if (f.indent < 6) { score += 0.5; reasons.push('flush'); }

  // Enclosed in a frame → almost certainly a question box
  if (f.hasFrame) { score += 2; reasons.push('framed'); }

  return { score, reasons };
}

// ────────────────────────────────────────────────────────────────────────
// Phase 4 + 5 + 7 — assemble candidates from starts, attach children,
// derive end boundaries, produce confidence.
// ────────────────────────────────────────────────────────────────────────
export interface DetectQuestionsOptions {
  /** Minimum score to accept a block as a question start. Default 3. */
  minStartScore?: number;
  /** Cap on number of questions per page (safety). */
  maxPerPage?: number;
}

export function detectQuestions(
  analysis: PageAnalysis,
  opts: DetectQuestionsOptions = {},
): QuestionCandidate[] {
  const minStart = opts.minStartScore ?? 3;
  const stats = computeFontStats(analysis);
  const feats = extractBlockFeatures(analysis, stats);
  const geo = analysis.geometry;
  const images = analysis.elements.filter((e) => e.type === 'image');

  const scored: Array<{ f: BlockFeatures; s: Scored }> = feats.map((f, i) => ({
    f, s: scoreQuestionStart(f, stats, feats[i - 1]),
  }));

  let startIdx = scored
    .map((x, i) => (x.s.score >= minStart ? i : -1))
    .filter((i) => i >= 0);

  // ── Choice-cluster anchoring ─────────────────────────────────────────────
  // Find runs of ≥2 consecutive blocks that start with a choice letter
  // (أ ب ج د / A B C D). Each such run is almost certainly the answer
  // list of a question — walk backward from the first choice to locate
  // the stem (nearest non-choice non-peripheral block), and add it as
  // a start even if its score alone was below `minStart`. This is the
  // "infer the question from the layout of its answers" rule.
  const choiceRuns: Array<{ start: number; end: number }> = [];
  {
    let run: { start: number; end: number } | null = null;
    for (let i = 0; i < feats.length; i++) {
      const f = feats[i];
      const isVerticalChoice = f.startsWithChoiceLetter && !f.isPeripheral;
      // A single line with multiple inline choices ("أ) … ب) … ج) …") is a
      // full horizontal answer row and counts as a complete choice cluster
      // on its own.
      const isHorizontalRow = f.inlineChoiceCount >= 2 && !f.isPeripheral;
      if (isHorizontalRow) {
        if (run && run.end - run.start >= 1) choiceRuns.push(run);
        choiceRuns.push({ start: i, end: i });
        run = null;
        continue;
      }
      if (isVerticalChoice) {
        if (!run) run = { start: i, end: i };
        else run.end = i;
      } else if (run) {
        if (run.end - run.start >= 1) choiceRuns.push(run);
        run = null;
      }
    }
    if (run && run.end - run.start >= 1) choiceRuns.push(run);
  }

  const anchored = new Set<number>(startIdx);
  for (const run of choiceRuns) {
    let stem = -1;
    for (let i = run.start - 1; i >= Math.max(0, run.start - 8); i--) {
      const f = feats[i];
      if (f.isPeripheral || f.startsWithChoiceLetter) continue;
      stem = i;
      // stop at a strong "new paragraph" signal so we don't over-swallow
      if (f.startsWithNumber || f.gapAbove > stats.medianLineGap * 1.8) break;
    }
    if (stem >= 0 && !anchored.has(stem)) {
      anchored.add(stem);
      startIdx.push(stem);
    }
  }
  startIdx = Array.from(new Set(startIdx)).sort((a, b) => a - b);

  // A page may contain a single unnumbered long-form question. Do not report
  // a misleading “0 questions” when several independent signals agree.
  if (startIdx.length === 0 && scored.length > 0) {
    const best = scored
      .map((x, i) => ({ i, score: x.s.score }))
      .filter((x) => !feats[x.i].startsWithChoiceLetter && !feats[x.i].isPeripheral)
      .sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= 1.5) startIdx = [best.i];
  }
  if (startIdx.length === 0) return [];

  const results: QuestionCandidate[] = [];
  for (let k = 0; k < startIdx.length; k++) {
    const startI = startIdx[k];
    let endI = (startIdx[k + 1] ?? feats.length) - 1;
    // Trim end to the last choice in this question's range: everything
    // after the last answer belongs to the next question or a note.
    const rangeCandidate = feats.slice(startI, endI + 1);
    let lastChoiceRel = -1;
    for (let r = rangeCandidate.length - 1; r > 0; r--) {
      const rc = rangeCandidate[r];
      if (rc.isPeripheral) continue;
      if (rc.startsWithChoiceLetter || rc.inlineChoiceCount >= 2) {
        lastChoiceRel = r;
        break;
      }
    }
    if (lastChoiceRel > 0) endI = startI + lastChoiceRel;

    const startScored = scored[startI];
    const start = startScored.f;
    const range = feats.slice(startI, endI + 1);
    const choices = range.slice(1).filter((r) => r.startsWithChoiceLetter || r.inlineChoiceCount >= 2);
    const notes = range.slice(1).filter(
      (r) => !r.startsWithChoiceLetter && r.inlineChoiceCount < 2 && r.fontSize < stats.medianFontSize * 0.85,
    );

    // Phase 5 — attach images that vertically lie within the range
    const rangeTop = start.bbox.y;
    const rangeBottom = Math.max(...range.map((r) => r.bbox.y + r.bbox.height));
    const attachedImages = images.filter((im) => {
      const cy = im.bbox.y + im.bbox.height / 2;
      return cy >= rangeTop - 4 && cy <= rangeBottom + Math.max(20, stats.medianLineGap * 2);
    });

    // Phase 7 — union bbox, snap to column edges
    const allBoxes: BoundingBox[] = [
      ...range.map((r) => r.bbox),
      ...attachedImages.map((i) => i.bbox),
    ];
    const bbox = unionBoxes(allBoxes);
    // Expand to full column width so the captured region is stable across pages
    bbox.x = geo.margins.left;
    bbox.width = geo.width - geo.margins.left - geo.margins.right;

    // Phase 8 — confidence: normalise the start score plus corroborating signals
    let conf = startScored.s.score;
    const reasons = [...startScored.s.reasons];
    if (choices.length >= 2) { conf += 2; reasons.push(`${choices.length} choices`); }
    if (attachedImages.length > 0) { conf += 0.5; reasons.push('image'); }
    if (notes.length > 0) { reasons.push('note'); }
    const confidence = Math.max(0.05, Math.min(1, conf / 10));

    results.push({
      id: `q_${geo.pageNumber}_${k + 1}`,
      index: k + 1,
      number: (NUM_RE.exec(start.text) ?? LOOSE_NUM_RE.exec(start.text))?.[1],
      bbox,
      stemBlockId: start.id,
      choiceBlockIds: choices.map((c) => c.id),
      imageIds: attachedImages.map((i) => i.id),
      noteBlockIds: notes.map((n) => n.id),
      confidence,
      reasons,
    });

    if (opts.maxPerPage && results.length >= opts.maxPerPage) break;
  }
  return results;
}

function unionBoxes(boxes: BoundingBox[]): BoundingBox {
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
