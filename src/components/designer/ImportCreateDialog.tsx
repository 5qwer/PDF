import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { db } from '@/lib/db';
import { DEFAULT_BACKGROUND } from '@/lib/designer-types';
import type { DesignerTemplate, DesignerPage } from '@/lib/designer-types';
import {
  Upload, X, Save, FolderOpen, Scissors, Image as ImageIcon,
  FileJson, Loader2, RefreshCcw, Check, Crop, Eye, Wand2,
  MousePointer2, SquareDashed, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

// إعداد PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ─── الصفوف والمواد ──────────────────────────────────────────────────────────
const GRADES = [
  '', 'الصف الأول الابتدائي', 'الصف الثاني الابتدائي', 'الصف الثالث الابتدائي',
  'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي',
  'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي',
  'الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي',
];
const SUBJECTS = [
  '', 'الرياضيات', 'اللغة العربية', 'العلوم', 'الفيزياء', 'الكيمياء', 'الأحياء',
  'التاريخ', 'الجغرافيا', 'اللغة الإنجليزية', 'الدراسات الاجتماعية',
  'التربية الدينية', 'الحاسب الآلي',
];

// ─── الإطارات والقوالب المضمنة ────────────────────────────────────────────────
const BUILTIN_FRAMES = [
  { id: 'labels-colored',   label: 'بطاقات ملونة',       src: '/frames/labels-colored.jpg' },
  { id: 'banners-rdb',      label: 'شرائط أحمر وأزرق',   src: '/frames/banners-red-blue.jpg' },
  { id: 'ribbon-frame',     label: 'إطار الشريط',         src: '/frames/ribbon-frame.jpg' },
  { id: 'bulletin-boards',  label: 'لوحات خشبية',         src: '/frames/bulletin-boards.png' },
  { id: 'hanging-board',    label: 'لوحة معلقة',          src: '/frames/hanging-board.png' },
  { id: 'golden-border',    label: 'إطار ذهبي صيني',      src: '/frames/golden-border.jpg' },
  { id: 'speech-bubble',    label: 'فقاعة كلام صفراء',   src: '/frames/speech-bubble.jpg' },
  { id: 'wood-hanging',     label: 'لافتة خشبية معلقة',  src: '/frames/wood-hanging.png' },
  { id: 'wood-boards',      label: 'لوحات خشبية متنوعة', src: '/frames/wood-boards.png' },
  { id: 'ribbon-red',       label: 'إطار شريط أحمر',     src: '/frames/ribbon-red.jpg' },
  { id: 'colorful-banners', label: 'شرائط ملونة',         src: '/frames/colorful-banners.jpg' },
  { id: 'frame-6',          label: 'إطار ٦',             src: '/frames/frame-6.jpg' },
  { id: 'frame-7',          label: 'إطار ٧',             src: '/frames/frame-7.jpg' },
  { id: 'frame-8',          label: 'إطار ٨',             src: '/frames/frame-8.jpg' },
  { id: 'frame-9',          label: 'إطار ٩',             src: '/frames/frame-9.jpg' },
  { id: 'frame-extra-1',    label: 'إطار إضافي ١',        src: '/frames/frame-extra-1.jpg' },
  { id: 'frame-extra-2',    label: 'إطار إضافي ٢',        src: '/frames/frame-extra-2.jpg' },
  { id: 'frame-extra-3',    label: 'إطار إضافي ٣',        src: '/frames/frame-extra-3.jpg' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeDefaultSettings() {
  return {
    size: 'A4' as const, unit: 'mm' as const, orientation: 'portrait' as const,
    backgroundType: 'blank' as const,
    margins: { top: 20, bottom: 20, left: 15, right: 15, linked: false },
  };
}

async function readAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

async function renderPdfFirstPage(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx as any, viewport, canvas: canvas as any }).promise;
  return canvas.toDataURL('image/jpeg', 0.9);
}

async function cropImageFromUrl(
  imageUrl: string,
  selPct: { x: number; y: number; w: number; h: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const { naturalWidth: iw, naturalHeight: ih } = img;
      const sx = Math.round((selPct.x / 100) * iw);
      const sy = Math.round((selPct.y / 100) * ih);
      const sw = Math.round((selPct.w / 100) * iw);
      const sh = Math.round((selPct.h / 100) * ih);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, sw);
      canvas.height = Math.max(1, sh);
      canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

/**
 * استخراج التصميم فقط من صورة — يُنتج صورة تحتوي فقط على العناصر الزخرفية
 * بإزالة المناطق ذات الكثافة النصية العالية (مناطق تباين متوسط بشكل موحد)
 */
async function extractDesignFromImage(
  imageUrl: string,
  selPct?: { x: number; y: number; w: number; h: number } | null
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const { naturalWidth: iw, naturalHeight: ih } = img;

      // تحديد منطقة العمل (كاملة أو مقصوصة)
      const sx = selPct ? Math.round((selPct.x / 100) * iw) : 0;
      const sy = selPct ? Math.round((selPct.y / 100) * ih) : 0;
      const sw = selPct ? Math.round((selPct.w / 100) * iw) : iw;
      const sh = selPct ? Math.round((selPct.h / 100) * ih) : ih;

      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = sw;
      srcCanvas.height = sh;
      const srcCtx = srcCanvas.getContext('2d')!;
      srcCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const imageData = srcCtx.getImageData(0, 0, sw, sh);
      const data = imageData.data;

      // زيادة تشبّع الألوان القوية (الإطارات) وإخفاء الألوان المحايدة (النص الأسود والرمادي)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        const lightness = (max + min) / 510;

        // إذا كان اللون داكن جداً أو رمادي جداً (نص أسود/رمادي) → اجعله شفافاً
        if (saturation < 0.15 && lightness < 0.75 && lightness > 0.1) {
          data[i + 3] = Math.round(data[i + 3] * 0.15); // شبه شفاف
        } else if (lightness > 0.92) {
          // خلفية بيضاء تقريباً → شفافة
          data[i + 3] = Math.round(data[i + 3] * 0.1);
        }
      }

      srcCtx.putImageData(imageData, 0, 0);

      const outCanvas = document.createElement('canvas');
      outCanvas.width = sw;
      outCanvas.height = sh;
      const outCtx = outCanvas.getContext('2d')!;
      outCtx.drawImage(srcCanvas, 0, 0);

      resolve(outCanvas.toDataURL('image/png', 1.0));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
interface ContextMenuState {
  x: number; y: number; imgX: number; imgY: number; visible: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  onStartEditing: (pages: DesignerPage[], meta?: any) => void;
}

export default function ImportCreateDialog({ open, onClose, onStartEditing }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // File state
  const [fileType, setFileType] = useState<'json' | 'image' | 'pdf' | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [jsonData, setJsonData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Template metadata
  const [templateName, setTemplateName] = useState('');
  const [templateGrade, setTemplateGrade] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');

  // Selection mode
  const [selectionMode, setSelectionMode] = useState<'drag' | 'box'>('drag');

  // Selection (in px relative to container div)
  const [isDragging, setIsDragging] = useState(false);
  const [selStartPx, setSelStartPx] = useState<{ x: number; y: number } | null>(null);
  const [selEndPx, setSelEndPx] = useState<{ x: number; y: number } | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // ── Display selection rect (in px within container) ──
  const displaySel = selStartPx && selEndPx ? {
    left:   Math.min(selStartPx.x, selEndPx.x),
    top:    Math.min(selStartPx.y, selEndPx.y),
    width:  Math.abs(selEndPx.x - selStartPx.x),
    height: Math.abs(selEndPx.y - selStartPx.y),
  } : null;

  const hasSelection = !!(selStartPx && selEndPx &&
    Math.abs(selEndPx.x - selStartPx.x) > 8 &&
    Math.abs(selEndPx.y - selStartPx.y) > 8);

  // ── Global mouse handlers while dragging ──
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const ctr = containerRef.current;
      if (!ctr) return;
      const rect = ctr.getBoundingClientRect();
      setSelEndPx({
        x: Math.max(0, Math.min(rect.width,  e.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
      });
    };
    const onUp = (e: MouseEvent) => {
      const ctr = containerRef.current;
      if (!ctr) return;
      const rect = ctr.getBoundingClientRect();
      setSelEndPx({
        x: Math.max(0, Math.min(rect.width,  e.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
      });
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  // ── Close context menu on outside click ──
  useEffect(() => {
    if (!contextMenu?.visible) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [contextMenu?.visible]);

  // ── Convert px selection to % of image ──
  const getSelectionAsPct = useCallback(() => {
    if (!selStartPx || !selEndPx) return null;
    const img = imgRef.current;
    const ctr = containerRef.current;
    if (!img || !ctr) return null;
    const imgRect = img.getBoundingClientRect();
    const ctrRect = ctr.getBoundingClientRect();
    const bounds = {
      left: imgRect.left - ctrRect.left,
      top:  imgRect.top  - ctrRect.top,
      w: imgRect.width,
      h: imgRect.height,
    };
    if (bounds.w === 0 || bounds.h === 0) return null;
    const selX = Math.min(selStartPx.x, selEndPx.x);
    const selY = Math.min(selStartPx.y, selEndPx.y);
    const selW = Math.abs(selEndPx.x - selStartPx.x);
    const selH = Math.abs(selEndPx.y - selStartPx.y);
    return {
      x: Math.max(0, ((selX - bounds.left) / bounds.w) * 100),
      y: Math.max(0, ((selY - bounds.top)  / bounds.h) * 100),
      w: Math.min(100, (selW / bounds.w) * 100),
      h: Math.min(100, (selH / bounds.h) * 100),
    };
  }, [selStartPx, selEndPx]);

  // ── Reset ──
  const reset = useCallback(() => {
    setFileType(null); setRawImageUrl(null); setJsonData(null);
    setTemplateName(''); setTemplateGrade(''); setTemplateSubject('');
    setSelStartPx(null); setSelEndPx(null); setIsDragging(false);
    setLoading(false); setSaving(false); setExtracting(false);
    setContextMenu(null);
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  // ── File handling ──
  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    setSelStartPx(null); setSelEndPx(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
    setTemplateName(nameWithoutExt);
    try {
      if (ext === 'json') {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed.pages && Array.isArray(parsed.pages)) {
          setJsonData(parsed);
          setFileType('json');
          if (parsed.meta?.name) setTemplateName(parsed.meta.name);
        } else {
          toast({ title: 'ملف JSON غير صالح — لا يحتوي على صفحات', variant: 'destructive' });
        }
      } else if (ext === 'pdf') {
        const dataUrl = await renderPdfFirstPage(file);
        setRawImageUrl(dataUrl);
        setFileType('pdf');
      } else {
        // Any other file → try as image
        const dataUrl = await readAsDataURL(file);
        setRawImageUrl(dataUrl);
        setFileType('image');
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'تعذّر تحميل الملف', description: 'تأكد من صحة الملف وحاول مرة أخرى.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ── Built-in frame selection ──
  const selectBuiltInFrame = useCallback(async (src: string, name: string) => {
    setLoading(true);
    setSelStartPx(null); setSelEndPx(null);
    setTemplateName(name);
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const dataUrl = await readAsDataURL(blob);
      setRawImageUrl(dataUrl);
      setFileType('image');
    } catch {
      toast({ title: 'فشل تحميل الإطار', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ── Image data (with or without selection) ──
  const getImageData = useCallback(async (useSelection: boolean): Promise<string | null> => {
    if (!rawImageUrl) return null;
    if (useSelection && hasSelection) {
      const sel = getSelectionAsPct();
      if (sel && sel.w > 1 && sel.h > 1) {
        return await cropImageFromUrl(rawImageUrl, sel);
      }
    }
    return rawImageUrl;
  }, [rawImageUrl, hasSelection, getSelectionAsPct]);

  // ── Extract design only (remove text) ──
  const handleExtractDesignOnly = useCallback(async (useSelection: boolean) => {
    if (!rawImageUrl) return;
    setExtracting(true);
    try {
      const selPct = useSelection && hasSelection ? getSelectionAsPct() : null;
      const designUrl = await extractDesignFromImage(rawImageUrl, selPct);

      const thumbnail = designUrl;
      const pages: DesignerPage[] = [{
        id: crypto.randomUUID(),
        settings: makeDefaultSettings(),
        elements: [],
        background: { ...DEFAULT_BACKGROUND, type: 'image', imageData: designUrl },
      }];

      const tpl: DesignerTemplate = {
        name: (templateName.trim() || 'تصميم مستخرج') + ' — تصميم فقط',
        description: 'تصميم مستخرج — بدون نصوص',
        category: templateGrade,
        subject: templateSubject,
        keywords: ['تصميم', 'استخراج'],
        thumbnail,
        pages,
        applyTo: 'all',
        linkedGrades: templateGrade ? [templateGrade] : [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        currentVersion: 1,
        versions: [],
      };
      await db.designerTemplates.add(tpl);
      toast({ title: '✅ تم استخراج التصميم وحفظه في المكتبة' });
      handleClose();
    } catch (err) {
      console.error(err);
      toast({ title: 'فشل استخراج التصميم', variant: 'destructive' });
    } finally {
      setExtracting(false);
    }
  }, [rawImageUrl, hasSelection, getSelectionAsPct, templateName, templateGrade, templateSubject, toast, handleClose]);

  // ── Save as template ──
  const saveAsTemplate = useCallback(async (useSelection: boolean) => {
    setSaving(true);
    try {
      let pages: DesignerPage[];
      let thumbnail: string | undefined;

      if (jsonData) {
        pages = jsonData.pages ?? [];
        thumbnail = undefined;
      } else {
        const imageData = await getImageData(useSelection);
        if (!imageData) { toast({ title: 'لا توجد صورة للحفظ', variant: 'destructive' }); return; }
        thumbnail = imageData;
        pages = [{
          id: crypto.randomUUID(),
          settings: makeDefaultSettings(),
          elements: [],
          background: { ...DEFAULT_BACKGROUND, type: 'image', imageData },
        }];
      }

      const tpl: DesignerTemplate = {
        name: templateName.trim() || 'قالب مستورد',
        description: '',
        category: templateGrade,
        subject: templateSubject,
        keywords: [],
        thumbnail,
        pages,
        applyTo: 'all',
        linkedGrades: templateGrade ? [templateGrade] : [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        currentVersion: 1,
        versions: [],
      };
      await db.designerTemplates.add(tpl);
      toast({ title: '✅ تم حفظ القالب في مكتبة الصفحات' });
      handleClose();
    } catch (err) {
      console.error(err);
      toast({ title: 'فشل الحفظ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [jsonData, getImageData, templateName, templateGrade, templateSubject, toast, handleClose]);

  // ── Open in editor ──
  const openInEditor = useCallback(async (useSelection: boolean) => {
    let pages: DesignerPage[];
    let meta: any = { name: templateName.trim() || 'قالب مستورد' };

    if (jsonData) {
      pages = jsonData.pages ?? [];
      meta = { ...meta, ...(jsonData.meta ?? {}) };
    } else {
      const imageData = await getImageData(useSelection);
      if (!imageData) { toast({ title: 'لا توجد صورة', variant: 'destructive' }); return; }
      pages = [{
        id: crypto.randomUUID(),
        settings: makeDefaultSettings(),
        elements: [],
        background: { ...DEFAULT_BACKGROUND, type: 'image', imageData },
      }];
    }
    onStartEditing(pages, meta);
    handleClose();
  }, [jsonData, getImageData, templateName, toast, onStartEditing, handleClose]);

  // ── Mouse handlers for selection (left-click drag) ──
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // left click only
    e.preventDefault();
    setContextMenu(null);
    const ctr = containerRef.current!;
    const rect = ctr.getBoundingClientRect();
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setSelStartPx(pos);
    setSelEndPx(pos);
    setIsDragging(true);
  };

  // ── Right-click context menu ──
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const ctr = containerRef.current!;
    const rect = ctr.getBoundingClientRect();
    setContextMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      imgX: e.clientX,
      imgY: e.clientY,
      visible: true,
    });
  };

  // ── Start box selection from context menu ──
  const startBoxSelectionFromCtx = () => {
    if (!contextMenu) return;
    const ctr = containerRef.current!;
    const rect = ctr.getBoundingClientRect();
    const pos = { x: contextMenu.x, y: contextMenu.y };
    setSelStartPx(pos);
    setSelEndPx(pos);
    setIsDragging(true);
    setContextMenu(null);
  };

  if (!open) return null;

  const isImageType = fileType === 'image' || fileType === 'pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[95vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-gradient-to-l from-amber-50 to-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-600" />
            استيراد وإنشاء القالب
          </h2>
          <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Upload step ── */}
          {!fileType && !loading && (
            <div className="p-6 space-y-6">
              <p className="text-sm text-muted-foreground text-center">
                استورد <strong>أي ملف</strong> — صورة (JPG، PNG، WebP، SVG)، PDF، JSON قالب، أو أي تنسيق آخر
              </p>

              {/* Drop zone */}
              <label className="block cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.json,.svg,.webp,.bmp,.gif,.tiff"
                  onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
                />
                <div
                  className="border-2 border-dashed border-amber-400/50 hover:border-amber-500 rounded-xl p-10 text-center transition-colors hover:bg-amber-50/30"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) processFile(f);
                  }}
                >
                  <Upload className="w-10 h-10 mx-auto mb-3 text-amber-400" />
                  <p className="font-semibold text-base mb-1">اسحب ملفاً هنا أو انقر للاختيار</p>
                  <p className="text-sm text-muted-foreground">صور · PDF · JSON · أي تنسيق مدعوم</p>
                </div>
              </label>

              {/* Built-in frames gallery */}
              <div>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-600" />
                  إطارات وقوالب مضمنة — انقر مباشرةً للاستخدام
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {BUILTIN_FRAMES.map(frame => (
                    <button
                      key={frame.id}
                      onClick={() => selectBuiltInFrame(frame.src, frame.label)}
                      className="group border-2 border-border hover:border-amber-400 rounded-xl overflow-hidden transition-all hover:shadow-md"
                      title={frame.label}
                    >
                      <img
                        src={frame.src}
                        alt={frame.label}
                        className="w-full h-16 object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={e => {
                          const el = e.target as HTMLImageElement;
                          el.parentElement!.style.display = 'none';
                        }}
                      />
                      <p className="text-[9px] text-center py-1 text-muted-foreground px-1 truncate font-medium">
                        {frame.label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Loading ── */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
              <p className="text-muted-foreground">جاري تحميل الملف...</p>
            </div>
          )}

          {/* ── Preview step ── */}
          {fileType && !loading && (
            <div className="p-6 space-y-5">

              {/* Metadata fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">اسم القالب *</label>
                  <Input
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="اسم القالب..."
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">الصف الدراسي</label>
                  <select
                    className="w-full border rounded-lg px-3 h-9 text-sm outline-none focus:ring-2 ring-primary/30 bg-background"
                    value={templateGrade}
                    onChange={e => setTemplateGrade(e.target.value)}
                  >
                    {GRADES.map((g, i) => <option key={i} value={g}>{g || '— كل الصفوف —'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">المادة الدراسية</label>
                  <select
                    className="w-full border rounded-lg px-3 h-9 text-sm outline-none focus:ring-2 ring-primary/30 bg-background"
                    value={templateSubject}
                    onChange={e => setTemplateSubject(e.target.value)}
                  >
                    {SUBJECTS.map((s, i) => <option key={i} value={s}>{s || '— كل المواد —'}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Image preview with selection overlay ── */}
              {isImageType && rawImageUrl && (
                <div className="space-y-2">
                  {/* Selection mode controls */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                      <Crop className="w-4 h-4 text-amber-500" />
                      {hasSelection
                        ? 'تم تحديد منطقة — اختر ما تريد فعله بها'
                        : 'اسحب بالزر الأيسر لتحديد منطقة، أو انقر بالزر الأيمن لخيارات إضافية'}
                    </p>
                    <div className="flex items-center gap-2">
                      {hasSelection && (
                        <button
                          onClick={() => { setSelStartPx(null); setSelEndPx(null); }}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors border rounded-md px-2 py-1"
                        >
                          <X className="w-3 h-3" /> مسح التحديد
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    ref={containerRef}
                    className="relative border-2 border-border rounded-xl overflow-hidden bg-muted/10 cursor-crosshair select-none"
                    style={{ maxHeight: 380 }}
                    onMouseDown={handleMouseDown}
                    onContextMenu={handleContextMenu}
                  >
                    <img
                      ref={imgRef}
                      src={rawImageUrl}
                      className="max-w-full max-h-[380px] object-contain mx-auto block pointer-events-none"
                      alt="معاينة"
                      draggable={false}
                    />

                    {/* Selection overlay */}
                    {displaySel && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 bg-black/30" />
                        <div
                          className="absolute border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.30)]"
                          style={{
                            left: displaySel.left, top: displaySel.top,
                            width: displaySel.width, height: displaySel.height,
                            background: 'transparent',
                          }}
                        >
                          {[
                            { top: -4, left: -4 }, { top: -4, right: -4 },
                            { bottom: -4, left: -4 }, { bottom: -4, right: -4 },
                          ].map((h, i) => (
                            <div
                              key={i}
                              className="absolute w-3 h-3 border-2 border-amber-400 bg-white rounded-sm"
                              style={{ top: (h as any).top, left: (h as any).left, bottom: (h as any).bottom, right: (h as any).right }}
                            />
                          ))}
                          {/* Label inside selection */}
                          <div className="absolute top-1 right-1 bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                            المنطقة المحددة
                          </div>
                        </div>
                      </div>
                    )}

                    {!displaySel && !isDragging && (
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                        <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                          <MousePointer2 className="w-3 h-3" />
                          اسحب لتحديد منطقة · انقر يمين للقائمة السياقية
                        </div>
                      </div>
                    )}

                    {/* Right-click context menu */}
                    {contextMenu?.visible && (
                      <div
                        className="absolute z-50 bg-white border rounded-xl shadow-xl py-1 min-w-[220px]"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="px-3 py-1.5 text-xs font-bold text-muted-foreground border-b">
                          خيارات الاستخراج
                        </div>
                        <button
                          className="w-full text-right px-3 py-2 text-sm hover:bg-amber-50 flex items-center gap-2 transition-colors"
                          onClick={() => { startBoxSelectionFromCtx(); }}
                        >
                          <SquareDashed className="w-4 h-4 text-amber-500" />
                          بدء تحديد منطقة من هنا
                        </button>
                        {hasSelection && (
                          <>
                            <button
                              className="w-full text-right px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 transition-colors"
                              onClick={() => { saveAsTemplate(true); setContextMenu(null); }}
                            >
                              <Scissors className="w-4 h-4 text-blue-500" />
                              قص المنطقة المحددة وحفظها قالباً
                            </button>
                            <button
                              className="w-full text-right px-3 py-2 text-sm hover:bg-violet-50 flex items-center gap-2 transition-colors"
                              onClick={() => { handleExtractDesignOnly(true); setContextMenu(null); }}
                            >
                              <Wand2 className="w-4 h-4 text-violet-500" />
                              استخراج التصميم فقط (بدون نصوص)
                            </button>
                          </>
                        )}
                        <div className="border-t mt-1 pt-1">
                          <button
                            className="w-full text-right px-3 py-2 text-sm hover:bg-violet-50 flex items-center gap-2 transition-colors"
                            onClick={() => { handleExtractDesignOnly(false); setContextMenu(null); }}
                          >
                            <Wand2 className="w-4 h-4 text-violet-500" />
                            استخراج تصميم الصفحة كاملة (بدون نصوص)
                          </button>
                          <button
                            className="w-full text-right px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 transition-colors"
                            onClick={() => { saveAsTemplate(false); setContextMenu(null); }}
                          >
                            <Save className="w-4 h-4 text-muted-foreground" />
                            حفظ الصورة كاملة كقالب
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {fileType === 'pdf' && (
                    <p className="text-xs text-amber-700 flex items-center gap-1 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                      <Eye className="w-3 h-3" />
                      هذه معاينة الصفحة الأولى من الـ PDF — يمكنك تحديد جزء منها أو استخراج تصميمها
                    </p>
                  )}

                  {/* Quick action hints */}
                  {hasSelection && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      <p className="font-semibold mb-1">✅ تم تحديد منطقة — يمكنك:</p>
                      <ul className="text-xs space-y-0.5 text-amber-700 list-disc list-inside">
                        <li>قص المنطقة وحفظها كقالب كاملة مع نصوصها</li>
                        <li>استخراج التصميم فقط (إزالة النصوص والمحتوى)</li>
                        <li>فتحها في المحرر لتعديلها يدوياً</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* JSON preview */}
              {fileType === 'json' && jsonData && (
                <div className="border rounded-xl p-4 bg-muted/20 flex items-start gap-3">
                  <FileJson className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      قالب JSON — {jsonData.pages?.length ?? 0} {(jsonData.pages?.length ?? 0) === 1 ? 'صفحة' : 'صفحات'}
                    </p>
                    {jsonData.meta?.name && (
                      <p className="text-xs text-muted-foreground mt-0.5">الاسم الأصلي: {jsonData.meta.name}</p>
                    )}
                    {jsonData.meta?.subject && (
                      <p className="text-xs text-muted-foreground">المادة: {jsonData.meta.subject}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Change file */}
              <button
                onClick={() => { setFileType(null); setRawImageUrl(null); setJsonData(null); setSelStartPx(null); setSelEndPx(null); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                اختيار ملف آخر أو إطار مختلف
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {fileType && !loading && (
          <div className="border-t px-6 py-4 shrink-0 bg-muted/5">
            <p className="text-xs text-muted-foreground mb-3">
              {isImageType
                ? hasSelection
                  ? 'يمكنك حفظ المنطقة المحددة، أو استخراج تصميمها فقط (بدون نصوص)، أو فتح الصورة كاملة في المحرر'
                  : 'يمكنك فتح الصورة في المحرر لتعديل التصميم، أو حفظها مباشرةً في مكتبة القوالب، أو استخراج التصميم بدون النصوص'
                : 'يمكنك فتح القالب للتعديل أو حفظه مباشرةً في المكتبة'}
            </p>
            <div className="flex gap-2 flex-wrap justify-end">
              {/* استخراج التصميم فقط */}
              {isImageType && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50"
                  onClick={() => handleExtractDesignOnly(hasSelection)}
                  disabled={saving || extracting}
                >
                  {extracting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Wand2 className="w-4 h-4" />
                  }
                  {hasSelection ? 'استخراج تصميم المحدد' : 'استخراج التصميم فقط'}
                </Button>
              )}

              {/* قص المنطقة المحددة وحفظها */}
              {isImageType && hasSelection && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={() => saveAsTemplate(true)}
                  disabled={saving || extracting}
                >
                  <Scissors className="w-4 h-4" />
                  قص المحدد وحفظه
                </Button>
              )}

              {/* فتح في المحرر */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => openInEditor(false)}
                disabled={saving || extracting}
              >
                <FolderOpen className="w-4 h-4" />
                فتح في المحرر
              </Button>

              {/* حفظ كاملاً */}
              <Button
                size="sm"
                className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                onClick={() => saveAsTemplate(false)}
                disabled={saving || extracting}
              >
                {saving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />
                }
                {isImageType && hasSelection ? 'حفظ الصورة كاملة' : 'حفظ في المكتبة'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
