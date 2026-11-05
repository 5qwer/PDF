/**
 * PdfViewer — عارض PDF مع نظام التدريب والكشف التلقائي
 *
 * الأوضاع:
 *   training  — ارسم مربعين لتدريب التطبيق على حجم الأسئلة
 *   detecting — كشف تلقائي + إمكانية رسم مربعات يدوية إضافية
 *
 * عند النقر على أي مربع تظهر قائمة مركزية:
 *   📐 تخطيط  — يستخرج التخطيط الكامل (مواقع + خطوط + تنسيق) — الوضع الجديد
 *   📷 صورة   — يقطع المنطقة كـ JPEG (للملفات الممسوحة)
 *   📝 نص     — يستخرج النص المسطح (قديم)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LocalQuestion, LocalDocument, LocalProject, QuestionLayout, LayoutLine, LayoutTextItem } from '@/lib/db';
import { Button } from '@/components/ui/button';
// Select removed — replaced by custom DocPickerModal
import { useToast } from '@/hooks/use-toast';
import {
  ChevronRight, ChevronLeft, Brain, Zap, Trash2,
  CheckCircle2, Loader2, Info, GripHorizontal, BookMarked,
  Image as ImageIcon, Type, X, PlusCircle, LayoutTemplate,
  Search, Tag, FileBox, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PageGeometry } from '@/lib/analyzer';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// ─── Module-level PDF cache — for instant doc switching ────────────────────────
const pdfDocCache = new Map<number, pdfjsLib.PDFDocumentProxy>();

type Mode = 'idle' | 'training' | 'detecting' | 'manual';
interface Box { x: number; y: number; w: number; h: number; }
interface DetectedBox extends Box { index: number; captured?: boolean; confidence?: number; }
interface CaptureTarget { box: Box | DetectedBox; }

// ─── Layout Extractor ─────────────────────────────────────────────────────────

/**
 * يستخرج عناصر النص مع مواقعها وأنماط خطوطها من PDF.js
 * ثم يُصنّف كل سطر ويُعيد بنية QuestionLayout
 */
async function extractLayout(
  page: pdfjsLib.PDFPageProxy,
  box: Box,
  scale: number,
  viewportH: number,
  canvasW: number,
  canvasH: number,
): Promise<QuestionLayout | null> {
  const left   = box.x / 100 * canvasW;
  const top    = box.y / 100 * canvasH;
  const right  = (box.x + box.w) / 100 * canvasW;
  const bottom = (box.y + box.h) / 100 * canvasH;
  const margin = 6;

  let tc: any;
  try { tc = await page.getTextContent({ includeMarkedContent: false } as any); }
  catch { return null; }

  // ── تجميع العناصر داخل المنطقة ────────────────────────────────────────────
  const items: LayoutTextItem[] = [];
  const fontSizeMap: Record<number, number> = {};

  for (const item of (tc.items as any[])) {
    if (!item.str?.trim()) continue;

    // transform = [scaleX, skewX, skewY, scaleY, tx, ty]
    const [sx, , , sy, tx, ty] = item.transform as number[];
    const ix = tx * scale;
    const iy = viewportH - ty * scale;  // PDF y يُقلب (أسفل→أعلى)

    if (ix < left - margin || ix > right + margin) continue;
    if (iy < top - margin  || iy > bottom + margin) continue;

    // حجم الخط ≈ |sy * scale| (المقياس الرأسي في المصفوفة)
    const rawFontSize = Math.abs(sy * scale);

    const xPct = ((ix - left) / (right - left)) * 100;
    const yPct = ((iy - top)  / (bottom - top)) * 100;
    const wPct = item.width ? (item.width * scale / (right - left)) * 100 : undefined;

    // تحديد سُمك الخط من اسم الخط الداخلي
    const fontName = (item.fontName ?? '') as string;
    const isBold = /bold|heavy|black|700|800|900/i.test(fontName);

    const fsPt = Math.round(rawFontSize * 0.75 * 10) / 10; // px → pt تقريبي

    fontSizeMap[Math.round(fsPt)] = (fontSizeMap[Math.round(fsPt)] ?? 0) + 1;

    items.push({
      str: item.str,
      xPct: Math.max(-5, Math.min(105, xPct)),
      yPct: Math.max(-5, Math.min(105, yPct)),
      fontSize: fsPt,
      fontWeight: isBold ? 'bold' : 'normal',
      fontFamily: undefined,
      dir: item.dir === 'ltr' ? 'ltr' : 'rtl',
      widthPct: wPct,
    });
  }

  if (items.length === 0) return null;

  // ── الخط الأساسي (الأكثر تكراراً) ─────────────────────────────────────────
  const baseFontSize = Object.entries(fontSizeMap)
    .sort(([, a], [, b]) => b - a)[0][0];
  const baseFs = parseFloat(baseFontSize);

  // ── تجميع العناصر في أسطر (عناصر قريبة y تنتمي لنفس السطر) ───────────────
  const sortedItems = [...items].sort((a, b) => a.yPct - b.yPct);
  const lineGroups: LayoutTextItem[][] = [];
  const LINE_THRESHOLD = 2.5; // % — العناصر أقل من 2.5% تجمّع في نفس السطر

  for (const it of sortedItems) {
    const last = lineGroups[lineGroups.length - 1];
    if (!last || Math.abs(it.yPct - last[0].yPct) > LINE_THRESHOLD) {
      lineGroups.push([it]);
    } else {
      last.push(it);
    }
  }

  // ── بناء LayoutLine لكل مجموعة ────────────────────────────────────────────
  const lines: LayoutLine[] = [];
  const originalPixelW = (right - left);
  const originalPixelH = (bottom - top);

  for (let gi = 0; gi < lineGroups.length; gi++) {
    const grp = lineGroups[gi];
    const nextGrp = lineGroups[gi + 1];

    // ترتيب RTL: من اليمين لليسار (xPct كبير → صغير)
    grp.sort((a, b) => b.xPct - a.xPct);

    const text = grp.map(i => i.str).join(' ').trim();
    const yPct = grp[0].yPct;
    const heightPct = nextGrp
      ? Math.max(2, nextGrp[0].yPct - yPct)
      : Math.max(2, 100 - yPct);
    const dominantFont = grp.reduce((acc, i) => i.fontSize > acc ? i.fontSize : acc, 0) || baseFs;
    const isBold = grp.some(i => i.fontWeight === 'bold');

    const line: LayoutLine = {
      type: 'text',
      yPct,
      heightPct,
      fontSize: dominantFont,
      fontWeight: isBold ? 'bold' : 'normal',
      text,
      rawItems: grp,
    };

    // ── تصنيف نوع السطر ─────────────────────────────────────────────────────

    // رقم السؤال: سطر قصير يبدأ برقم
    if (/^[١٢٣٤٥٦٧٨٩٠\d]+[\s.)،:–\-]/.test(text) && text.length < 20 && gi === 0) {
      const numMatch = text.match(/^([١٢٣٤٥٦٧٨٩٠\d]+)/);
      line.type = 'question-number';
      line.number = numMatch?.[1] ?? '1';
      lines.push(line);
      continue;
    }

    // بيت شعري: يحتوي *** أو ثلاث نجوم
    if (/\*{3}|\*\s*\*\s*\*/.test(text)) {
      const parts = text.split(/\s*\*{3}\s*|\s*\*\s*\*\s*\*\s*/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        line.type = 'poem-verse';
        line.sadr = parts[0];
        line.ajuz = parts[1];
        lines.push(line);
        continue;
      }
    }

    // عنوان القصيدة
    if (/^(قال|شعر|للشاعر|من شعر)\s+/u.test(text)) {
      line.type = 'poem-header';
      lines.push(line);
      continue;
    }

    // هامش / مصطلحات
    if (text.includes(':') && text.length < 60 &&
      /[\u0600-\u06FF]/.test(text) && !/^(أ|ب|ج|د|هـ)\s/.test(text)) {
      const glossaryPattern = /(المؤثل|كماة|ضراغم|جياد|أبطال|فرسان|يقصد|يعني)/u;
      if (glossaryPattern.test(text)) {
        line.type = 'footnote';
        lines.push(line);
        continue;
      }
    }

    // ── اختيار: أنماط متعددة ──────────────────────────────────────────────────
    // النمط 1: حرف + فاصل: "أ نص"، "أ) نص"، "أ- نص"، "أ. نص"، "(أ) نص"
    const CHOICE_CHARS = /[أابتثجحخدذرزسشصضطظعغفقكلمنهوي]/u;
    function detectChoice(t: string): { letter: string; text: string } | null {
      let m = t.match(/^([أابتثجحخدذرزسشصضطظعغفقكلمنهوي])(?:[\s).\-:،)]+)(.+)/su);
      if (m) return { letter: m[1], text: m[2].trim() };
      m = t.match(/^\(([أابتثجحخدذرزسشصضطظعغفقكلمنهوي])\)[\s]*(.+)/su);
      if (m) return { letter: m[1], text: m[2].trim() };
      // رقمي: "1) نص"، "١. نص"
      m = t.match(/^([١٢٣٤٥٦٧٨٩\d]+)[\s).\-:]+(.+)/su);
      if (m) return { letter: m[1], text: m[2].trim() };
      return null;
    }
    // اكتشاف اختيارات متعددة مدمجة في سطر واحد
    function splitMergedChoices(t: string): Array<{ letter: string; text: string }> | null {
      // نمط: حرف + فاصل + نص (حتى الحرف التالي)
      const pat = /([أابتثجحخدذرزسشصضطظعغفقكلمنهوي])(?:[\s).\-:،)]+)([^أابتثجحخدذرزسشصضطظعغفقكلمنهوي]*)/gu;
      const hits = [...t.matchAll(pat)];
      if (hits.length >= 2) {
        const res = hits.map(h => ({ letter: h[1], text: h[2].trim() })).filter(h => h.text.length > 0);
        if (res.length >= 2) return res;
      }
      return null;
    }

    const choiceResult = detectChoice(text);
    if (choiceResult && text.length < 200) {
      // قبل الإضافة: هل النص يحتوي على اختيارات متعددة مدمجة؟
      const merged = splitMergedChoices(text);
      if (merged && merged.length >= 2) {
        // أضف كلًا منها كسطر منفصل
        for (let mi = 0; mi < merged.length; mi++) {
          const mLine: LayoutLine = {
            ...line,
            type: 'choice',
            letter: merged[mi].letter,
            text: merged[mi].text,
            yPct: yPct + mi * (heightPct / merged.length),
            heightPct: heightPct / merged.length,
          };
          lines.push(mLine);
        }
        continue;
      }
      line.type = 'choice';
      line.letter = choiceResult.letter;
      line.text = choiceResult.text;
      lines.push(line);
      continue;
    }

    // جذر السؤال: يبدأ بفعل أمر أو استفهام + خط عريض
    const QUESTION_VERBS = /^(حدد|بيّن|بين|اشرح|اذكر|علّل|علل|قارن|استخرج|اكتب|وضّح|وضح|فسّر|فسر|حلل|ناقش|قيّم|قيم|أعرب|دلل|استنتج|ما|كيف|لماذا|من|متى|أين|هات|أكمل|صحح|رتب|اختر)\b/u;
    if (QUESTION_VERBS.test(text) || isBold) {
      line.type = 'question-stem';
      lines.push(line);
      continue;
    }

    lines.push(line);
  }

  // ── تصحيح حروف الاختيارات المتكررة (مثل كلها "أ") ────────────────────────────
  const ABJAD_FIX = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'];
  let ci = 0;
  while (ci < lines.length) {
    if (lines[ci].type !== 'choice') { ci++; continue; }
    let cj = ci;
    while (cj < lines.length && lines[cj].type === 'choice') cj++;
    const run = lines.slice(ci, cj);
    const letters = run.map(l => l.letter ?? '');
    const hasDup = new Set(letters).size < letters.length || (letters.length > 1 && new Set(letters).size === 1);
    if (hasDup) {
      run.forEach((l, k) => { lines[ci + k] = { ...l, letter: ABJAD_FIX[k] ?? String(k + 1) }; });
    }
    ci = cj;
  }

  return {
    version: 1,
    lines,
    aspectRatio: originalPixelW / Math.max(1, originalPixelH),
    direction: 'rtl',
    baseFontSize: baseFs,
    baseFont: undefined,
    originalPixelWidth: originalPixelW,
    originalPixelHeight: originalPixelH,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PdfViewer({ projectId }: { projectId: number }) {
  const { toast } = useToast();

  const documents = useLiveQuery(() => db.documents.orderBy('createdAt').reverse().toArray(), []);
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const categories = useLiveQuery(
    () => db.settings.get('categories').then(s => s ? (JSON.parse(s.value) as string[]) : []),
    []
  ) ?? [];

  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const selectedDoc = documents?.find(d => d.id === selectedDocId) ?? null;

  // Open the project's first pinned source (or the latest document) directly.
  useEffect(() => {
    if (selectedDocId !== null || !documents?.length) return;
    const preferred = project?.allowedDocIds?.find(id => documents.some(d => d.id === id));
    setSelectedDocId(preferred ?? documents[0].id ?? null);
  }, [documents, project, selectedDocId]);

  // Doc picker modal state
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docSearchTerm, setDocSearchTerm] = useState('');
  const [docFilterCat, setDocFilterCat] = useState('all');

  // Page number input state
  const [pageInputMode, setPageInputMode] = useState(false);
  const [pageInputVal, setPageInputVal] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const currentPageRef = useRef<pdfjsLib.PDFPageProxy | null>(null);
  const currentScaleRef = useRef<number>(1);
  const currentViewportHRef = useRef<number>(0);
  const renderSequenceRef = useRef(0);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [isRendering, setIsRendering] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  const [mode, setMode] = useState<Mode>('idle');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  const [trainingSamples, setTrainingSamples] = useState<Box[]>([]);
  const [detectedBoxes, setDetectedBoxes] = useState<DetectedBox[]>([]);
  /** Quick-Fix drag state for resizing/moving a detected box before capture */
  const [qfDrag, setQfDrag] = useState<{
    idx: number;
    handle: 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
    startPt: { x: number; y: number };
    startBox: { x: number; y: number; w: number; h: number };
  } | null>(null);
  const [gapSlider, setGapSlider] = useState<number | null>(null);
  const [manualBoxes, setManualBoxes] = useState<Box[]>([]);
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null);
  const [capturedThisSession, setCapturedThisSession] = useState<LocalQuestion[]>([]);
  /** معرّفات الأسئلة التي أُضيفت بالفعل إلى صفحة — تظهر بعلامة ✓ */
  const [addedQIds, setAddedQIds] = useState<Set<number>>(new Set());
  /** معرّفات الأسئلة المُثبَّتة (ستبقى في القائمة حتى بعد الإضافة) */
  const [pinnedQIds, setPinnedQIds] = useState<Set<number>>(new Set());
  /** إظهار/إخفاء مربع التدريب (يمكن التبديل بدون مغادرة وضع التدريب) */
  const [showTrainingBox, setShowTrainingBox] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  /** معرّف السؤال الذي يُعرض له اختيار الصفحة */
  const [pagePickerQId, setPagePickerQId] = useState<number | null>(null);
  /** رابط مؤقت للصورة (عندما يكون المستند صورة وليس PDF) */
  const [imageDocUrl, setImageDocUrl] = useState<string | null>(null);
  /** مربع التدريب القابل للتحريك/التحجيم */
  const [trainingBox, setTrainingBox] = useState<Box>({ x: 5, y: 5, w: 90, h: 18 });
  const [trainDrag, setTrainDrag] = useState<{
    handle: string;
    startPt: { x: number; y: number };
    startBox: Box;
  } | null>(null);
  /** رسم حر بالكليك اليمين (training mode) */
  const [rightDrawStart, setRightDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [rightDrawCurrent, setRightDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  /** عدد الصفحات الحالي في المشروع */
  const projectPageCount = useLiveQuery(async () => {
    const proj = await db.projects.get(projectId);
    return Math.max(proj?.pageCount ?? 1, 1);
  }, [projectId]) ?? 1;

  // ── Pre-load all PDFs into cache for instant switching ────────────────────
  useEffect(() => {
    if (!documents) return;
    documents.forEach(doc => {
      if ((doc as any).fileType === 'image' || pdfDocCache.has(doc.id!)) return;
      pdfjsLib.getDocument({ data: doc.fileData.slice(0) }).promise
        .then(pdf => { pdfDocCache.set(doc.id!, pdf); })
        .catch(() => {});
    });
  }, [documents]);

  // ── Load document (PDF or Image) ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedDoc) return;
    let cancelled = false;
    // Don't destroy cached PDFs — just reset view state
    currentPageRef.current = null;
    setPageNum(1);
    setMode('idle');
    setTrainingSamples([]);
    setDetectedBoxes([]);
    setManualBoxes([]);
    setCaptureTarget(null);

    const isImage = (selectedDoc as any).fileType === 'image';

    if (isImage) {
      // عرض الصورة مباشرةً بدون PDF.js
      setNumPages(1);
      const blob = new Blob([selectedDoc.fileData], { type: 'image/*' });
      const url = URL.createObjectURL(blob);
      if (!cancelled) setImageDocUrl(url);
      return () => { cancelled = true; URL.revokeObjectURL(url); };
    }

    setImageDocUrl(null);

    // استخدم الكاش إذا كان PDF محملاً مسبقاً
    const cached = pdfDocCache.get(selectedDoc.id!);
    if (cached) {
      if (!cancelled) {
        pdfDocRef.current = cached;
        setNumPages(cached.numPages);
        renderPage(cached, 1);
      }
      return () => { cancelled = true; };
    }

    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: selectedDoc.fileData.slice(0) }).promise;
        if (cancelled) return;
        pdfDocCache.set(selectedDoc.id!, pdf);
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        renderPage(pdf, 1);
      } catch {
        toast({ title: 'تعذّر فتح الملف', description: 'تأكد أن الملف PDF صحيح وليس تالفاً.', variant: 'destructive' });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDocId]);

  // ── Render page ────────────────────────────────────────────────────────────
  const renderPage = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, num: number, resetSelection = true) => {
    if (!canvasRef.current || !containerRef.current) return;
    const sequence = ++renderSequenceRef.current;
    setIsRendering(true);
    try {
      const page = await pdf.getPage(num);
      currentPageRef.current = page;
      const containerW = containerRef.current.clientWidth - 2;
      const baseVP = page.getViewport({ scale: 1 });
      const cssScale = containerW / baseVP.width;         // CSS-pixel scale
      // Always render above CSS resolution. A DPR=1 desktop was previously
      // rendered at only ~500px then stretched as the splitter moved.
      const dpr = Math.min(3, Math.max(2.25, window.devicePixelRatio || 1));
      const renderScale = cssScale * dpr;                 // render at device resolution
      currentScaleRef.current = cssScale;
      const cssViewport = page.getViewport({ scale: cssScale });
      const renderViewport = page.getViewport({ scale: renderScale });
      currentViewportHRef.current = cssViewport.height;
      const canvas = canvasRef.current;
      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      canvas.style.width = `${cssViewport.width}px`;
      canvas.style.height = `${cssViewport.height}px`;
      setCanvasSize({ w: cssViewport.width, h: cssViewport.height });
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport: renderViewport }).promise;
    } finally {
      if (sequence === renderSequenceRef.current) setIsRendering(false);
    }
    if (resetSelection && sequence === renderSequenceRef.current) {
      setDetectedBoxes([]);
      setTrainingSamples([]);
      setManualBoxes([]);
      setCaptureTarget(null);
    }
  }, []);

  // Re-render from the original PDF whenever the resizable panel changes.
  // CSS stretching alone makes glyphs soft and can visibly distort Arabic.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !selectedDoc || imageDocUrl) return;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (pdfDocRef.current) void renderPage(pdfDocRef.current, pageNum, false);
      }, 120);
    });
    observer.observe(el);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [selectedDocId, pageNum, imageDocUrl, renderPage]);

  const goToPage = useCallback((n: number) => {
    if (!pdfDocRef.current) return;
    const clamped = Math.max(1, Math.min(numPages, n));
    setPageNum(clamped);
    renderPage(pdfDocRef.current, clamped);
  }, [numPages, renderPage]);

  // ── SVG mouse events ───────────────────────────────────────────────────────
  const getSvgPct = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)),
      y: Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100)),
    };
  };

  // Selection tools are ALWAYS available when a document is loaded — the user
  // shouldn't have to click "مربع يدوي" first. Training mode is the only mode
  // that uses a different (draggable) selection UX and disables free drawing.
  const canDraw = !!selectedDoc && mode !== 'training';

  // ── SVG events ──────────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // ── Polygon mode: left-click adds a vertex; double-click closes shape ──
    // Available in ANY mode except training-with-draggable-box.
    if (selectionMethod === 'polygon' && e.button === 0 && mode !== 'training') {
      e.preventDefault();
      const pt = getSvgPct(e);
      setPolygonPoints(prev => [...prev, pt]);
      return;
    }
    // ── كليك يمين: رسم حر (rubber-band) في training أو في freeform selection ──
    if (e.button === 2 && (mode === 'training' || selectionMethod === 'freeform')) {
      e.preventDefault();
      const pt = getSvgPct(e);
      setRightDrawStart(pt);
      setRightDrawCurrent(pt);
      return;
    }


    // ── وضع التدريب (كليك يسار): سحب/تحجيم مربع التدريب ──
    if (mode === 'training') {
      if (captureTarget) { setCaptureTarget(null); return; }
      const pt = getSvgPct(e);
      const b = trainingBox;
      const handles: Record<string, { cx: number; cy: number }> = {
        nw: { cx: b.x, cy: b.y },
        n:  { cx: b.x + b.w / 2, cy: b.y },
        ne: { cx: b.x + b.w, cy: b.y },
        e:  { cx: b.x + b.w, cy: b.y + b.h / 2 },
        se: { cx: b.x + b.w, cy: b.y + b.h },
        s:  { cx: b.x + b.w / 2, cy: b.y + b.h },
        sw: { cx: b.x, cy: b.y + b.h },
        w:  { cx: b.x, cy: b.y + b.h / 2 },
      };
      for (const [key, { cx, cy }] of Object.entries(handles)) {
        if (Math.abs(pt.x - cx) < 3 && Math.abs(pt.y - cy) < 3) {
          e.preventDefault();
          setTrainDrag({ handle: key, startPt: pt, startBox: { ...b } });
          return;
        }
      }
      if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) {
        e.preventDefault();
        setTrainDrag({ handle: 'move', startPt: pt, startBox: { ...b } });
      }
      return;
    }
    if (!canDraw) return;
    if (captureTarget) { setCaptureTarget(null); return; }
    e.preventDefault();
    const pt = getSvgPct(e);
    setIsDrawing(true);
    setDrawStart(pt);
    setDrawCurrent(pt);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    // ── تحديث رسم الكليك اليمين ──
    if (rightDrawStart) {
      e.preventDefault();
      setRightDrawCurrent(getSvgPct(e));
      return;
    }
    // ── Quick-Fix: resize/move a detected box ──
    if (qfDrag) {
      e.preventDefault();
      const pt = getSvgPct(e);
      const dx = pt.x - qfDrag.startPt.x;
      const dy = pt.y - qfDrag.startPt.y;
      const sb = qfDrag.startBox;
      const MIN = 2;
      let { x, y, w, h } = sb;
      switch (qfDrag.handle) {
        case 'move': x = Math.max(0, Math.min(100 - w, sb.x + dx)); y = Math.max(0, Math.min(100 - h, sb.y + dy)); break;
        case 'nw': { const nx = Math.min(sb.x + sb.w - MIN, sb.x + dx); const ny = Math.min(sb.y + sb.h - MIN, sb.y + dy); w = sb.w - (nx - sb.x); h = sb.h - (ny - sb.y); x = nx; y = ny; break; }
        case 'n':  { const ny = Math.min(sb.y + sb.h - MIN, sb.y + dy); h = sb.h - (ny - sb.y); y = ny; break; }
        case 'ne': { w = Math.max(MIN, sb.w + dx); const ny = Math.min(sb.y + sb.h - MIN, sb.y + dy); h = sb.h - (ny - sb.y); y = ny; break; }
        case 'e':  { w = Math.max(MIN, sb.w + dx); break; }
        case 'se': { w = Math.max(MIN, sb.w + dx); h = Math.max(MIN, sb.h + dy); break; }
        case 's':  { h = Math.max(MIN, sb.h + dy); break; }
        case 'sw': { const nx = Math.min(sb.x + sb.w - MIN, sb.x + dx); w = sb.w - (nx - sb.x); h = Math.max(MIN, sb.h + dy); x = nx; break; }
        case 'w':  { const nx = Math.min(sb.x + sb.w - MIN, sb.x + dx); w = sb.w - (nx - sb.x); x = nx; break; }
      }
      x = Math.max(0, x); y = Math.max(0, y);
      w = Math.min(100 - x, Math.max(MIN, w));
      h = Math.min(100 - y, Math.max(MIN, h));
      setDetectedBoxes(prev => prev.map(b => b.index === qfDrag.idx ? { ...b, x, y, w, h } : b));
      return;
    }
    // ── سحب مربع التدريب ──
    if (trainDrag && mode === 'training') {
      e.preventDefault();
      const pt = getSvgPct(e);
      const dx = pt.x - trainDrag.startPt.x;
      const dy = pt.y - trainDrag.startPt.y;
      const sb = trainDrag.startBox;
      setTrainingBox(() => {
        let { x, y, w, h } = sb;
        const MIN = 3;
        switch (trainDrag.handle) {
          case 'move': x = Math.max(0, Math.min(100 - w, sb.x + dx)); y = Math.max(0, Math.min(100 - h, sb.y + dy)); break;
          case 'nw': { const nx = Math.min(sb.x + sb.w - MIN, sb.x + dx); const ny = Math.min(sb.y + sb.h - MIN, sb.y + dy); w = sb.w - (nx - sb.x); h = sb.h - (ny - sb.y); x = nx; y = ny; break; }
          case 'n':  { const ny = Math.min(sb.y + sb.h - MIN, sb.y + dy); h = sb.h - (ny - sb.y); y = ny; break; }
          case 'ne': { w = Math.max(MIN, sb.w + dx); const ny = Math.min(sb.y + sb.h - MIN, sb.y + dy); h = sb.h - (ny - sb.y); y = ny; break; }
          case 'e':  { w = Math.max(MIN, sb.w + dx); break; }
          case 'se': { w = Math.max(MIN, sb.w + dx); h = Math.max(MIN, sb.h + dy); break; }
          case 's':  { h = Math.max(MIN, sb.h + dy); break; }
          case 'sw': { const nx = Math.min(sb.x + sb.w - MIN, sb.x + dx); w = sb.w - (nx - sb.x); h = Math.max(MIN, sb.h + dy); x = nx; break; }
          case 'w':  { const nx = Math.min(sb.x + sb.w - MIN, sb.x + dx); w = sb.w - (nx - sb.x); x = nx; break; }
        }
        return { x: Math.max(0, x), y: Math.max(0, y), w: Math.min(100 - x, w), h: Math.min(100 - y, h) };
      });
      return;
    }
    if (!isDrawing || !drawStart) return;
    e.preventDefault();
    setDrawCurrent(getSvgPct(e));
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    // ── إنهاء رسم الكليك اليمين ──
    if (e.button === 2 && rightDrawStart && rightDrawCurrent) {
      e.preventDefault();
      const x = Math.min(rightDrawStart.x, rightDrawCurrent.x);
      const y = Math.min(rightDrawStart.y, rightDrawCurrent.y);
      const w = Math.abs(rightDrawCurrent.x - rightDrawStart.x);
      const h = Math.abs(rightDrawCurrent.y - rightDrawStart.y);
      if (w >= 2 && h >= 1) {
        if (mode === 'training' && trainingSamples.length < 2) {
          setTrainingSamples(prev => [...prev, { x, y, w, h }]);
          toast({ title: `✅ عينة ${trainingSamples.length + 1}` });
        } else if (mode !== 'training') {
          // Freeform right-drag capture — treat like a manual capture
          setCaptureTarget({ box: { x, y, w, h } });
        }
      }
      setRightDrawStart(null);
      setRightDrawCurrent(null);
      return;
    }
    if (qfDrag) { setQfDrag(null); return; }
    if (trainDrag) { setTrainDrag(null); return; }
    if (!isDrawing || !drawStart || !drawCurrent) return;
    e.preventDefault();
    setIsDrawing(false);
    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x);
    const h = Math.abs(drawCurrent.y - drawStart.y);
    if (w < 2 || h < 1) { setDrawStart(null); setDrawCurrent(null); return; }
    const box: Box = { x, y, w, h };
    // ── ANY left-drag in a non-training mode = manual capture ──
    // Previously required entering "manual" mode. Now the box tool works
    // by default: draw a rectangle → content-type dialog opens → save.
    if (mode !== 'training') {
      setCaptureTarget({ box });
    }
    setDrawStart(null);
    setDrawCurrent(null);
  };


  const activeRect: Box | null = isDrawing && drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x),
    h: Math.abs(drawCurrent.y - drawStart.y),
  } : null;

  /** مستطيل الكليك اليمين أثناء الرسم */
  const rightActiveRect: Box | null = rightDrawStart && rightDrawCurrent ? {
    x: Math.min(rightDrawStart.x, rightDrawCurrent.x),
    y: Math.min(rightDrawStart.y, rightDrawCurrent.y),
    w: Math.abs(rightDrawCurrent.x - rightDrawStart.x),
    h: Math.abs(rightDrawCurrent.y - rightDrawStart.y),
  } : null;

  // ── Save training ──────────────────────────────────────────────────────────
  const saveTraining = async () => {
    if (!selectedDoc?.id || trainingSamples.length === 0) return;
    const avgH = trainingSamples.reduce((s, b) => s + b.h, 0) / trainingSamples.length;
    let gap = avgH * 0.12;
    if (trainingSamples.length === 2) {
      const [s0, s1] = trainingSamples;
      const top0 = Math.min(s0.y, s1.y);
      const top1 = Math.max(s0.y, s1.y);
      const computed = top1 - (top0 + avgH);
      if (computed > 0) gap = computed;
    }
    await db.documents.update(selectedDoc.id, {
      training: {
        questionHeightPct: avgH,
        questionGapPct: gap,
        samples: trainingSamples.map(b => ({ yPct: b.y, hPct: b.h })),
      },
      analysisProfile: {
        version: 1,
        analyzedAt: Date.now(),
        medianQuestionHeightPct: avgH,
        medianGapPct: gap,
        detectedQuestionCount: trainingSamples.length,
        confidence: 1,
      },
    });
    toast({ title: '✅ تم حفظ التدريب', description: `الارتفاع: ${avgH.toFixed(1)}%، الفجوة: ${gap.toFixed(1)}%` });
    setMode('idle');
    setTrainingSamples([]);
  };

  // ── Toggle doc pin (add/remove from project.allowedDocIds) ─────────────────
  const toggleDocPin = async (docId: number) => {
    if (!project) return;
    const current = project.allowedDocIds ?? [];
    const isPinned = current.includes(docId);
    const newIds = isPinned
      ? current.filter(id => id !== docId)
      : [...current, docId];
    await db.projects.update(projectId, { allowedDocIds: newIds, updatedAt: Date.now() });
    toast({ title: isPinned ? 'تم إزالة المستند من المشروع' : '📌 تم تثبيت المستند في المشروع' });
  };

  // ── Auto-detect ────────────────────────────────────────────────────────────
  const runDetection = useCallback(() => {
    const tr = selectedDoc?.training;
    if (!tr) {
      toast({ title: 'لم يُدرَّب بعد', description: 'ادخل وضع التدريب وحدد سؤالًا أو سؤالين أولًا.', variant: 'destructive' });
      return;
    }
    const qH = tr.questionHeightPct;
    const qG = gapSlider !== null ? gapSlider : tr.questionGapPct;
    const stride = qH + qG;
    const startY = tr.samples.length > 0 ? Math.min(...tr.samples.map(s => s.yPct)) : 2;
    const boxes: DetectedBox[] = [];
    let y = startY, idx = 0;
    while (y + qH <= 100) {
      boxes.push({ x: 2, y, w: 96, h: qH, index: idx++ });
      y += stride;
    }
    setDetectedBoxes(boxes);
    setManualBoxes([]);
    setMode('detecting');
    setCaptureTarget(null);
    toast({ title: `تم الكشف عن ${boxes.length} سؤال`, description: 'انقر على أي مربع — يمكنك أيضًا رسم مربع يدوياً.' });
  }, [selectedDoc, gapSlider, toast]);

  /** Save a pixel-faithful crop. For PDFs, re-render the exact region from the
   *  source page at high DPI so crop resolution is independent of viewer size. */
  const saveFaithfulCrop = useCallback(async (box: Box): Promise<LocalQuestion | null> => {
    if (!selectedDoc?.id) return null;
    const out = document.createElement('canvas');
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    // Resolve the source PDF+page *at capture time* so that switching between
    // documents (or between pages) never leaves us cropping a stale page.
    // Previously we used `currentPageRef.current` which lagged behind the
    // active `selectedDoc` when the user switched PDFs and drew a box before
    // the re-render effect completed.
    const cachedPdf = pdfDocCache.get(selectedDoc.id) ?? pdfDocRef.current;
    if (cachedPdf && !imageDocUrl) {
      // High-DPI native re-render — 3× page pt (~216 DPI), independent of viewer size
      const HD_SCALE = 3;
      const page = await cachedPdf.getPage(pageNum);
      const vp = page.getViewport({ scale: HD_SCALE });
      const sx = (box.x / 100) * vp.width;
      const sy = (box.y / 100) * vp.height;
      const sw = (box.w / 100) * vp.width;
      const sh = (box.h / 100) * vp.height;
      out.width = Math.max(1, Math.round(sw));
      out.height = Math.max(1, Math.round(sh));
      const full = document.createElement('canvas');
      full.width = Math.ceil(vp.width);
      full.height = Math.ceil(vp.height);
      const fctx = full.getContext('2d')!;
      fctx.fillStyle = '#fff';
      fctx.fillRect(0, 0, full.width, full.height);
      await page.render({ canvas: full, canvasContext: fctx, viewport: vp }).promise;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(full, sx, sy, sw, sh, 0, 0, out.width, out.height);
    } else {
      const source = imageDocUrl ? imageRef.current : canvasRef.current;
      if (!source) return null;
      const sourceW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
      const sourceH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
      if (!sourceW || !sourceH) return null;
      const sx = Math.max(0, box.x / 100 * sourceW);
      const sy = Math.max(0, box.y / 100 * sourceH);
      const sw = Math.min(sourceW - sx, box.w / 100 * sourceW);
      const sh = Math.min(sourceH - sy, box.h / 100 * sourceH);
      out.width = Math.max(1, Math.round(sw));
      out.height = Math.max(1, Math.round(sh));
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, out.width, out.height);
    }

    const id = await db.questions.add({
      contentType: 'image',
      imageData: out.toDataURL('image/png'),
      sourceDocId: selectedDoc.id,
      sourceDocName: selectedDoc.name,
      sourcePage: pageNum,
      regionX: box.x, regionY: box.y, regionW: box.w, regionH: box.h,
      createdAt: Date.now(),
    });
    return (await db.questions.get(id)) ?? null;
  }, [selectedDoc, imageDocUrl, pageNum]);

  // ── AI Auto-detect (Phases 1–11, entirely local) ────────────────────────────
  const [aiDetecting, setAiDetecting] = useState(false);
  const runAIDetection = useCallback(async () => {
    const pdf = pdfDocRef.current;
    if (!pdf && !imageDocUrl) return;
    setAiDetecting(true);
    try {
      const analyzer = await import('@/lib/analyzer');
      let geo: PageGeometry;
      let candidates: Array<{ bbox: { x: number; y: number; width: number; height: number }; confidence: number }> = [];
      const visualCanvas = document.createElement('canvas');
      if (pdf) {
        let analysis = await analyzer.analyzePdfPage(pdf, pageNum);
        geo = analysis.geometry;
        // Cascade of thresholds — questions in dense Arabic pages often
        // don't have the standard breathing room a strict threshold expects.
        for (const t of [2.2, 1.8, 1.4, 1.0]) {
          candidates = analyzer.detectQuestions(analysis, { minStartScore: t });
          if (candidates.length > 0) break;
        }
        // Scanned PDFs and PDFs with broken text maps need local OCR first.
        if (candidates.length === 0 && canvasRef.current) {
          try {
            const words = await analyzer.ocrPageImage(canvasRef.current, geo.width, geo.height);
            if (words.length > 0) {
              analysis = analyzer.enrichAnalysisWithOcr(analysis, words);
              for (const t of [1.8, 1.4, 1.0]) {
                candidates = analyzer.detectQuestions(analysis, { minStartScore: t });
                if (candidates.length > 0) break;
              }
            }
          } catch (error) {
            console.warn('Local OCR unavailable; using visual segmentation', error);
          }
        }
        if (canvasRef.current) {
          visualCanvas.width = canvasRef.current.width;
          visualCanvas.height = canvasRef.current.height;
          visualCanvas.getContext('2d')?.drawImage(canvasRef.current, 0, 0);
        }
      } else {
        const img = imageRef.current;
        if (!img?.naturalWidth || !img.naturalHeight) throw new Error('الصورة لم تكتمل بعد');
        visualCanvas.width = img.naturalWidth;
        visualCanvas.height = img.naturalHeight;
        visualCanvas.getContext('2d')?.drawImage(img, 0, 0);
        geo = {
          pageNumber: 1, width: img.naturalWidth, height: img.naturalHeight,
          rotation: 0, orientation: img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait',
          margins: { top: 0, right: 0, bottom: 0, left: 0 }, columnCount: 1,
          columns: [{ index: 0, x: 0, width: img.naturalWidth, elementIds: [] }],
          whitespace: [], headerIds: [], footerIds: [], pageNumberIds: [], watermarkIds: [], isScanned: true,
        };
      }
      if (candidates.length === 0 && visualCanvas.width) {
        candidates = analyzer.segmentPageByInk(visualCanvas, geo).map((bbox) => ({ bbox, confidence: 0.45 }));
      }
      const boxes: DetectedBox[] = candidates.map((q, i) => ({
        index: i,
        x: (q.bbox.x / geo.width) * 100,
        y: (q.bbox.y / geo.height) * 100,
        w: (q.bbox.width / geo.width) * 100,
        h: (q.bbox.height / geo.height) * 100,
        confidence: q.confidence,
      }));
      setDetectedBoxes(boxes);
      setManualBoxes([]);
      setMode('detecting');
      setCaptureTarget(null);
      // User-controlled placement: don't auto-save into stickers. Boxes stay
      // highlighted on the source; the user clicks any box to capture it into
      // the library at their own pace.
      toast({
        title: boxes.length ? `🧠 تم تحليل ${boxes.length} سؤال` : 'لم يُعثر على مناطق سؤال واضحة',
        description: boxes.length ? 'انقر على أي مربع لالتقاطه ثم اسحبه إلى الصفحة.' : 'جرّب صفحة أخرى أو ارسم حدود السؤال يدويًا.',
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'فشل الكشف الذكي', description: String(e), variant: 'destructive' });
    } finally {
      setAiDetecting(false);
    }
  }, [pageNum, toast, imageDocUrl, saveFaithfulCrop]);

  useEffect(() => {
    if (mode === 'detecting' && selectedDoc?.training) runDetection();
  }, [gapSlider]);

  // ── Capture as IMAGE ───────────────────────────────────────────────────────
  const captureAsImage = async (box: Box) => {
    const q = await saveFaithfulCrop(box);
    if (q) setCapturedThisSession(prev => [q, ...prev]);
    if ('index' in box) {
      setDetectedBoxes(prev => prev.map(b => b.index === (box as DetectedBox).index ? { ...b, captured: true } : b));
    }
    toast({ title: '📷 تم التقاط الصورة', description: 'اسحبها إلى صفحة المشروع.' });
  };

  // ── Capture as TEXT (legacy) ───────────────────────────────────────────────
  const captureAsText = async (box: Box) => {
    if (!currentPageRef.current || !selectedDoc) return;
    const page = currentPageRef.current;
    const scale = currentScaleRef.current;
    const vH = currentViewportHRef.current;
    const cW = canvasSize.w;
    const cH = canvasSize.h;

    const left   = box.x / 100 * cW;
    const top    = box.y / 100 * cH;
    const right  = (box.x + box.w) / 100 * cW;
    const bottom = (box.y + box.h) / 100 * cH;
    const margin = 12;

    let tc: any;
    try { tc = await page.getTextContent(); }
    catch { toast({ title: 'تعذّر قراءة النص', variant: 'destructive' }); return; }

    const filtered = (tc.items as any[])
      .filter(item => {
        const ix = item.transform[4] * scale;
        const iy = vH - item.transform[5] * scale;
        return ix >= left - margin && ix <= right + margin
            && iy >= top - margin && iy <= bottom + margin;
      })
      .sort((a: any, b: any) => {
        const ay = vH - a.transform[5] * scale;
        const by = vH - b.transform[5] * scale;
        if (Math.abs(ay - by) > 4) return ay - by;
        return b.transform[4] - a.transform[4];
      })
      .map((i: any) => i.str)
      .join(' ')
      .trim();

    if (!filtered) {
      toast({
        title: '⚠️ لا يوجد نص قابل للاستخراج',
        description: 'هذا الملف مصوَّر — استخدم "تخطيط" أو "صورة" بدلاً من "نص".',
        variant: 'destructive',
      });
      return;
    }

    const id = await db.questions.add({
      contentType: 'text', textContent: filtered,
      sourceDocId: selectedDoc.id!, sourceDocName: selectedDoc.name,
      sourcePage: pageNum,
      regionX: box.x, regionY: box.y, regionW: box.w, regionH: box.h,
      createdAt: Date.now(),
    });
    const q = await db.questions.get(id);
    if (q) setCapturedThisSession(prev => [q, ...prev]);
    if ('index' in box) {
      setDetectedBoxes(prev => prev.map(b => b.index === (box as DetectedBox).index ? { ...b, captured: true } : b));
    }
    toast({ title: '📝 تم استخراج النص', description: `${filtered.length} حرف.` });
  };

  // ── Capture as RICH LAYOUT (الوضع الجديد) ──────────────────────────────────
  const captureAsRichLayout = async (box: Box) => {
    if (!currentPageRef.current || !selectedDoc) return;
    setIsCapturing(true);
    try {
      const layout = await extractLayout(
        currentPageRef.current,
        box,
        currentScaleRef.current,
        currentViewportHRef.current,
        canvasSize.w,
        canvasSize.h,
      );

      if (!layout || layout.lines.length === 0) {
        toast({
          title: '⚠️ تعذّر استخراج التخطيط',
          description: 'هذا الملف مصوَّر ضوئياً — استخدم "صورة" بدلاً من "تخطيط".',
          variant: 'destructive',
        });
        return;
      }

      const id = await db.questions.add({
        contentType: 'rich-layout',
        layoutData: layout,
        sourceDocId: selectedDoc.id!,
        sourceDocName: selectedDoc.name,
        sourcePage: pageNum,
        regionX: box.x, regionY: box.y, regionW: box.w, regionH: box.h,
        createdAt: Date.now(),
      });
      const q = await db.questions.get(id);
      if (q) setCapturedThisSession(prev => [q, ...prev]);
      if ('index' in box) {
        setDetectedBoxes(prev => prev.map(b => b.index === (box as DetectedBox).index ? { ...b, captured: true } : b));
      }
      toast({
        title: '📐 تم استخراج التخطيط',
        description: `${layout.lines.length} سطر — اسحبه إلى صفحة المشروع.`,
      });
    } finally {
      setIsCapturing(false);
    }
  };

  // ── Handle capture choice ──────────────────────────────────────────────────
  const handleCapture = async (type: 'rich-layout' | 'image' | 'text') => {
    if (!captureTarget) return;
    const box = captureTarget.box;
    setCaptureTarget(null);
    if (type === 'rich-layout') await captureAsRichLayout(box);
    else if (type === 'image') await captureAsImage(box);
    else await captureAsText(box);
  };

  // ── Selection-method / content-type options (for training + manual) ──
  type SelectionMethod = 'box' | 'freeform' | 'polygon';
  type ManualContentType = 'image' | 'text' | 'rich-layout';
  const [selectionMethod, setSelectionMethod] = useState<SelectionMethod>('box');
  const [manualCaptureType, setManualCaptureType] = useState<ManualContentType>('image');
  const [polygonPoints, setPolygonPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [pendingModeChoice, setPendingModeChoice] = useState<'training' | 'manual' | null>(null); // legacy — unused

  // ── Switch mode ────────────────────────────────────────────────────────────
  const switchMode = (m: Mode) => {
    if (mode === m) {
      setMode('idle');
      setTrainingSamples([]); setDetectedBoxes([]); setManualBoxes([]);
      setCaptureTarget(null); setPolygonPoints([]);
      return;
    }
    setMode(m);
    setTrainingSamples([]); setDetectedBoxes([]); setManualBoxes([]);
    setCaptureTarget(null); setPolygonPoints([]);
    if (m === 'training') setShowTrainingBox(selectionMethod === 'box');
    if (m === 'training' || m === 'manual') {
      toast({
        title: m === 'training' ? '🎯 وضع التدريب' : '📷 مربع يدوي',
        description: 'اختر طريقة التحديد من الشريط أعلى الصفحة.',
      });
    }
  };

  // Close the polygon into a bbox and treat it as training sample / manual box.
  const closePolygon = () => {
    if (polygonPoints.length < 3) {
      toast({ title: '⚠️ 3 نقاط على الأقل', variant: 'destructive' });
      return;
    }
    const xs = polygonPoints.map(p => p.x);
    const ys = polygonPoints.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    const box: Box = { x, y, w, h };
    setPolygonPoints([]);
    if (mode === 'training') {
      if (trainingSamples.length < 2) {
        setTrainingSamples(prev => [...prev, box]);
        toast({ title: `✅ عينة ${trainingSamples.length + 1}` });
      }
    } else {
      // Any non-training mode → open the content-type dialog
      setCaptureTarget({ box });
    }
  };

  const confirmModeChoice = () => { setPendingModeChoice(null); };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-muted/10 border-l border-border overflow-hidden" dir="rtl">

      {/* ── Toolbar ── */}
      <div className="shrink-0 border-b bg-background px-3 py-2 flex items-center gap-2 flex-wrap">
        {/* Doc picker button */}
        <button
          onClick={() => setDocPickerOpen(true)}
          className="h-8 text-xs w-52 shrink-0 flex items-center gap-1.5 border border-border rounded-md px-3 bg-background hover:bg-muted/50 transition-colors"
        >
          {selectedDoc ? (
            <span className="flex-1 truncate text-right">
              {selectedDoc.name.length > 26 ? selectedDoc.name.slice(0, 24) + '…' : selectedDoc.name}
              {selectedDoc.training ? ' 🧠' : ''}
            </span>
          ) : (
            <span className="flex-1 text-muted-foreground">اختر مستندًا...</span>
          )}
          <ChevronLeft className="w-3 h-3 text-muted-foreground shrink-0 -rotate-90" />
        </button>

        {selectedDoc && (
          <div className="flex items-center bg-muted rounded-md p-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm"
              onClick={() => goToPage(pageNum - 1)} disabled={pageNum <= 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            {pageInputMode ? (
              <input
                type="number" min={1} max={numPages}
                value={pageInputVal}
                autoFocus
                className="w-14 text-xs text-center border border-primary/40 rounded px-1 py-0.5 outline-none font-medium tabular-nums bg-background"
                onChange={e => setPageInputVal(e.target.value)}
                onBlur={() => { const n = parseInt(pageInputVal); if (!isNaN(n)) goToPage(n); setPageInputMode(false); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { const n = parseInt(pageInputVal); if (!isNaN(n)) goToPage(n); setPageInputMode(false); }
                  if (e.key === 'Escape') setPageInputMode(false);
                }}
              />
            ) : (
              <span
                className="text-xs font-medium px-2 tabular-nums cursor-pointer hover:text-primary hover:underline"
                title="انقر لإدخال رقم الصفحة مباشرةً"
                onClick={() => { setPageInputMode(true); setPageInputVal(String(pageNum)); }}
              >
                {pageNum} / {numPages}
              </span>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm"
              onClick={() => goToPage(pageNum + 1)} disabled={pageNum >= numPages}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="flex-1" />

        {selectedDoc && (
          <>
            <Button size="sm"
              variant={mode === 'training' ? 'default' : 'outline'}
              className={cn('h-8 text-xs gap-1.5', mode === 'training' && 'bg-blue-600 hover:bg-blue-700 text-white border-0')}
              onClick={() => switchMode('training')}
            >
              <Brain className="w-3.5 h-3.5" />
              تدريب
            </Button>
            <Button size="sm"
              variant={mode === 'detecting' ? 'default' : 'outline'}
              className={cn('h-8 text-xs gap-1.5', mode === 'detecting' && 'bg-amber-500 hover:bg-amber-600 text-white border-0')}
              onClick={runDetection}
              disabled={!selectedDoc.training}
              title={!selectedDoc.training ? 'دُرِّب أولاً' : 'كشف تلقائي عن الأسئلة'}
            >
              <Zap className="w-3.5 h-3.5" />
              كشف تلقائي
            </Button>
            <Button size="sm"
              variant={mode === 'manual' ? 'default' : 'outline'}
              className={cn('h-8 text-xs gap-1.5', mode === 'manual' && 'bg-sky-600 hover:bg-sky-700 text-white border-0')}
              onClick={() => switchMode('manual')}
              title="ارسم مربعًا واحدًا فوق سؤال معين لالتقاطه فورًا (بدون تدريب ولا كشف)"
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              مربع يدوي
            </Button>
            <Button size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-emerald-500/60 text-emerald-700 hover:bg-emerald-50"
              onClick={runAIDetection}
              disabled={aiDetecting}
              title="يحلل الصفحة ويجهز الأسئلة للسحب مباشرةً دون تدريب"
            >
              {aiDetecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Brain className="w-3.5 h-3.5" />
              )}
              حلّل الأسئلة
            </Button>
          </>
        )}
      </div>

      {/* ── تبويبات المستندات المثبَّتة في المشروع ── */}
      {(project?.allowedDocIds?.length ?? 0) > 0 && documents && (
        <div className="shrink-0 border-b bg-muted/20 px-2 py-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {project!.allowedDocIds!.map(docId => {
            const doc = documents.find(d => d.id === docId);
            if (!doc) return null;
            const isActive = selectedDocId === docId;
            return (
              <button
                key={docId}
                onClick={() => {
                  setSelectedDocId(docId);
                  setMode('idle');
                  setDetectedBoxes([]); setTrainingSamples([]);
                  setManualBoxes([]); setCapturedThisSession([]);
                  setCaptureTarget(null);
                }}
                title={doc.name}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap border ${
                  isActive
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-background border-border hover:border-primary/50 hover:text-primary text-muted-foreground'
                }`}
              >
                <span className="max-w-[100px] truncate">
                  {doc.name.length > 16 ? doc.name.slice(0, 15) + '…' : doc.name}
                </span>
                {doc.training && <span className="text-[9px] opacity-80">🧠</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Persistent Selection-Method Toolbar — always shown when a doc is loaded ── */}
      {selectedDoc && (
        <div className="shrink-0 border-b bg-gradient-to-l from-indigo-50/70 to-blue-50/70 px-4 py-1.5 flex items-center gap-2 text-xs flex-wrap">
          <span className="text-muted-foreground font-medium shrink-0">أداة التحديد:</span>
          {([
            { id: 'box' as const,      label: '⬛ مربع',       hint: 'اسحب بزر الفأرة الأيسر لرسم مربع' },
            { id: 'freeform' as const, label: '✏️ رسم حر',     hint: 'اسحب بزر الفأرة الأيمن' },
            { id: 'polygon' as const,  label: '⋯ نقاط',        hint: 'اضغط لإضافة نقطة، ثم أغلق الشكل بدبل كليك' },
          ]).map(o => (
            <button key={o.id}
              onClick={() => {
                setSelectionMethod(o.id);
                setPolygonPoints([]);
                if (mode === 'training') setShowTrainingBox(o.id === 'box');
              }}
              title={o.hint}
              className={cn(
                'px-3 py-1 rounded-md border text-xs transition-all font-medium',
                selectionMethod === o.id
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-background border-border hover:border-primary/50'
              )}>
              {o.label}
            </button>
          ))}
          {selectionMethod === 'polygon' && (
            <div className="flex items-center gap-1.5 ms-auto">
              <span className="text-primary font-medium">{polygonPoints.length} نقطة</span>
              {polygonPoints.length >= 3 && (
                <button onClick={closePolygon}
                  className="px-2.5 py-1 rounded-md bg-emerald-600 text-white border border-emerald-700 text-xs font-medium hover:bg-emerald-700">
                  ✓ إغلاق الشكل
                </button>
              )}
              {polygonPoints.length > 0 && (
                <button onClick={() => setPolygonPoints([])}
                  className="px-2 py-1 rounded-md border border-border text-xs hover:border-destructive hover:text-destructive">
                  تراجع
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Info bars ── */}

      {mode === 'training' && (
        <div className="shrink-0 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between gap-4 text-xs text-blue-800">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              {trainingSamples.length === 0 && 'حرّك المربع الأزرق ليغطي سؤالاً كاملاً، ثم اضغط "أضف عينة"'}
              {trainingSamples.length === 1 && 'ضع المربع على سؤال ثانٍ (اختياري — لضبط المسافة) ثم "أضف عينة"'}
              {trainingSamples.length >= 2 && 'تم — اضغط "حفظ التدريب"'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* زر إظهار/إخفاء مربع التدريب */}
            <Button size="sm" variant="ghost"
              className={cn('h-6 text-xs px-2 border', showTrainingBox ? 'text-blue-700 border-blue-300 bg-blue-100' : 'text-blue-500 border-blue-200')}
              onClick={() => setShowTrainingBox(p => !p)}
              title={showTrainingBox ? 'إخفاء مربع التدريب' : 'إظهار مربع التدريب'}
            >
              {showTrainingBox ? '🟦 إخفاء المربع' : '🔲 إظهار المربع'}
            </Button>
            {trainingSamples.length < 2 && (
              <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-700 px-2 border border-blue-300"
                onClick={() => { setShowTrainingBox(true); setTrainingSamples(prev => [...prev, { ...trainingBox }]); }}>
                <CheckCircle2 className="w-3 h-3 me-1" />أضف عينة
              </Button>
            )}
            {trainingSamples.length > 0 && (
              <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-700 px-2"
                onClick={() => setTrainingSamples(p => p.slice(0, -1))}>
                <Trash2 className="w-3 h-3 me-1" />تراجع
              </Button>
            )}
            {trainingSamples.length > 0 && (
              <Button size="sm" className="h-6 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3"
                onClick={saveTraining}>
                <CheckCircle2 className="w-3 h-3 me-1" />حفظ التدريب
              </Button>
            )}
          </div>
        </div>
      )}

      {mode === 'detecting' && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-3 text-xs text-amber-800">
          <span className="shrink-0 font-medium">ضبط المسافة:</span>
          <input type="range" min="0" max="20" step="0.5"
            value={gapSlider ?? (selectedDoc?.training?.questionGapPct ?? 5)}
            onChange={e => setGapSlider(parseFloat(e.target.value))}
            className="flex-1 accent-amber-500"
          />
          <span className="shrink-0 tabular-nums w-10">
            {(gapSlider ?? (selectedDoc?.training?.questionGapPct ?? 5)).toFixed(1)}%
          </span>
          <span className="shrink-0 text-amber-600">| ارسم مربعًا يدوياً لإضافة سؤال غير مكتشف</span>
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2"
            onClick={() => { setGapSlider(null); setDetectedBoxes([]); setManualBoxes([]); setMode('idle'); }}>
            مسح
          </Button>
        </div>
      )}

      {mode === 'manual' && (
        <div className="shrink-0 bg-sky-50 border-b border-sky-200 px-4 py-2 flex items-center gap-2 text-xs text-sky-800">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">ارسم مربعًا بالماوس فوق أي سؤال — سيتم التقاطه فورًا بجودة عالية من نفس الـ PDF بدون تدريب.</span>
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-sky-700"
            onClick={() => setMode('idle')}>
            إنهاء
          </Button>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 overflow-auto p-4 flex flex-col items-center" ref={containerRef}>
          {!selectedDoc ? (
            <div className="m-auto flex flex-col items-center text-center text-muted-foreground opacity-40 gap-4 py-16">
              <BookMarked className="w-16 h-16" />
              <div>
                <p className="font-semibold text-lg">اختر مستندًا</p>
                <p className="text-sm mt-1">اختر ملف PDF أو صورة من القائمة أعلاه</p>
              </div>
            </div>
          ) : (
            <div className="relative w-full border border-border shadow-lg bg-white">
              {(isRendering || isCapturing) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  {isCapturing && <span className="ms-2 text-sm text-primary font-medium">يُحلّل التخطيط…</span>}
                </div>
              )}
              {/* Canvas for PDF / img for images */}
              {imageDocUrl
                ? <img ref={imageRef} src={imageDocUrl} alt="مستند" className="w-full block" onLoad={e => { const el = e.currentTarget; setCanvasSize({ w: el.naturalWidth || el.clientWidth, h: el.naturalHeight || el.clientHeight }); }} />
                : <canvas ref={canvasRef} className="block max-w-none" />
              }

              {/* SVG overlay — z-index أعلى من loading overlay (z-20) لضمان ظهور مربع التدريب */}
              <svg
                className="absolute inset-0 w-full h-full"
                style={{ zIndex: 30, cursor: mode === 'training' ? (rightDrawStart ? 'crosshair' : 'grab') : canDraw ? 'crosshair' : 'default' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onContextMenu={e => e.preventDefault()}
                onDoubleClick={() => { if (selectionMethod === 'polygon' && polygonPoints.length >= 3) closePolygon(); }}
                onMouseLeave={() => {
                  if (isDrawing) { setIsDrawing(false); setDrawStart(null); setDrawCurrent(null); }
                  if (trainDrag) setTrainDrag(null);
                  if (rightDrawStart) { setRightDrawStart(null); setRightDrawCurrent(null); }
                }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {/* ── وضع التدريب: مربع شفاف قابل للسحب/التحجيم ── */}
                {mode === 'training' && showTrainingBox && (() => {
                  const b = trainingBox;
                  const handles = [
                    { id: 'nw', cx: b.x, cy: b.y, cur: 'nw-resize' },
                    { id: 'n',  cx: b.x + b.w / 2, cy: b.y, cur: 'n-resize' },
                    { id: 'ne', cx: b.x + b.w, cy: b.y, cur: 'ne-resize' },
                    { id: 'e',  cx: b.x + b.w, cy: b.y + b.h / 2, cur: 'e-resize' },
                    { id: 'se', cx: b.x + b.w, cy: b.y + b.h, cur: 'se-resize' },
                    { id: 's',  cx: b.x + b.w / 2, cy: b.y + b.h, cur: 's-resize' },
                    { id: 'sw', cx: b.x, cy: b.y + b.h, cur: 'sw-resize' },
                    { id: 'w',  cx: b.x, cy: b.y + b.h / 2, cur: 'w-resize' },
                  ];
                  return (
                    <g>
                      {/* ملء خفيف + حدود واضحة */}
                      <rect x={b.x} y={b.y} width={b.w} height={b.h}
                        fill="rgba(37,99,235,0.08)" stroke="#2563eb" strokeWidth="0.9"
                        strokeDasharray="3 1.5" vectorEffect="non-scaling-stroke"
                        style={{ cursor: trainDrag?.handle === 'move' ? 'grabbing' : 'grab' }} />
                      {/* المقابض */}
                      {handles.map(h => (
                        <circle key={h.id} cx={h.cx} cy={h.cy} r="2"
                          fill="#2563eb" stroke="white" strokeWidth="0.5"
                          vectorEffect="non-scaling-stroke"
                          style={{ cursor: h.cur }} />
                      ))}
                      {/* بُعد المربع */}
                      <text x={b.x + b.w / 2} y={b.y - 1.5} textAnchor="middle"
                        fill="#1d4ed8" fontSize="3" fontFamily="Cairo,sans-serif">
                        {b.w.toFixed(0)}% × {b.h.toFixed(0)}%
                      </text>
                    </g>
                  );
                })()}

                {/* ── مستطيل تحديد الكليك اليمين (rubber-band) ── */}
                {rightActiveRect && (
                  <rect
                    x={rightActiveRect.x} y={rightActiveRect.y}
                    width={rightActiveRect.w} height={rightActiveRect.h}
                    fill="rgba(56,189,248,0.25)" stroke="#0ea5e9"
                    strokeWidth="0.5" strokeDasharray="2 1"
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* عينات التدريب المحفوظة */}
                {trainingSamples.map((box, i) => (
                  <g key={i}>
                    <rect x={box.x} y={box.y} width={box.w} height={box.h}
                      fill="rgba(37,99,235,0.10)" stroke="#2563eb" strokeWidth="0.4"
                      vectorEffect="non-scaling-stroke" />
                    <text x={box.x + 1} y={box.y + box.h - 1.5} fill="#1d4ed8"
                      fontSize="3" fontFamily="Cairo,sans-serif">س{i + 1}</text>
                  </g>
                ))}

                {/* رسم يدوي (وضع الكشف فقط) */}
                {activeRect && mode !== 'training' && (
                  <rect x={activeRect.x} y={activeRect.y} width={activeRect.w} height={activeRect.h}
                    fill="rgba(245,158,11,0.15)" stroke="#f59e0b"
                    strokeWidth="0.3" strokeDasharray="2" vectorEffect="non-scaling-stroke" />
                )}

                {/* Manual boxes */}
                {manualBoxes.map((box, i) => (
                  <rect key={i} x={box.x} y={box.y} width={box.w} height={box.h}
                    fill="rgba(16,185,129,0.12)" stroke="#10b981" strokeWidth="0.3"
                    strokeDasharray="1.5" vectorEffect="non-scaling-stroke" />
                ))}

                {/* ── Polygon vertices (visible blue points) ── */}
                {mode !== 'training' && selectionMethod === 'polygon' && polygonPoints.length > 0 && (
                  <g>
                    {polygonPoints.length >= 2 && (
                      <polyline
                        points={polygonPoints.map(p => `${p.x},${p.y}`).join(' ') +
                                (polygonPoints.length >= 3 ? ` ${polygonPoints[0].x},${polygonPoints[0].y}` : '')}
                        fill={polygonPoints.length >= 3 ? 'rgba(37,99,235,0.10)' : 'none'}
                        stroke="#2563eb" strokeWidth="0.5"
                        strokeDasharray="1.5 1"
                        vectorEffect="non-scaling-stroke" />
                    )}
                    {polygonPoints.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="1.6"
                          fill="#2563eb" stroke="white" strokeWidth="0.6"
                          vectorEffect="non-scaling-stroke"
                          style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.35))' }} />
                        <text x={p.x + 2.2} y={p.y - 1.4} fill="#1d4ed8"
                          fontSize="2.6" fontFamily="Cairo,sans-serif" fontWeight="bold">
                          {i + 1}
                        </text>
                      </g>
                    ))}
                  </g>
                )}

                {/* Auto-detected boxes */}
                {detectedBoxes.map(box => {
                  // Bracket size, in page-percent units. Kept tiny so it
                  // reads as a corner marker rather than covering content.
                  const bs = Math.min(2.2, box.w * 0.06, box.h * 0.35);
                  const color = box.captured ? '#22c55e' : '#f59e0b';
                  const dark = box.captured ? '#15803d' : '#b45309';
                  return (
                    <g key={box.index} style={{ cursor: box.captured ? 'default' : 'pointer' }}>
                      <rect x={box.x} y={box.y} width={box.w} height={box.h}
                        fill={box.captured ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)'}
                        stroke={color}
                        strokeWidth="0.3" vectorEffect="non-scaling-stroke"
                        onClick={() => { if (!box.captured) setCaptureTarget({ box }); }} />
                      {/* Start marker — green line at top */}
                      <line x1={box.x} y1={box.y} x2={box.x + box.w} y2={box.y}
                        stroke="#16a34a" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      {/* End marker — red line at bottom */}
                      <line x1={box.x} y1={box.y + box.h} x2={box.x + box.w} y2={box.y + box.h}
                        stroke="#dc2626" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      {/* Corner brackets */}
                      <polyline points={`${box.x},${box.y + bs} ${box.x},${box.y} ${box.x + bs},${box.y}`}
                        fill="none" stroke={dark} strokeWidth="0.8"
                        vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                      <polyline points={`${box.x + box.w - bs},${box.y} ${box.x + box.w},${box.y} ${box.x + box.w},${box.y + bs}`}
                        fill="none" stroke={dark} strokeWidth="0.8"
                        vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                      <polyline points={`${box.x},${box.y + box.h - bs} ${box.x},${box.y + box.h} ${box.x + bs},${box.y + box.h}`}
                        fill="none" stroke={dark} strokeWidth="0.8"
                        vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                      <polyline points={`${box.x + box.w - bs},${box.y + box.h} ${box.x + box.w},${box.y + box.h} ${box.x + box.w},${box.y + box.h - bs}`}
                        fill="none" stroke={dark} strokeWidth="0.8"
                        vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                      <text x={box.x + box.w / 2} y={box.y + box.h / 2}
                        textAnchor="middle" dominantBaseline="middle"
                        fill={dark}
                        fontSize="4" fontWeight="bold" fontFamily="Cairo,sans-serif"
                        style={{ pointerEvents: 'none' }}>
                        {box.captured ? '✓' : `${box.index + 1}${box.confidence ? ` · ${Math.round(box.confidence * 100)}%` : ''}`}
                      </text>
                      {/* ✕ delete button — removes the box and renumbers */}
                      {!box.captured && (
                        <g style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetectedBoxes(prev => prev
                              .filter(b => b.index !== box.index)
                              .sort((a, b) => a.y - b.y)
                              .map((b, i) => ({ ...b, index: i })));
                            toast({ title: 'حُذف السؤال وأُعيد الترقيم' });
                          }}>
                          <circle cx={box.x + box.w - 1.6} cy={box.y + 1.6} r="1.4"
                            fill="#dc2626" stroke="white" strokeWidth="0.4"
                            vectorEffect="non-scaling-stroke" />
                          <text x={box.x + box.w - 1.6} y={box.y + 1.6}
                            textAnchor="middle" dominantBaseline="middle"
                            fill="white" fontSize="2.2" fontWeight="bold"
                            style={{ pointerEvents: 'none' }}>✕</text>
                        </g>
                      )}
                      {/* ── Quick-Fix resize handles (8 corners/edges + move) ── */}
                      {!box.captured && (() => {
                        const hs = 1.2; // handle size (page-percent units)
                        const cx = box.x + box.w / 2;
                        const cy = box.y + box.h / 2;
                        const handles: Array<{ h: 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'; x: number; y: number; c: string }> = [
                          { h: 'nw', x: box.x,             y: box.y,             c: 'nwse-resize' },
                          { h: 'n',  x: cx,                y: box.y,             c: 'ns-resize'   },
                          { h: 'ne', x: box.x + box.w,     y: box.y,             c: 'nesw-resize' },
                          { h: 'e',  x: box.x + box.w,     y: cy,                c: 'ew-resize'   },
                          { h: 'se', x: box.x + box.w,     y: box.y + box.h,     c: 'nwse-resize' },
                          { h: 's',  x: cx,                y: box.y + box.h,     c: 'ns-resize'   },
                          { h: 'sw', x: box.x,             y: box.y + box.h,     c: 'nesw-resize' },
                          { h: 'w',  x: box.x,             y: cy,                c: 'ew-resize'   },
                        ];
                        const onDown = (handle: typeof handles[number]['h']) => (e: React.MouseEvent) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setQfDrag({
                            idx: box.index,
                            handle,
                            startPt: getSvgPct(e as unknown as React.MouseEvent<SVGSVGElement>),
                            startBox: { x: box.x, y: box.y, w: box.w, h: box.h },
                          });
                        };
                        return (
                          <g>
                            {handles.map(h => (
                              <rect key={h.h}
                                x={h.x - hs / 2} y={h.y - hs / 2}
                                width={hs} height={hs}
                                fill="white" stroke={dark} strokeWidth="0.4"
                                vectorEffect="non-scaling-stroke"
                                style={{ cursor: h.c }}
                                onMouseDown={onDown(h.h)} />
                            ))}
                          </g>
                        );
                      })()}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Captured sidebar */}
        {capturedThisSession.length > 0 && (
          <div className="w-48 shrink-0 border-r border-border bg-background flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>ملتقطة ({capturedThisSession.length})</span>
              <button
                title="مسح القائمة"
                onClick={() => { setCapturedThisSession([]); setAddedQIds(new Set()); }}
                className="text-[9px] text-muted-foreground/50 hover:text-destructive transition-colors"
              ><X className="w-3 h-3" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {capturedThisSession.map(q => {
                const isText = q.contentType === 'text';
                const isRich = q.contentType === 'rich-layout';
                const wasAdded = addedQIds.has(q.id!);
                const isPinned = pinnedQIds.has(q.id!);

                const togglePin = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setPinnedQIds(prev => {
                    const n = new Set(prev);
                    if (n.has(q.id!)) n.delete(q.id!); else n.add(q.id!);
                    return n;
                  });
                };

                /** أزل السؤال من القائمة إذا لم يكن مُثبَّتاً */
                const maybeDismiss = () => {
                  if (!isPinned) {
                    setCapturedThisSession(prev => prev.filter(x => x.id !== q.id));
                    setAddedQIds(prev => { const n = new Set(prev); n.delete(q.id!); return n; });
                    setPinnedQIds(prev => { const n = new Set(prev); n.delete(q.id!); return n; });
                  }
                };

                /** أضف سؤالاً إلى صفحة */
                const addToPage = async (pageIndex: number) => {
                  const existingItems = await db.projectItems
                    .where('projectId').equals(projectId)
                    .filter(item => item.pageIndex === pageIndex)
                    .toArray();
                  const sortOrder = existingItems.length > 0
                    ? Math.max(...existingItems.map(item => item.sortOrder)) + 1
                    : 1;
                  await db.projectItems.add({
                    projectId, pageIndex, sortOrder,
                    questionId: q.id,
                    contentType: q.contentType ?? 'image',
                    imageData: q.imageData,
                    textContent: q.textContent,
                    layoutData: q.layoutData,
                    createdAt: Date.now(),
                  });
                  await db.projects.update(projectId, { updatedAt: Date.now() });
                  setAddedQIds(prev => new Set([...prev, q.id!]));
                  // إذا لم يكن مُثبَّتاً، أزله من القائمة
                  setTimeout(maybeDismiss, 60);
                };

                return (
                  <div
                    key={q.id}
                    draggable={true}
                    onDragStart={e => {
                      window.getSelection()?.removeAllRanges();
                      // نمرر المعرّف فقط — البيانات تُجلب من DB عند الإسقاط
                      e.dataTransfer.setData('q-id', String(q.id));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDragEnd={e => {
                      if (e.dataTransfer.dropEffect !== 'none') {
                        setAddedQIds(prev => new Set([...prev, q.id!]));
                        setTimeout(maybeDismiss, 120);
                      }
                    }}
                    className={`border rounded bg-white overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-sm transition-all group select-none relative ${
                      q.rejected ? 'border-red-400 ring-1 ring-red-200'
                        : q.inBank ? 'border-emerald-400'
                        : isPinned ? 'border-amber-400'
                        : wasAdded ? 'border-green-400/70'
                        : 'border-border hover:border-primary/50'
                    }`}
                    style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                    title="اسحب إلى صفحة المشروع"
                  >
                    {/* Status strip */}
                    {q.rejected ? <div className="h-1 w-full bg-red-400" />
                      : q.inBank ? <div className="h-1 w-full bg-emerald-500" />
                      : isPinned ? <div className="h-1 w-full bg-amber-400" />
                      : wasAdded ? <div className="h-1 w-full bg-green-400" /> : null
                    }

                    {/* Action toolbar (pin / send-to-bank / reject / dismiss) */}
                    <div className="absolute top-1 right-1 z-10 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        title={q.inBank ? 'موجود في بنك الأسئلة' : 'إرسال إلى بنك الأسئلة'}
                        onClick={async e => {
                          e.stopPropagation();
                          const next = !q.inBank;
                          await db.questions.update(q.id!, { inBank: next, rejected: false });
                          setCapturedThisSession(prev => prev.map(x => x.id === q.id ? { ...x, inBank: next, rejected: false } : x));
                        }}
                        className={cn(
                          'w-4 h-4 rounded-full flex items-center justify-center text-[9px] border transition-colors',
                          q.inBank
                            ? 'bg-emerald-500 border-emerald-600 text-white'
                            : 'bg-white/80 border-border/50 text-muted-foreground/50 hover:text-emerald-600 hover:border-emerald-300'
                        )}
                      >📚</button>
                      <button
                        title={q.rejected ? 'إعادة إلى الالتقاطات — إزالة علامة الرفض' : 'وسمه خطأً — يظهر بالأحمر'}
                        onClick={async e => {
                          e.stopPropagation();
                          const next = !q.rejected;
                          await db.questions.update(q.id!, { rejected: next, inBank: next ? false : q.inBank });
                          setCapturedThisSession(prev => prev.map(x => x.id === q.id ? { ...x, rejected: next, inBank: next ? false : x.inBank } : x));
                        }}
                        className={cn(
                          'w-4 h-4 rounded-full flex items-center justify-center text-[9px] border transition-colors',
                          q.rejected
                            ? 'bg-red-500 border-red-600 text-white'
                            : 'bg-white/80 border-border/50 text-muted-foreground/50 hover:text-red-600 hover:border-red-300'
                        )}
                      >✕</button>
                      <button
                        title={isPinned ? 'إلغاء التثبيت' : 'تثبيت — يبقى بعد الإضافة'}
                        onClick={togglePin}
                        className={cn(
                          'w-4 h-4 rounded-full flex items-center justify-center text-[9px] border transition-colors',
                          isPinned
                            ? 'bg-amber-400 border-amber-500 text-white'
                            : 'bg-white/80 border-border/50 text-muted-foreground/50 hover:text-amber-500 hover:border-amber-300'
                        )}
                      >📌</button>
                    </div>

                    {/* Dismiss button */}
                    <button
                      title="إزالة من القائمة"
                      onClick={e => {
                        e.stopPropagation();
                        setCapturedThisSession(prev => prev.filter(x => x.id !== q.id));
                        setAddedQIds(prev => { const n = new Set(prev); n.delete(q.id!); return n; });
                        setPinnedQIds(prev => { const n = new Set(prev); n.delete(q.id!); return n; });
                      }}
                      className="absolute top-1 left-1 z-10 w-4 h-4 rounded-full bg-white/80 border border-border/50 flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:border-destructive/50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>

                    {isRich ? (
                      <div className="px-2 py-2 min-h-[50px]">
                        <div className="flex items-center gap-1 text-emerald-600 mb-1">
                          <LayoutTemplate className="w-3 h-3" />
                          <span className="text-[9px] font-medium">تخطيط</span>
                          {isPinned && <span className="text-[9px] text-amber-600 font-bold">📌</span>}
                          {wasAdded && !isPinned && <span className="text-[9px] text-green-600 font-bold">✓</span>}
                        </div>
                        <p className="text-[10px] text-gray-700 leading-relaxed line-clamp-3 text-right" dir="rtl">
                          {q.layoutData?.lines.map(l => l.text ?? l.sadr ?? l.number ?? '').join(' ') ?? ''}
                        </p>
                      </div>
                    ) : isText ? (
                      <div className="px-2 py-2 min-h-[50px]">
                        <div className="flex items-center gap-1 text-blue-600 mb-1">
                          <Type className="w-3 h-3" />
                          <span className="text-[9px] font-medium">نص</span>
                          {isPinned && <span className="text-[9px] text-amber-600 font-bold">📌</span>}
                          {wasAdded && !isPinned && <span className="text-[9px] text-green-600 font-bold">✓</span>}
                        </div>
                        <p className="text-[10px] text-gray-700 leading-relaxed line-clamp-3 text-right pointer-events-none" dir="rtl">
                          {q.textContent}
                        </p>
                      </div>
                    ) : (
                      <div className="relative">
                        <img
                          src={q.imageData} alt="سؤال"
                          className="w-full object-contain object-top pointer-events-none"
                          style={{ maxHeight: 90 }}
                          draggable={false}
                        />
                        {isPinned && (
                          <div className="absolute top-1 right-6 bg-amber-400 text-white text-[8px] font-bold px-1 py-0.5 rounded">📌</div>
                        )}
                        {wasAdded && !isPinned && (
                          <div className="absolute top-1 right-1 bg-green-500 text-white text-[8px] font-bold px-1 py-0.5 rounded">✓</div>
                        )}
                      </div>
                    )}
                     {/* Bottom row */}
                     <div className="relative flex items-center justify-between px-1.5 py-1 border-t border-border/50 gap-1">
                       <div className="flex items-center gap-0.5 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
                         <GripHorizontal className="w-3 h-3" />
                         <span className="text-[8px]">اسحب</span>
                       </div>

                       <button
                         className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                           wasAdded
                             ? 'text-green-700 bg-green-50 hover:bg-green-100'
                             : 'text-primary hover:bg-primary/10'
                         }`}
                         title={wasAdded ? 'أُضيف — انقر لإضافة مرة أخرى' : 'إضافة للمشروع'}
                         onClick={async e => {
                           e.stopPropagation();
                           if (projectPageCount <= 1) {
                             await addToPage(0);
                           } else {
                             setPagePickerQId(prev => prev === q.id ? null : q.id!);
                           }
                         }}
                       >
                         <PlusCircle className="w-3 h-3" />
                         <span>{wasAdded ? (projectPageCount > 1 ? '+ مرة أخرى ▾' : '+ مرة أخرى') : (projectPageCount > 1 ? 'أضف ▾' : 'أضف')}</span>
                       </button>

                       {/* Page picker dropdown */}
                       {pagePickerQId === q.id && (
                         <div
                           className="absolute bottom-full left-0 mb-1 bg-white border border-border shadow-xl rounded-lg p-1.5 z-50 flex flex-col gap-0.5 min-w-[90px]"
                           onClick={e => e.stopPropagation()}
                         >
                           <p className="text-[9px] text-muted-foreground px-1 mb-0.5 font-medium">اختر الصفحة:</p>
                           {projectPageCount <= 10
                             ? Array.from({ length: projectPageCount }, (_, i) => (
                               <button
                                 key={i}
                                 className="text-[10px] px-2 py-1 hover:bg-primary/10 hover:text-primary rounded text-right transition-colors"
                                 onClick={async () => { setPagePickerQId(null); await addToPage(i); }}
                               >
                                 صفحة {i + 1}
                               </button>
                             ))
                             : null
                           }
                           <div className={`${projectPageCount <= 10 ? 'border-t border-border/50 mt-0.5 pt-1.5' : ''} px-1`}>
                             {projectPageCount > 10 && (
                               <p className="text-[9px] text-muted-foreground mb-1">اكتب رقم الصفحة (1–{projectPageCount}):</p>
                             )}
                             <input
                               autoFocus={projectPageCount > 10}
                               type="number" min={1} max={projectPageCount}
                               placeholder={`1 – ${projectPageCount}`}
                               className="w-full border border-border rounded text-[10px] px-1.5 py-0.5 outline-none focus:ring-1 ring-primary/30 bg-white"
                               onKeyDown={async e => {
                                 if (e.key !== 'Enter') return;
                                 const n = parseInt((e.target as HTMLInputElement).value);
                                 if (isNaN(n) || n < 1 || n > projectPageCount) return;
                                 setPagePickerQId(null);
                                 await addToPage(n - 1);
                               }}
                             />
                           </div>
                         </div>
                       )}
                     </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Page picker with type input ── */}

      {/* Training status footer */}
      {selectedDoc?.training && mode === 'idle' && (
        <div className="shrink-0 border-t bg-green-50 px-4 py-1.5 text-xs text-green-800 flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 shrink-0" />
          <span>مُدرَّب — ارتفاع: {selectedDoc.training.questionHeightPct.toFixed(1)}%، فجوة: {selectedDoc.training.questionGapPct.toFixed(1)}%</span>
        </div>
      )}

      {/* ── Selection-method / content-type dialog ── */}
      {false && pendingModeChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPendingModeChoice(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h2 className="font-bold text-sm">
                {pendingModeChoice === 'training' ? '🎯 خيارات التدريب' : '📷 خيارات الالتقاط اليدوي'}
              </h2>
              <button onClick={() => setPendingModeChoice(null)}
                className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">طريقة التحديد</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'box', label: 'مربع شفاف', hint: '٦ نقاط للتحكم' },
                    { id: 'freeform', label: 'رسم حر', hint: 'زر الفأرة الأيمن' },
                    { id: 'polygon', label: 'نقاط', hint: 'قريباً' },
                  ] as const).map(o => (
                    <button key={o.id}
                      onClick={() => setSelectionMethod(o.id)}
                      className={cn(
                        'border rounded-lg p-2 text-center transition-all',
                        selectionMethod === o.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border hover:border-primary/40'
                      )}>
                      <div className="text-xs font-medium">{o.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{o.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              {pendingModeChoice === 'manual' && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">نوع المحتوى المُلتقَط</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'image', label: 'صورة', hint: 'كما يظهر' },
                      { id: 'text', label: 'نص', hint: 'OCR' },
                      { id: 'rich-layout', label: 'تخطيط', hint: 'نص + بنية' },
                    ] as const).map(o => (
                      <button key={o.id}
                        onClick={() => setManualCaptureType(o.id)}
                        className={cn(
                          'border rounded-lg p-2 text-center transition-all',
                          manualCaptureType === o.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border hover:border-primary/40'
                        )}>
                        <div className="text-xs font-medium">{o.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{o.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={() => setPendingModeChoice(null)}>إلغاء</Button>
                <Button size="sm" onClick={confirmModeChoice}>ابدأ</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Doc picker modal ── */}
      {docPickerOpen && (
        <DocPickerModal
          documents={documents ?? []}
          categories={categories}
          project={project ?? null}
          selectedDocId={selectedDocId}
          searchTerm={docSearchTerm}
          filterCat={docFilterCat}
          onSearchChange={setDocSearchTerm}
          onFilterChange={setDocFilterCat}
          onSelect={id => {
            setSelectedDocId(id);
            setMode('idle');
            setDetectedBoxes([]); setTrainingSamples([]);
            setManualBoxes([]); setCapturedThisSession([]);
            setCaptureTarget(null);
            setDocPickerOpen(false);
          }}
          onClose={() => setDocPickerOpen(false)}
          onTogglePin={toggleDocPin}
        />
      )}

      {/* ── Capture choice dialog ── */}
      {captureTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.25)' }}
          onClick={() => setCaptureTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-5 w-80 flex flex-col gap-4"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <p className="font-bold text-base">كيف تريد الالتقاط؟</p>
              <p className="text-xs text-muted-foreground mt-1">
                 «صورة أصلية» هي الأدق وتحافظ على الحروف والتنسيق بلا إعادة كتابة
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Rich Layout — الوضع الجديد */}
              <button
                onClick={() => handleCapture('rich-layout')}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                <LayoutTemplate className="w-7 h-7 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">تخطيط</span>
                <span className="text-[9px] text-muted-foreground text-center leading-snug">يحافظ على الشكل والتنسيق</span>
              </button>

              {/* Image */}
              <button
                onClick={() => handleCapture('image')}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                <ImageIcon className="w-7 h-7 text-primary" />
                <span className="text-sm font-semibold">صورة</span>
                 <span className="text-[9px] text-muted-foreground text-center leading-snug">PNG مطابق للمصدر</span>
              </button>

              {/* Text (legacy) */}
              <button
                onClick={() => handleCapture('text')}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <Type className="w-7 h-7 text-gray-500" />
                <span className="text-sm font-semibold text-gray-600">نص</span>
                <span className="text-[9px] text-muted-foreground text-center leading-snug">نص مسطح (قديم)</span>
              </button>
            </div>

            <button
              onClick={() => setCaptureTarget(null)}
              className="absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DocPickerModal ────────────────────────────────────────────────────────────
function DocItem({
  doc, isSelected, onSelect, highlight, isPinned, onTogglePin,
}: {
  doc: LocalDocument; isSelected: boolean; onSelect: (id: number) => void; highlight?: boolean;
  isPinned?: boolean; onTogglePin?: (id: number) => void;
}) {
  return (
    <div className={[
      'w-full flex items-center gap-2 px-3 py-2.5 border-b border-border/30 transition-colors',
      isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50',
      highlight ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : '',
    ].join(' ')}>
      <button
        onClick={() => onSelect(doc.id!)}
        className="flex-1 min-w-0 text-right"
      >
        <p className="text-xs font-medium truncate flex items-center gap-1">
          {doc.name}{doc.training ? ' 🧠' : ''}
          {isSelected && <Check className="inline w-3 h-3 text-primary flex-shrink-0" />}
        </p>
        {doc.category && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
            <Tag className="w-2.5 h-2.5 flex-shrink-0" />{doc.category}
          </p>
        )}
      </button>
      {onTogglePin && (
        <button
          onClick={e => { e.stopPropagation(); onTogglePin(doc.id!); }}
          title={isPinned ? 'إزالة من مستندات المشروع' : 'تثبيت في مستندات المشروع'}
          className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors text-sm ${
            isPinned ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground/20 hover:text-amber-400'
          }`}
        >
          📌
        </button>
      )}
    </div>
  );
}

function DocPickerModal({
  documents, categories, project, selectedDocId,
  searchTerm, filterCat,
  onSearchChange, onFilterChange, onSelect, onClose, onTogglePin,
}: {
  documents: LocalDocument[];
  categories: string[];
  project: LocalProject | null;
  selectedDocId: number | null;
  searchTerm: string;
  filterCat: string;
  onSearchChange: (s: string) => void;
  onFilterChange: (c: string) => void;
  onSelect: (id: number) => void;
  onClose: () => void;
  onTogglePin?: (docId: number) => void;
}) {
  const allowedIds = new Set(project?.allowedDocIds ?? []);
  const hasAllowed = allowedIds.size > 0;

  const allDocCats = [...new Set(documents.map(d => d.category).filter(Boolean))] as string[];
  const allCats = [...new Set([...categories, ...allDocCats])];

  const matchesSearch = (d: LocalDocument) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase());
  const matchesCat = (d: LocalDocument) =>
    filterCat === 'all' || d.category === filterCat ||
    (filterCat === '__project__' && allowedIds.has(d.id!)) ||
    (filterCat === '__none__' && !d.category);

  const projectDocs = hasAllowed
    ? documents.filter(d => allowedIds.has(d.id!) && matchesSearch(d))
    : [];
  const otherDocs = documents.filter(d =>
    (!hasAllowed || !allowedIds.has(d.id!)) && matchesSearch(d) && matchesCat(d)
  );
  const projectFilteredDocs = filterCat === '__project__'
    ? documents.filter(d => allowedIds.has(d.id!) && matchesSearch(d))
    : [];

  const isEmpty = filterCat === '__project__'
    ? projectFilteredDocs.length === 0
    : (projectDocs.length === 0 && otherDocs.length === 0);

  return (
    <div className="fixed inset-0 z-50" dir="rtl" onClick={onClose}>
      <div
        className="absolute top-12 right-0 w-72 bg-background border border-border shadow-2xl rounded-lg flex flex-col overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 64px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search */}
        <div className="p-2 border-b bg-background">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="بحث في المستندات..."
              className="w-full pr-7 pl-2 py-1.5 text-xs border border-border rounded-md outline-none focus:ring-2 ring-primary/30 bg-background"
            />
          </div>
        </div>

        {/* Category filter dropdown */}
        {(allCats.length > 0 || hasAllowed) && (
          <div className="px-2 py-1.5 border-b bg-muted/10">
            <select
              dir="rtl"
              value={filterCat}
              onChange={e => onFilterChange(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-[11px] bg-background outline-none focus:ring-1 ring-primary/30"
            >
              {hasAllowed && <option value="__project__">مستندات المشروع ({allowedIds.size})</option>}
              <option value="all">الكل</option>
              {allCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        )}

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto">
          {filterCat === '__project__' ? (
            projectFilteredDocs.length === 0
              ? <p className="text-center text-xs text-muted-foreground py-8">لا توجد مستندات مطابقة</p>
              : projectFilteredDocs.map(doc => (
                <DocItem key={doc.id} doc={doc} isSelected={selectedDocId === doc.id} onSelect={onSelect} highlight
                  isPinned={allowedIds.has(doc.id!)} onTogglePin={onTogglePin} />
              ))
          ) : (
            <>
              {/* Project docs first */}
              {projectDocs.length > 0 && (
                <>
                  <div className="px-3 py-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50/80 dark:bg-emerald-900/20 border-b border-border/30 sticky top-0">
                    مستندات المشروع 📌
                  </div>
                  {projectDocs.map(doc => (
                    <DocItem key={doc.id} doc={doc} isSelected={selectedDocId === doc.id} onSelect={onSelect} highlight
                      isPinned={true} onTogglePin={onTogglePin} />
                  ))}
                </>
              )}
              {/* Other docs */}
              {otherDocs.length > 0 && (
                <>
                  {hasAllowed && otherDocs.length > 0 && (
                    <div className="px-3 py-1 text-[9px] font-semibold text-muted-foreground bg-muted/30 border-b border-border/30 sticky top-0">
                      مستندات أخرى
                    </div>
                  )}
                  {otherDocs.map(doc => (
                    <DocItem key={doc.id} doc={doc} isSelected={selectedDocId === doc.id} onSelect={onSelect}
                      isPinned={false} onTogglePin={onTogglePin} />
                  ))}
                </>
              )}
              {isEmpty && (
                <p className="text-center text-xs text-muted-foreground py-8">لا توجد مستندات مطابقة</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
