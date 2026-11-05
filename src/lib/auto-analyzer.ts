/**
 * محرك التحليل التلقائي للمستندات
 *
 * يعمل فور رفع أي PDF ويفهم بنيته دون أي تدريب يدوي:
 *  - يكتشف حدود الأسئلة تلقائياً
 *  - يتعرّف على الاختيارات والجذور والهوامش
 *  - يحسب متوسط ارتفاع السؤال والفجوة بينها
 *  - يحفظ النتيجة كبيانات تدريب جاهزة للاستخدام الفوري
 */

import type { PDFPageProxy } from 'pdfjs-dist';
import { db } from './db';

// ── أنماط الاكتشاف ────────────────────────────────────────────────────────────

/** رقم سؤال: يبدأ برقم عربي أو هندي متبوع بفاصل */
const Q_NUM_RE = /^[\s]*([١٢٣٤٥٦٧٨٩٠\d]+)[\s.)،:–\-]/;

/** اختيار: حرف عربي أو رقم متبوع بفاصل */
const CHOICE_RE = /^([أابتثجحخدذرزسشصضطظعغفقكلمنهوي])(?:[\s).\-:،)]+)|^\(([أابتثجحخدذرزسشصضطظعغفقكلمنهوي])\)/u;

/** أفعال السؤال الشائعة */
const Q_VERBS_RE = /^(حدد|بيّن|بين|اشرح|اذكر|علّل|علل|قارن|استخرج|اكتب|وضّح|وضح|فسّر|فسر|حلل|ناقش|أعرب|دلل|استنتج|ما|كيف|لماذا|هات|أكمل|صحح|رتب|اختر|ميّز|ميز|علاقة)\b/u;

// ─────────────────────────────────────────────────────────────────────────────

interface TextLine {
  text: string;
  yPct: number;   // موضع Y كنسبة من ارتفاع الصفحة
  xPct: number;   // موضع X كنسبة من عرض الصفحة
  fontSize: number;
  isBold: boolean;
  isRtl: boolean;
}

interface PageResult {
  questionYPcts: number[];  // مواضع بداية الأسئلة
  spacings: number[];       // المسافات بين الأسئلة
  hasChoices: boolean;
  columns: 1 | 2;
}

/** تحليل صفحة واحدة */
async function analyzeOnePage(page: PDFPageProxy): Promise<PageResult | null> {
  const viewport = page.getViewport({ scale: 1 });
  const W = viewport.width;
  const H = viewport.height;

  let tc: any;
  try {
    tc = await page.getTextContent({ includeMarkedContent: false } as any);
  } catch {
    return null;
  }

  // ── استخراج العناصر مع مواقعها ────────────────────────────────────────────
  const rawItems: Array<{
    str: string;
    y: number;
    x: number;
    fontSize: number;
    isBold: boolean;
    isRtl: boolean;
  }> = [];

  for (const item of (tc.items as any[])) {
    const s = item.str?.trim();
    if (!s) continue;
    const [, , , sy, tx, ty] = item.transform as number[];
    const ix = tx;
    const iy = H - ty;
    const fontSize = Math.abs(sy);
    const fontName = (item.fontName ?? '') as string;
    const isBold = /bold|heavy|black|700|800|900/i.test(fontName);
    const isRtl = /[\u0600-\u06FF]/.test(s);
    rawItems.push({ str: s, y: iy, x: ix, fontSize, isBold, isRtl });
  }

  if (rawItems.length < 5) return null;

  // ── تجميع في أسطر (عناصر متقاربة في Y) ──────────────────────────────────
  const LINE_THRESH = H * 0.02;
  rawItems.sort((a, b) => a.y - b.y);

  const lines: TextLine[] = [];
  let currentGroup: typeof rawItems = [];
  let groupY = rawItems[0]?.y ?? 0;

  for (const item of rawItems) {
    if (currentGroup.length > 0 && Math.abs(item.y - groupY) > LINE_THRESH) {
      const text = currentGroup.map(i => i.str).join(' ').trim();
      const avgX = currentGroup.reduce((s, i) => s + i.x, 0) / currentGroup.length;
      const maxFs = Math.max(...currentGroup.map(i => i.fontSize));
      const hasBold = currentGroup.some(i => i.isBold);
      const hasRtl = currentGroup.some(i => i.isRtl);
      if (text) {
        lines.push({
          text,
          yPct: (groupY / H) * 100,
          xPct: (avgX / W) * 100,
          fontSize: maxFs,
          isBold: hasBold,
          isRtl: hasRtl,
        });
      }
      currentGroup = [];
      groupY = item.y;
    }
    currentGroup.push(item);
    if (currentGroup.length === 1) groupY = item.y;
  }
  // آخر مجموعة
  if (currentGroup.length > 0) {
    const text = currentGroup.map(i => i.str).join(' ').trim();
    if (text) {
      const avgX = currentGroup.reduce((s, i) => s + i.x, 0) / currentGroup.length;
      lines.push({
        text,
        yPct: (groupY / H) * 100,
        xPct: (avgX / W) * 100,
        fontSize: Math.max(...currentGroup.map(i => i.fontSize)),
        isBold: currentGroup.some(i => i.isBold),
        isRtl: currentGroup.some(i => i.isRtl),
      });
    }
  }

  if (lines.length < 3) return null;

  // ── اكتشاف بدايات الأسئلة ────────────────────────────────────────────────
  const questionYPcts: number[] = [];
  let hasChoices = false;

  // استراتيجية 1: أسطر تبدأ برقم قصيرة
  for (const line of lines) {
    const t = line.text;
    if (Q_NUM_RE.test(t) && t.length < 40) {
      questionYPcts.push(line.yPct);
    }
    if (CHOICE_RE.test(t)) {
      hasChoices = true;
    }
  }

  // استراتيجية 2: إذا لم نجد أرقاماً، نبحث عن أفعال الأسئلة
  if (questionYPcts.length < 2) {
    questionYPcts.length = 0;
    for (const line of lines) {
      if ((Q_VERBS_RE.test(line.text) || line.isBold) && line.fontSize > 8) {
        questionYPcts.push(line.yPct);
      }
    }
  }

  // استراتيجية 3: اكتشاف الأسطر بخط أكبر من المتوسط
  if (questionYPcts.length < 2) {
    const allFs = lines.map(l => l.fontSize);
    const medianFs = allFs.sort((a, b) => a - b)[Math.floor(allFs.length / 2)];
    questionYPcts.length = 0;
    for (const line of lines) {
      if (line.fontSize >= medianFs * 1.1 && line.yPct < 95) {
        questionYPcts.push(line.yPct);
      }
    }
  }

  if (questionYPcts.length < 2) return null;

  // ── حساب المسافات بين الأسئلة ────────────────────────────────────────────
  const sorted = [...questionYPcts].sort((a, b) => a - b);
  const spacings: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > 1 && gap < 60) spacings.push(gap);
  }

  // ── اكتشاف الأعمدة ───────────────────────────────────────────────────────
  const leftCount = lines.filter(l => l.xPct < 40).length;
  const rightCount = lines.filter(l => l.xPct > 60).length;
  const columns: 1 | 2 =
    leftCount > lines.length * 0.2 && rightCount > lines.length * 0.2 ? 2 : 1;

  return { questionYPcts: sorted, spacings, hasChoices, columns };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * يحلل مستنداً كاملاً ويحفظ بيانات التدريب تلقائياً.
 * يُستدعى في الخلفية بعد رفع الملف مباشرةً.
 */
export async function analyzeDocument(docId: number): Promise<boolean> {
  const doc = await db.documents.get(docId);
  if (!doc) return false;
  if ((doc as any).fileType === 'image') return false;
  const hasExistingTraining = !!(doc.training?.samples && doc.training.samples.length > 0);

  try {
    const { ensurePdfWorker, pdfjsLib } = await import('./analyzer/pdfjs');
    const { analyzePdfPage, detectQuestions } = await import('./analyzer');
    ensurePdfWorker();
    const pdf = await pdfjsLib.getDocument({ data: doc.fileData.slice(0) }).promise;
    const pagesToAnalyze = Math.min(pdf.numPages, 8);

    const results: PageResult[] = [];

    const intelligentQuestions: Array<{ h: number; gap: number; confidence: number }> = [];
    let fontSizeTotal = 0;
    let fontSizeCount = 0;
    let maxColumns = 1;
    for (let p = 1; p <= pagesToAnalyze; p++) {
      const page = await pdf.getPage(p);
      const result = await analyzeOnePage(page);
      if (result) results.push(result);
      try {
        const analysis = await analyzePdfPage(pdf, p);
        const candidates = detectQuestions(analysis, { minStartScore: 2.2 });
        maxColumns = Math.max(maxColumns, analysis.geometry.columnCount);
        const textEls = analysis.elements.filter(e => e.type === 'text' && e.font);
        fontSizeTotal += textEls.reduce((sum, e) => sum + (e.font?.fontSize ?? 0), 0);
        fontSizeCount += textEls.length;
        candidates.forEach((q, i) => {
          const next = candidates[i + 1];
          intelligentQuestions.push({
            h: q.bbox.height / analysis.geometry.height * 100,
            gap: next ? Math.max(0, (next.bbox.y - q.bbox.y - q.bbox.height) / analysis.geometry.height * 100) : 0,
            confidence: q.confidence,
          });
        });
      } catch { /* legacy training can still succeed */ }
    }

    if (intelligentQuestions.length > 0) {
      const hs = intelligentQuestions.map(q => q.h).sort((a, b) => a - b);
      const gs = intelligentQuestions.map(q => q.gap).filter(Boolean).sort((a, b) => a - b);
      await db.documents.update(docId, {
        analysisProfile: {
          version: 1,
          analyzedAt: Date.now(),
          medianFontSize: fontSizeCount ? fontSizeTotal / fontSizeCount : undefined,
          medianQuestionHeightPct: hs[Math.floor(hs.length / 2)],
          medianGapPct: gs[Math.floor(gs.length / 2)] ?? 0,
          columns: maxColumns,
          detectedQuestionCount: intelligentQuestions.length,
          confidence: intelligentQuestions.reduce((s, q) => s + q.confidence, 0) / intelligentQuestions.length,
        },
      });
    }

    if (results.length === 0) return intelligentQuestions.length > 0;

    // ── تجميع النتائج من كل الصفحات ────────────────────────────────────────
    const allSpacings = results.flatMap(r => r.spacings);
    if (allSpacings.length === 0) return intelligentQuestions.length > 0;

    // استبعاد الشاذّ (أكبر من 2.5 × الوسيط)
    const sorted = [...allSpacings].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const valid = sorted.filter(s => s > 0.5 && s < median * 2.5);

    if (valid.length === 0) return false;

    const avgSpacing = valid.reduce((s, v) => s + v, 0) / valid.length;
    // ارتفاع السؤال ≈ 82٪ من المسافة الكلية (الباقي فجوة)
    const questionH = avgSpacing * 0.82;
    const questionGap = avgSpacing * 0.18;

    // ── جمع عينات التدريب من الأسئلة المكتشفة ──────────────────────────────
    const allStarts = results.flatMap(r => r.questionYPcts);
    // أول 8 عينات فقط كمرجع
    const samples = allStarts.slice(0, 8).map(y => ({
      yPct: y,
      hPct: questionH,
    }));

    if (!hasExistingTraining) {
      await db.documents.update(docId, {
        training: {
          questionHeightPct: Math.max(3, questionH),
          questionGapPct: Math.max(0.5, questionGap),
          samples,
        },
      });
    }

    return true;
  } catch {
    // التحليل الأوتوماتيكي لا يوقف العمل عند الفشل
    return false;
  }
}
