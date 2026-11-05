/**
 * Advanced Document Analyzer — Viewer
 *
 * Renders a PDF page to a canvas and overlays the geometric model
 * (margins, columns, whitespace gaps, text-blocks, images, frames)
 * produced by src/lib/analyzer. Users can toggle layers on/off,
 * pick a page, click an element to inspect all extracted properties,
 * and trigger OCR for scanned pages.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalDocument } from '@/lib/db';
import {
  loadPdfFromArrayBuffer,
  analyzePdfPage,
  ocrPageImage,
  enrichAnalysisWithOcr,
  segmentPageByInk,
  detectQuestions,
  type PageAnalysis,
  type PageElement,
  type QuestionCandidate,
} from '@/lib/analyzer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  ScanText,
  Home,
  Layers,
  Sparkles,
  Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LayerToggles {
  margins: boolean;
  columns: boolean;
  whitespace: boolean;
  text: boolean;
  textBlocks: boolean;
  images: boolean;
  frames: boolean;
  lines: boolean;
  peripherals: boolean;
  questions: boolean;
}

const DEFAULT_LAYERS: LayerToggles = {
  margins: true,
  columns: true,
  whitespace: false,
  text: false,
  textBlocks: false,
  images: true,
  frames: true,
  lines: true,
  peripherals: true,
  questions: true,
};

const LAYER_LABELS: Record<keyof LayerToggles, string> = {
  margins: 'الهوامش',
  columns: 'الأعمدة',
  whitespace: 'الفراغات البيضاء',
  text: 'كلمات النص',
  textBlocks: 'كتل النص',
  images: 'الصور',
  frames: 'الإطارات',
  lines: 'الخطوط الفاصلة',
  peripherals: 'الترويسة / التذييل / الترقيم',
  questions: 'الأسئلة المكتشفة (AI)',
};

export default function DocumentAnalyzerPage() {
  const [match, params] = useRoute<{ docId: string }>('/analyzer/:docId');
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const docId = match ? Number(params.docId) : NaN;
  const document = useLiveQuery<LocalDocument | undefined>(
    () => (Number.isFinite(docId) ? db.documents.get(docId) : undefined),
    [docId],
  );

  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [analysis, setAnalysis] = useState<PageAnalysis | null>(null);
  const [questions, setQuestions] = useState<QuestionCandidate[]>([]);
  const [savingAll, setSavingAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ocring, setOcring] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerToggles>(DEFAULT_LAYERS);
  const [zoom, setZoom] = useState(1.4);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const overlaySize = useRef({ width: 0, height: 0 });

  // Load PDF once per document
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!document) return;
      const pdf = await loadPdfFromArrayBuffer(document.fileData);
      if (cancelled) return;
      pdfRef.current = pdf;
      setTotalPages(pdf.numPages);
      setPageNumber(1);
    })().catch((e) => {
      console.error(e);
      toast({ title: 'تعذّر فتح الملف', description: String(e), variant: 'destructive' });
    });
    return () => {
      cancelled = true;
    };
  }, [document, toast]);

  // Render + analyze current page — renders at device-pixel-ratio for crisp output
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas || pageNumber < 1) return;
      setLoading(true);
      setSelectedId(null);
      setSelectedQuestionId(null);
      try {
        const page = await pdf.getPage(pageNumber);
        const dpr = Math.min(3, Math.max(2.25, window.devicePixelRatio || 1));
        const cssViewport = page.getViewport({ scale: zoom });
        const renderViewport = page.getViewport({ scale: zoom * dpr });
        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;
        canvas.style.width = `${cssViewport.width}px`;
        canvas.style.height = `${cssViewport.height}px`;
        overlaySize.current = { width: cssViewport.width, height: cssViewport.height };
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport: renderViewport, canvas }).promise;
        if (cancelled) return;
        const result = await analyzePdfPage(pdf, pageNumber);
        if (cancelled) return;
        setAnalysis(result);
        // Phase 4–7: auto-detect question candidates via the scoring engine
        try {
          let detected = detectQuestions(result, { minStartScore: 2.2 });
          if (detected.length === 0) {
            detected = segmentPageByInk(canvas, result.geometry).map((bbox, index) => ({
              id: `visual_${pageNumber}_${index}`,
              index: index + 1,
              bbox,
              stemBlockId: '', choiceBlockIds: [], imageIds: [], noteBlockIds: [],
              confidence: 0.45,
              reasons: ['visual whitespace segmentation'],
            }));
          }
          setQuestions(detected);
        } catch (err) {
          console.warn('detectQuestions failed', err);
          setQuestions([]);
        }
      } catch (e) {
        console.error(e);
        toast({ title: 'خطأ في التحليل', description: String(e), variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNumber, zoom, totalPages, toast]);

  const selected = useMemo(
    () => analysis?.elements.find((e) => e.id === selectedId) ?? null,
    [analysis, selectedId],
  );

  const selectedQuestion = useMemo(
    () => questions.find((q) => q.id === selectedQuestionId) ?? null,
    [questions, selectedQuestionId],
  );

  /** Capture a lossless, pixel-faithful bbox from the current PDF render. */
  function captureBoxToPng(bbox: { x: number; y: number; width: number; height: number }): string | null {
    const canvas = canvasRef.current;
    const geo = analysis?.geometry;
    if (!canvas || !geo) return null;
    const sx = (bbox.x / geo.width) * canvas.width;
    const sy = (bbox.y / geo.height) * canvas.height;
    const sw = (bbox.width / geo.width) * canvas.width;
    const sh = (bbox.height / geo.height) * canvas.height;
    const out = window.document.createElement('canvas');
    out.width = Math.max(1, Math.round(sw));
    out.height = Math.max(1, Math.round(sh));
    const octx = out.getContext('2d');
    if (!octx) return null;
    octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }

  /** Send a detected question to the shared Question Bank (db.questions). */
  async function saveQuestion(q: QuestionCandidate) {
    if (!document?.id) return;
    const geo = analysis?.geometry;
    if (!geo) return;
    const img = captureBoxToPng(q.bbox);
    if (!img) return;
    await db.questions.add({
      contentType: 'image',
      imageData: img,
      sourceDocId: document.id,
      sourceDocName: document.name,
      sourcePage: pageNumber,
      regionX: (q.bbox.x / geo.width) * 100,
      regionY: (q.bbox.y / geo.height) * 100,
      regionW: (q.bbox.width / geo.width) * 100,
      regionH: (q.bbox.height / geo.height) * 100,
      createdAt: Date.now(),
    });
  }

  async function saveAllQuestions() {
    if (questions.length === 0) return;
    setSavingAll(true);
    try {
      for (const q of questions) await saveQuestion(q);
      toast({ title: `تم حفظ ${questions.length} سؤال في بنك الأسئلة` });
    } catch (e) {
      toast({ title: 'فشل الحفظ', description: String(e), variant: 'destructive' });
    } finally {
      setSavingAll(false);
    }
  }


  async function runOcr() {
    const canvas = canvasRef.current;
    if (!canvas || !analysis) return;
    setOcring(true);
    try {
      const words = await ocrPageImage(
        canvas,
        analysis.geometry.width,
        analysis.geometry.height,
      );
      const enriched = enrichAnalysisWithOcr(analysis, words);
      setAnalysis(enriched);
      const detected = detectQuestions(enriched, { minStartScore: 1.8 });
      setQuestions(detected.length > 0 ? detected : segmentPageByInk(canvas, enriched.geometry).map((bbox, index) => ({
        id: `visual_${pageNumber}_${index}`,
        index: index + 1,
        bbox,
        stemBlockId: '', choiceBlockIds: [], imageIds: [], noteBlockIds: [],
        confidence: 0.45,
        reasons: ['visual whitespace segmentation'],
      })));
      toast({ title: `تم التعرّف على ${words.length} كلمة وإعادة تحليل الصفحة` });
    } catch (e) {
      toast({ title: 'فشل OCR', description: String(e), variant: 'destructive' });
    } finally {
      setOcring(false);
    }
  }

  if (!match) return null;

  if (!document) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const geo = analysis?.geometry;
  const xToPx = (v: number) =>
    geo ? (v / geo.width) * overlaySize.current.width : v;
  const yToPx = (v: number) =>
    geo ? (v / geo.height) * overlaySize.current.height : v;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-muted/20" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b bg-background p-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
          <Home className="ml-1 h-4 w-4" /> المستندات
        </Button>
        <div className="mx-2 h-4 w-px bg-border" />
        <span className="text-sm font-medium">{document.name}</span>
        <div className="mx-2 h-4 w-px bg-border" />
        <Button
          variant="outline"
          size="sm"
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm">
          {pageNumber} / {totalPages || '…'}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={pageNumber >= totalPages}
          onClick={() => setPageNumber((p) => Math.min(totalPages, p + 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="mx-2 h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Label className="text-xs">التكبير</Label>
          <div className="w-32">
            <Slider
              value={[zoom]}
              min={0.6}
              max={3}
              step={0.1}
              onValueChange={(v) => setZoom(v[0])}
            />
          </div>
          <span className="w-10 text-xs tabular-nums">{zoom.toFixed(1)}×</span>
        </div>
        <div className="mx-2 h-4 w-px bg-border" />
        <Button
          variant="secondary"
          size="sm"
          onClick={runOcr}
          disabled={ocring || !analysis}
        >
          {ocring ? (
            <Loader2 className="ml-1 h-4 w-4 animate-spin" />
          ) : (
            <ScanText className="ml-1 h-4 w-4" />
          )}
          تعرّف OCR
        </Button>
        {geo?.isScanned && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
            صفحة ممسوحة ضوئيًا — استخدم OCR
          </span>
        )}
        <div className="mx-2 h-4 w-px bg-border" />
        <span className="text-xs text-muted-foreground">
          <Sparkles className="ml-1 inline h-3.5 w-3.5 text-emerald-600" />
          {questions.length} سؤال مكتشف
        </span>
        <Button
          variant="default"
          size="sm"
          onClick={saveAllQuestions}
          disabled={savingAll || questions.length === 0}
        >
          {savingAll ? (
            <Loader2 className="ml-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="ml-1 h-4 w-4" />
          )}
          إرسال إلى بنك الأسئلة
        </Button>
        {loading && <Loader2 className="mr-auto h-4 w-4 animate-spin" />}
      </div>


      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Layers panel */}
        <aside className="w-56 shrink-0 overflow-y-auto border-l bg-background p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4" /> الطبقات
          </div>
          <div className="space-y-2">
            {(Object.keys(LAYER_LABELS) as (keyof LayerToggles)[]).map((k) => (
              <div key={k} className="flex items-center justify-between">
                <Label className="text-xs">{LAYER_LABELS[k]}</Label>
                <Switch
                  checked={layers[k]}
                  onCheckedChange={(v) => setLayers((s) => ({ ...s, [k]: v }))}
                />
              </div>
            ))}
          </div>

          {geo && (
            <div className="mt-6 space-y-1 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">النموذج الهندسي</div>
              <div>
                الأبعاد: {geo.width.toFixed(0)} × {geo.height.toFixed(0)} pt
              </div>
              <div>الاتجاه: {geo.orientation === 'portrait' ? 'طولي' : 'عرضي'}</div>
              <div>الدوران: {geo.rotation}°</div>
              <div>
                الهوامش: ↑{geo.margins.top.toFixed(0)} ↓{geo.margins.bottom.toFixed(0)} ←
                {geo.margins.left.toFixed(0)} →{geo.margins.right.toFixed(0)}
              </div>
              <div>الأعمدة: {geo.columnCount}</div>
              <div>عناصر النص: {analysis?.elements.filter(e => e.type === 'text').length ?? 0}</div>
              <div>كتل: {analysis?.elements.filter(e => e.type === 'text-block').length ?? 0}</div>
              <div>صور: {analysis?.elements.filter(e => e.type === 'image').length ?? 0}</div>
              <div>إطارات: {analysis?.elements.filter(e => e.type === 'frame').length ?? 0}</div>
              <div>خطوط: {analysis?.elements.filter(e => e.type === 'line').length ?? 0}</div>
            </div>
          )}
        </aside>

        {/* Canvas + overlay */}
        <div className="min-w-0 flex-1 overflow-auto p-6">
          <div className="relative mx-auto inline-block shadow-lg">
            <canvas ref={canvasRef} className="block bg-white" />
            {analysis && (
              <svg
                className="pointer-events-none absolute inset-0"
                width={overlaySize.current.width}
                height={overlaySize.current.height}
                viewBox={`0 0 ${overlaySize.current.width} ${overlaySize.current.height}`}
              >
                {/* Margins */}
                {layers.margins && geo && (
                  <rect
                    x={xToPx(geo.margins.left)}
                    y={yToPx(geo.margins.top)}
                    width={xToPx(geo.width - geo.margins.left - geo.margins.right)}
                    height={yToPx(geo.height - geo.margins.top - geo.margins.bottom)}
                    fill="none"
                    stroke="rgb(59 130 246 / 0.7)"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                  />
                )}
                {/* Columns */}
                {layers.columns &&
                  geo?.columns.map((col) => (
                    <rect
                      key={col.index}
                      x={xToPx(col.x)}
                      y={yToPx(geo.margins.top)}
                      width={xToPx(col.width)}
                      height={yToPx(geo.height - geo.margins.top - geo.margins.bottom)}
                      fill="rgb(168 85 247 / 0.06)"
                      stroke="rgb(168 85 247 / 0.4)"
                      strokeWidth={1}
                    />
                  ))}
                {/* Whitespace gaps */}
                {layers.whitespace &&
                  geo?.whitespace.map((g, i) => (
                    <rect
                      key={i}
                      x={xToPx(geo.margins.left)}
                      y={yToPx(g.start)}
                      width={xToPx(geo.width - geo.margins.left - geo.margins.right)}
                      height={yToPx(g.size)}
                      fill="rgb(250 204 21 / 0.18)"
                    />
                  ))}
                {/* Elements */}
                {analysis.elements.map((el) => {
                  const show = shouldShow(el, layers, geo);
                  if (!show) return null;
                  const color = colorFor(el, geo);
                  const isSel = selectedId === el.id;
                  return (
                    <g
                      key={el.id}
                      className="pointer-events-auto cursor-pointer"
                      onClick={() => setSelectedId(el.id)}
                    >
                      <rect
                         x={xToPx(el.bbox.x)}
                         y={yToPx(el.bbox.y)}
                         width={xToPx(el.bbox.width)}
                         height={yToPx(el.bbox.height)}
                        fill={isSel ? 'rgb(34 197 94 / 0.25)' : color.fill}
                        stroke={isSel ? 'rgb(22 163 74)' : color.stroke}
                        strokeWidth={isSel ? 2 : 1}
                      />
                    </g>
                  );
                })}
                {/* Detected question boxes — Phase 4–7 scoring engine */}
                {layers.questions && questions.map((q) => {
                  const isSel = selectedQuestionId === q.id;
                  const hi = q.confidence >= 0.7;
                  const med = q.confidence >= 0.5;
                  const stroke = hi
                    ? 'rgb(16 185 129)'   // green
                    : med
                    ? 'rgb(234 179 8)'    // amber
                    : 'rgb(239 68 68)';   // red
                  return (
                    <g
                      key={q.id}
                      className="pointer-events-auto cursor-pointer"
                      onClick={() => setSelectedQuestionId(q.id)}
                    >
                      <rect
                        x={xToPx(q.bbox.x)}
                        y={yToPx(q.bbox.y)}
                        width={xToPx(q.bbox.width)}
                        height={yToPx(q.bbox.height)}
                        fill={isSel ? 'rgb(16 185 129 / 0.18)' : 'transparent'}
                        stroke={stroke}
                        strokeWidth={isSel ? 3 : 2}
                        strokeDasharray={isSel ? undefined : '6 3'}
                      />
                      <rect
                        x={xToPx(q.bbox.x)}
                        y={yToPx(q.bbox.y) - 18}
                        width={70}
                        height={18}
                        fill={stroke}
                      />
                      <text
                        x={xToPx(q.bbox.x) + 6}
                        y={yToPx(q.bbox.y) - 5}
                        fill="white"
                        fontSize={11}
                        fontWeight={700}
                      >
                        Q{q.index} · {Math.round(q.confidence * 100)}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>


        {/* Right sidebar — question inspector + element details */}
        <aside className="w-80 shrink-0 space-y-4 overflow-y-auto border-r bg-background p-3">
          {/* Detected question inspector */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              السؤال المكتشف
            </div>
            {!selectedQuestion && (
              <p className="text-xs text-muted-foreground">
                اضغط على أي إطار أخضر/أصفر داخل الصفحة لرؤية تحليل السؤال ودرجة الثقة.
              </p>
            )}
            {selectedQuestion && (
              <div className="space-y-2 text-xs">
                <PropertyRow k="الترتيب" v={`Q${selectedQuestion.index}`} />
                {selectedQuestion.number && (
                  <PropertyRow k="الرقم في الصفحة" v={selectedQuestion.number} />
                )}
                <PropertyRow
                  k="الثقة"
                  v={`${Math.round(selectedQuestion.confidence * 100)}%`}
                />
                <PropertyRow k="اختيارات" v={String(selectedQuestion.choiceBlockIds.length)} />
                <PropertyRow k="صور مرتبطة" v={String(selectedQuestion.imageIds.length)} />
                <PropertyRow k="ملاحظات" v={String(selectedQuestion.noteBlockIds.length)} />
                <div className="rounded border p-2">
                  <div className="mb-1 font-semibold">مؤشرات التقييم</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedQuestion.reasons.map((r, i) => (
                      <span
                        key={i}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10px]"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    await saveQuestion(selectedQuestion);
                    toast({ title: 'أُضيف إلى بنك الأسئلة' });
                  }}
                >
                  <Save className="ml-1 h-4 w-4" />
                  حفظ هذا السؤال
                </Button>
              </div>
            )}
          </div>

          <div className="h-px w-full bg-border" />

          {/* Element details */}
          <div>
            <div className="mb-2 text-sm font-semibold">تفاصيل العنصر</div>
          {!selected && (
            <p className="text-xs text-muted-foreground">
              اضغط على أي عنصر داخل الصفحة لعرض خصائصه الهندسية والطباعية.
            </p>
          )}
          {selected && (
            <div className="space-y-3 text-xs">
              <PropertyRow k="النوع" v={selected.type} />
              <PropertyRow k="ID" v={selected.id} />
              <PropertyRow k="المصدر" v={selected.source} />
              {selected.text && (
                <Card className="max-h-32 overflow-auto p-2 text-xs" dir="auto">
                  {selected.text}
                </Card>
              )}
              <div className="grid grid-cols-2 gap-2">
                <PropertyRow k="X" v={selected.bbox.x.toFixed(1)} />
                <PropertyRow k="Y" v={selected.bbox.y.toFixed(1)} />
                <PropertyRow k="العرض" v={selected.bbox.width.toFixed(1)} />
                <PropertyRow k="الارتفاع" v={selected.bbox.height.toFixed(1)} />
                <PropertyRow k="الدوران" v={`${selected.rotation.toFixed(1)}°`} />
                <PropertyRow k="التكبير" v={selected.scale.toFixed(2)} />
              </div>
              {selected.baseline !== undefined && (
                <PropertyRow k="Baseline" v={selected.baseline.toFixed(1)} />
              )}
              {selected.font && (
                <div className="space-y-1 rounded border p-2">
                  <div className="font-semibold">الخط</div>
                  <PropertyRow k="العائلة" v={selected.font.fontFamily ?? '—'} />
                  <PropertyRow k="الاسم" v={selected.font.fontName ?? '—'} />
                  <PropertyRow k="الحجم" v={`${selected.font.fontSize.toFixed(1)} pt`} />
                  <PropertyRow k="الوزن" v={selected.font.fontWeight} />
                  <PropertyRow k="مائل" v={selected.font.italic ? 'نعم' : 'لا'} />
                  <PropertyRow k="الاتجاه" v={selected.font.direction} />
                </div>
              )}
              {selected.childIds && selected.childIds.length > 0 && (
                <PropertyRow k="عناصر ابن" v={String(selected.childIds.length)} />
              )}
            </div>
          )}
          </div>
        </aside>

      </div>
    </div>
  );
}

function PropertyRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate font-mono" dir="ltr">
        {v}
      </span>
    </div>
  );
}

function shouldShow(
  el: PageElement,
  layers: LayerToggles,
  geo: PageAnalysis['geometry'] | undefined,
): boolean {
  if (!geo) return false;
  const isPeripheral =
    geo.headerIds.includes(el.id) ||
    geo.footerIds.includes(el.id) ||
    geo.pageNumberIds.includes(el.id) ||
    geo.watermarkIds.includes(el.id);
  if (isPeripheral && !layers.peripherals) return false;
  switch (el.type) {
    case 'text':
      return layers.text;
    case 'text-block':
      return layers.textBlocks;
    case 'image':
      return layers.images;
    case 'frame':
      return layers.frames;
    case 'line':
      return layers.lines;
    default:
      return false;
  }
}

function colorFor(
  el: PageElement,
  geo: PageAnalysis['geometry'] | undefined,
): { fill: string; stroke: string } {
  if (geo?.watermarkIds.includes(el.id))
    return { fill: 'rgb(244 63 94 / 0.08)', stroke: 'rgb(244 63 94 / 0.6)' };
  if (geo?.headerIds.includes(el.id) || geo?.footerIds.includes(el.id))
    return { fill: 'rgb(14 165 233 / 0.08)', stroke: 'rgb(14 165 233 / 0.5)' };
  switch (el.type) {
    case 'text':
      return { fill: 'rgb(148 163 184 / 0.10)', stroke: 'rgb(100 116 139 / 0.5)' };
    case 'text-block':
      return { fill: 'rgb(16 185 129 / 0.08)', stroke: 'rgb(5 150 105 / 0.6)' };
    case 'image':
      return { fill: 'rgb(249 115 22 / 0.10)', stroke: 'rgb(234 88 12 / 0.7)' };
    case 'frame':
      return { fill: 'transparent', stroke: 'rgb(168 85 247 / 0.6)' };
    case 'line':
      return { fill: 'rgb(30 41 59 / 0.6)', stroke: 'rgb(30 41 59 / 0.6)' };
    default:
      return { fill: 'transparent', stroke: 'rgb(148 163 184 / 0.4)' };
  }
}
