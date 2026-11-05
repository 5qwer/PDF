// ─── مستخرج قوالب الأشكال من PDF/صور ─────────────────────────────────────────
// يستقبل ملف PDF أو صورة، يسمح باختيار الصفحة، وقص المستطيل، ومسح النصوص
// بمستطيلات شفافة، ثم إزالة الخلفية البيضاء، ثم حفظ الشكل كقالب قابل لإعادة الاستخدام.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Upload, Crop, Eraser, Save, Plus, Loader2, ImageIcon, FileText } from 'lucide-react';
import { db, type DesignerFrame } from '@/lib/db';

interface Props {
  open: boolean;
  onClose: () => void;
  /** إدراج الشكل مباشرة في التصميم الحالي */
  onInsert: (imageSrc: string, aspectRatio: number, name: string) => void;
  subject?: string;
}

type Tool = 'crop' | 'erase';
interface Rect { x: number; y: number; w: number; h: number }

// ─── تحويل ملف صورة إلى Image ─────────────────────────────────────────────────
async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('فشل تحميل الصورة'));
      img.src = url;
    });
    return img;
  } finally {
    // لا تُلغِ الرابط قبل نسخ الصورة إلى canvas — سنلغيه لاحقًا
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

// ─── رسم صفحات PDF إلى كانفس صور مصغّرة ──────────────────────────────────────
async function loadPdfPages(file: File): Promise<HTMLCanvasElement[]> {
  const pdfjs: any = await import('pdfjs-dist');
  try {
    // @ts-ignore
    const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = (worker as any).default;
  } catch {}
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: HTMLCanvasElement[] = [];
  const maxPages = Math.min(doc.numPages, 30);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.6 * (window.devicePixelRatio || 1) });
    const c = document.createElement('canvas');
    c.width = viewport.width;
    c.height = viewport.height;
    const ctx = c.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(c);
  }
  return pages;
}

// ─── معالجة نهائية: مسح مستطيلات + قص + إزالة خلفية ─────────────────────────
function processCanvas(
  source: HTMLCanvasElement | HTMLImageElement,
  cropRect: Rect | null,
  eraseRects: Rect[],
  threshold: number,
): { dataUrl: string; ratio: number } {
  const sw = 'width' in source ? source.width : (source as HTMLImageElement).naturalWidth;
  const sh = 'height' in source ? source.height : (source as HTMLImageElement).naturalHeight;
  const rect = cropRect ?? { x: 0, y: 0, w: sw, h: sh };
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(rect.w));
  out.height = Math.max(1, Math.round(rect.h));
  const ctx = out.getContext('2d')!;
  ctx.drawImage(source as any, rect.x, rect.y, rect.w, rect.h, 0, 0, out.width, out.height);
  // امسح مستطيلات النصوص (اجعلها شفافة)
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (const e of eraseRects) {
    const ex = e.x - rect.x;
    const ey = e.y - rect.y;
    if (ex + e.w < 0 || ey + e.h < 0) continue;
    ctx.fillStyle = '#000';
    ctx.fillRect(ex, ey, e.w, e.h);
  }
  ctx.restore();
  // أزل الخلفية شبه البيضاء
  if (threshold < 255) {
    const data = ctx.getImageData(0, 0, out.width, out.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      if (r > threshold && g > threshold && b > threshold) px[i + 3] = 0;
    }
    ctx.putImageData(data, 0, 0);
  }
  return { dataUrl: out.toDataURL('image/png'), ratio: out.width / out.height };
}

// ─── المكوّن الرئيسي ──────────────────────────────────────────────────────────
export default function FrameExtractor({ open, onClose, onInsert, subject }: Props) {
  const [step, setStep] = useState<'pick' | 'pages' | 'edit'>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<HTMLCanvasElement[] | null>(null);
  const [source, setSource] = useState<HTMLCanvasElement | HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>('crop');
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [eraseRects, setEraseRects] = useState<Rect[]>([]);
  const [threshold, setThreshold] = useState(230);
  const [name, setName] = useState('');
  const [savedFrames, setSavedFrames] = useState<DesignerFrame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; active: boolean } | null>(null);

  // ─── تحميل الإطارات المحفوظة ──
  const refreshSaved = useCallback(async () => {
    const rows = await db.designerFrames.orderBy('createdAt').reverse().limit(80).toArray();
    setSavedFrames(rows);
  }, []);
  useEffect(() => { if (open) refreshSaved(); }, [open, refreshSaved]);

  // ─── إعادة الضبط عند الإغلاق ──
  useEffect(() => {
    if (!open) {
      setStep('pick'); setFile(null); setPdfPages(null); setSource(null);
      setCropRect(null); setEraseRects([]); setName(''); setError(null);
    }
  }, [open]);

  // ─── اختيار ملف ──
  const handleFile = useCallback(async (f: File) => {
    setError(null); setLoading(true); setFile(f);
    try {
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        const pages = await loadPdfPages(f);
        if (!pages.length) throw new Error('لا توجد صفحات في هذا الملف');
        setPdfPages(pages);
        setStep('pages');
      } else if (f.type.startsWith('image/')) {
        const img = await fileToImage(f);
        setSource(img);
        setName(f.name.replace(/\.[^.]+$/, ''));
        setStep('edit');
      } else {
        throw new Error('نوع الملف غير مدعوم — استخدم PDF أو صورة');
      }
    } catch (e: any) {
      setError(e?.message ?? 'فشل تحميل الملف');
    } finally {
      setLoading(false);
    }
  }, []);

  const pickPdfPage = useCallback((c: HTMLCanvasElement, idx: number) => {
    setSource(c);
    setName(`${file?.name?.replace(/\.pdf$/i, '') ?? 'إطار'} - صفحة ${idx + 1}`);
    setStep('edit');
  }, [file]);

  // ─── ارسم الكانفس مع طبقات ──
  useEffect(() => {
    if (step !== 'edit' || !source || !canvasRef.current) return;
    const c = canvasRef.current;
    const sw = 'naturalWidth' in source ? (source as HTMLImageElement).naturalWidth : source.width;
    const sh = 'naturalHeight' in source ? (source as HTMLImageElement).naturalHeight : source.height;
    // ضع حداً على العرض للعرض على الشاشة
    const maxW = 720; const scale = Math.min(1, maxW / sw);
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(source as any, 0, 0, c.width, c.height);
    // خلفية شطرنجية لتوضيح الشفافية بعد الحفظ
  }, [source, step]);

  // نسبة تحويل من إحداثيات الكانفس المعروض إلى إحداثيات المصدر
  const scaleFactor = useMemo(() => {
    if (!source || !canvasRef.current) return 1;
    const sw = 'naturalWidth' in source ? (source as HTMLImageElement).naturalWidth : source.width;
    return sw / canvasRef.current.width;
  }, [source, canvasRef.current?.width]);

  // ─── تعامل مع السحب لرسم مستطيل ──
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!overlayRef.current) return;
    const box = overlayRef.current.getBoundingClientRect();
    dragRef.current = { startX: e.clientX - box.left, startY: e.clientY - box.top, active: true };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current?.active || !overlayRef.current) return;
    const box = overlayRef.current.getBoundingClientRect();
    const cx = e.clientX - box.left, cy = e.clientY - box.top;
    const { startX, startY } = dragRef.current;
    const rect: Rect = {
      x: Math.min(startX, cx) * scaleFactor,
      y: Math.min(startY, cy) * scaleFactor,
      w: Math.abs(cx - startX) * scaleFactor,
      h: Math.abs(cy - startY) * scaleFactor,
    };
    if (tool === 'crop') setCropRect(rect);
    else if (tool === 'erase') {
      // معاينة حية لآخر مستطيل مسح
      setEraseRects(prev => {
        const arr = [...prev];
        if ((dragRef.current as any).pushed) arr[arr.length - 1] = rect;
        else { arr.push(rect); (dragRef.current as any).pushed = true; }
        return arr;
      });
    }
  };
  const handleMouseUp = () => { if (dragRef.current) { dragRef.current.active = false; (dragRef.current as any).pushed = false; } };

  // ─── إجراءات الحفظ/الإدراج ──
  const buildFinal = () => processCanvas(source!, cropRect, eraseRects, threshold);

  const insert = () => {
    if (!source) return;
    const { dataUrl, ratio } = buildFinal();
    onInsert(dataUrl, ratio, name || 'إطار مستخرج');
    onClose();
  };

  const saveToLibrary = async () => {
    if (!source) return;
    const { dataUrl, ratio } = buildFinal();
    await db.designerFrames.add({
      name: name || `إطار ${new Date().toLocaleDateString('ar')}`,
      imageSrc: dataUrl,
      aspectRatio: ratio,
      subject,
      createdAt: Date.now(),
    });
    await refreshSaved();
  };

  const deleteSaved = async (id?: number) => {
    if (id == null) return;
    await db.designerFrames.delete(id);
    await refreshSaved();
  };

  if (!open) return null;

  // ─── الرسم ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 bg-background border border-border rounded-xl shadow-2xl flex flex-col w-[900px] max-w-[96vw] max-h-[92vh] overflow-hidden">
        {/* رأس */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">✂️</span>
            <h2 className="font-bold text-sm">استخراج قوالب الأشكال من PDF أو صورة</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* ── منطقة العمل ────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {error && <div className="bg-destructive/10 text-destructive text-xs px-3 py-2">{error}</div>}

            {step === 'pick' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  اختر ملف PDF أو صورة تحتوي على شكل زخرفي/إطار تريد استخراجه. ستستطيع
                  اختيار جزء منه، مسح النصوص داخله، وحفظه كقالب لإعادة استخدامه في أي صفحة.
                </p>
                <div className="flex gap-3">
                  <label className="cursor-pointer">
                    <input type="file" accept="application/pdf" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                    <span className="inline-flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg hover:bg-muted text-sm">
                      <FileText className="w-4 h-4" /> ملف PDF
                    </span>
                  </label>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                    <span className="inline-flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg hover:bg-muted text-sm">
                      <ImageIcon className="w-4 h-4" /> صورة
                    </span>
                  </label>
                </div>
                {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> جارٍ التحميل…</div>}
              </div>
            )}

            {step === 'pages' && pdfPages && (
              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-xs text-muted-foreground mb-3">اختر الصفحة التي تحتوي على الشكل المطلوب:</p>
                <div className="grid grid-cols-4 gap-3">
                  {pdfPages.map((c, i) => (
                    <button key={i} onClick={() => pickPdfPage(c, i)}
                      className="border border-border rounded hover:border-primary hover:shadow transition-all bg-white overflow-hidden">
                      <img src={c.toDataURL('image/jpeg', 0.7)} alt={`صفحة ${i + 1}`} className="w-full h-auto block" />
                      <div className="text-[10px] py-1 text-center text-muted-foreground">صفحة {i + 1}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'edit' && source && (
              <>
                {/* شريط الأدوات */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20 flex-wrap">
                  <div className="flex gap-1">
                    <Button size="sm" variant={tool === 'crop' ? 'default' : 'outline'} onClick={() => setTool('crop')} className="h-7 text-xs gap-1">
                      <Crop className="w-3 h-3" /> قصّ
                    </Button>
                    <Button size="sm" variant={tool === 'erase' ? 'default' : 'outline'} onClick={() => setTool('erase')} className="h-7 text-xs gap-1">
                      <Eraser className="w-3 h-3" /> مسح النصوص
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setCropRect(null); setEraseRects([]); }} className="h-7 text-xs">↺ إعادة ضبط</Button>
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-muted-foreground">إزالة الخلفية:</span>
                    <input type="range" min={180} max={255} value={threshold}
                      onChange={e => setThreshold(+e.target.value)} className="w-24 h-1" />
                    <span className="w-6 text-center">{threshold}</span>
                  </div>
                  <Input value={name} onChange={e => setName(e.target.value)}
                    placeholder="اسم الإطار" className="h-7 text-xs w-40" />
                </div>

                {/* منطقة الكانفس مع الطبقة */}
                <div className="flex-1 overflow-auto p-4 bg-[repeating-conic-gradient(#e5e7eb_0_25%,#f9fafb_0_50%)] bg-[length:16px_16px]">
                  <div className="relative inline-block" ref={overlayRef}
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                    style={{ cursor: tool === 'crop' ? 'crosshair' : 'cell' }}>
                    <canvas ref={canvasRef} className="block border border-border rounded shadow" />
                    {cropRect && (() => {
                      const inv = 1 / scaleFactor;
                      return <div className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
                        style={{ left: cropRect.x * inv, top: cropRect.y * inv, width: cropRect.w * inv, height: cropRect.h * inv }} />;
                    })()}
                    {eraseRects.map((r, i) => {
                      const inv = 1 / scaleFactor;
                      return <div key={i} className="absolute border border-destructive bg-destructive/30 pointer-events-none"
                        style={{ left: r.x * inv, top: r.y * inv, width: r.w * inv, height: r.h * inv }} />;
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {tool === 'crop' ? 'اسحب لتحديد منطقة القصّ (اختياري)' : 'اسحب لرسم مستطيلات فوق النصوص لمسحها. كرّر لكل نص.'}
                  </p>
                </div>

                {/* شريط الحفظ */}
                <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/20">
                  <Button size="sm" variant="outline" onClick={() => setStep(pdfPages ? 'pages' : 'pick')} className="h-8 text-xs">← رجوع</Button>
                  <div className="flex-1" />
                  <Button size="sm" variant="outline" onClick={saveToLibrary} className="h-8 text-xs gap-1">
                    <Save className="w-3 h-3" /> حفظ في مكتبتي
                  </Button>
                  <Button size="sm" onClick={insert} className="h-8 text-xs gap-1">
                    <Plus className="w-3 h-3" /> إدراج في التصميم
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* ── مكتبتي ─────────────────────────────────── */}
          <aside className="w-56 border-r border-border bg-muted/10 overflow-y-auto p-3 shrink-0">
            <p className="text-xs font-bold mb-2">قوالبي المحفوظة ({savedFrames.length})</p>
            {savedFrames.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">لا توجد قوالب بعد. استخرج شكلاً واضغط «حفظ في مكتبتي».</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {savedFrames.map(fr => (
                  <div key={fr.id} className="relative group border border-border rounded overflow-hidden bg-white">
                    <button className="w-full aspect-square flex items-center justify-center p-1"
                      title="إدراج" onClick={() => { onInsert(fr.imageSrc, fr.aspectRatio, fr.name); onClose(); }}>
                      <img src={fr.imageSrc} alt={fr.name} className="max-w-full max-h-full object-contain" />
                    </button>
                    <div className="text-[9px] text-center truncate px-1 pb-0.5 text-muted-foreground">{fr.name}</div>
                    <button onClick={() => deleteSaved(fr.id)}
                      className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 bg-destructive text-destructive-foreground rounded p-0.5"
                      title="حذف">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
