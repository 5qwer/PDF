// ─── لوحة مكتبة الإطارات الزخرفية ───────────────────────────────────────────
import React, { useState, useRef, useCallback } from 'react';
import type { DesignerElement } from '@/lib/designer-types';
import {
  FRAME_TEMPLATES, SUBJECT_THEMES, renderFrameSvg, getFramesBySubject,
  type FrameTemplate, type FrameColors,
} from '@/lib/frame-templates';
import { X, Upload, Palette, Search, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FrameExtractor from './FrameExtractor';

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (element: DesignerElement) => void;
  currentElementCount: number;
}

// ─── إزالة الخلفية من صورة ────────────────────────────────────────────────────

async function removeBackground(file: File, threshold = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        // إزالة البيكسلات البيضاء أو الفاتحة جداً
        if (r > threshold && g > threshold && b > threshold) {
          px[i + 3] = 0; // جعلها شفافة
        }
      }
      ctx.putImageData(data, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('فشل تحميل الصورة')); };
    img.src = url;
  });
}

// ─── مكوّن معاينة الإطار ──────────────────────────────────────────────────────

function FramePreview({ template, colors }: { template: FrameTemplate; colors: FrameColors }) {
  const svg = template.render(colors);
  return (
    <div
      className="w-full h-full"
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ pointerEvents: 'none' }}
    />
  );
}

// ─── بطاقة إطار ───────────────────────────────────────────────────────────────

function FrameCard({ template, colors, onInsert }: {
  template: FrameTemplate;
  colors: FrameColors;
  onInsert: (tpl: FrameTemplate) => void;
}) {
  const ratio = template.aspectRatio ?? 400 / 560;
  const previewH = ratio > 1 ? 56 : 90;
  const previewW = ratio > 1 ? 88 : 56;

  return (
    <div
      className="group relative border border-border rounded-lg overflow-hidden hover:border-primary cursor-pointer transition-all hover:shadow-md bg-background"
      onClick={() => onInsert(template)}
    >
      {/* المعاينة */}
      <div className="flex items-center justify-center bg-muted/20 py-2 px-2">
        <div
          style={{ width: previewW, height: previewH, overflow: 'hidden', border: '1px solid #e2e8f020', borderRadius: 3 }}
        >
          <FramePreview template={template} colors={colors} />
        </div>
      </div>
      {/* الاسم */}
      <div className="px-1.5 pb-1.5 pt-1">
        <p className="text-[10px] text-center text-muted-foreground truncate leading-tight">{template.nameAr}</p>
      </div>
      {/* غلاف التمرير */}
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      {/* إضافة */}
      <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] bg-primary text-primary-foreground rounded px-1 py-0.5">+ إضافة</span>
      </div>
    </div>
  );
}

// ─── اللوحة الرئيسية ──────────────────────────────────────────────────────────

export default function FramesLibraryPanel({ open, onClose, onInsert, currentElementCount }: Props) {
  const [activeSubject, setActiveSubject] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [customColors, setCustomColors] = useState<FrameColors | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bgThreshold, setBgThreshold] = useState(230);
  const [extractorOpen, setExtractorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subjectTheme = SUBJECT_THEMES[activeSubject] ?? SUBJECT_THEMES.all;
  const colors = customColors ?? subjectTheme.colors;

  // تصفية الإطارات
  const filtered = getFramesBySubject(activeSubject)
    .filter(t => activeCategory === 'all' || t.category === activeCategory)
    .filter(t => !searchTerm || t.nameAr.includes(searchTerm) || t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const categories = [
    { id: 'all',         label: 'الكل' },
    { id: 'side-column', label: 'جانبية' },
    { id: 'full-border', label: 'حدود كاملة' },
    { id: 'banner',      label: 'لافتات' },
    { id: 'content-box', label: 'صناديق' },
  ];

  const handleInsertTemplate = useCallback((template: FrameTemplate) => {
    const ratio = template.aspectRatio ?? 400 / 560;
    // حساب الأبعاد الافتراضية بالنسبة المئوية لحجم الصفحة
    let w = 80, h = 80;
    if (template.category === 'side-column') { w = 100; h = 100; }
    else if (template.category === 'full-border') { w = 96; h = 96; }
    else if (template.category === 'banner') { w = 85; h = Math.round(85 / ratio); }
    else if (template.category === 'content-box') { w = 80; h = Math.round(80 / ratio); }

    const el: DesignerElement = {
      id: crypto.randomUUID(),
      type: 'deco-frame' as any,
      name: template.nameAr,
      x: template.category === 'side-column' ? 0 : template.category === 'full-border' ? 2 : 8,
      y: template.category === 'side-column' ? 0 : template.category === 'full-border' ? 2 : 10,
      width: w,
      height: Math.min(h, 100),
      rotation: 0,
      opacity: 100,
      locked: false,
      visible: true,
      printable: true,
      zIndex: currentElementCount,
      version: 1,
      frameId: template.id,
      subject: activeSubject,
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      accentColor: colors.accent,
    } as any;
    onInsert(el);
    onClose();
  }, [colors, activeSubject, currentElementCount, onInsert, onClose]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const processedSrc = await removeBackground(file, bgThreshold);
      const el: DesignerElement = {
        id: crypto.randomUUID(),
        type: 'deco-frame' as any,
        name: `إطار مخصص - ${file.name}`,
        x: 0, y: 0, width: 100, height: 100,
        rotation: 0, opacity: 100, locked: false, visible: true, printable: true,
        zIndex: currentElementCount, version: 1,
        frameId: 'custom-image',
        subject: activeSubject,
        primaryColor: colors.primary,
        secondaryColor: colors.secondary,
        accentColor: colors.accent,
        imageSrc: processedSrc,
      } as any;
      onInsert(el);
      onClose();
    } catch (err) {
      alert('فشل معالجة الصورة. جرّب صورة أخرى.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [bgThreshold, colors, activeSubject, currentElementCount, onInsert, onClose]);

  // ─── إدراج شكل مستخرج من مستخرج القوالب ─────────────────────────────────
  const handleExtractorInsert = useCallback((imageSrc: string, ratio: number, name: string) => {
    const w = 60;
    const h = Math.max(10, Math.min(100, Math.round(w / Math.max(ratio, 0.1))));
    const el: DesignerElement = {
      id: crypto.randomUUID(),
      type: 'deco-frame' as any,
      name,
      x: 10, y: 10, width: w, height: h,
      rotation: 0, opacity: 100, locked: false, visible: true, printable: true,
      zIndex: currentElementCount, version: 1,
      frameId: 'custom-image',
      subject: activeSubject,
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      accentColor: colors.accent,
      imageSrc,
    } as any;
    onInsert(el);
    onClose();
  }, [activeSubject, colors, currentElementCount, onInsert, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center" dir="rtl">
      {/* طبقة التعتيم */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* اللوحة */}
      <div className="relative z-10 bg-background border border-border rounded-xl shadow-2xl flex flex-col w-[700px] max-w-[96vw] max-h-[90vh] overflow-hidden">

        {/* رأس اللوحة */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🖼️</span>
            <h2 className="font-bold text-sm">مكتبة الإطارات والزخارف التعليمية</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* شريط المادة */}
        <div className="flex gap-1 px-4 py-2 border-b border-border bg-muted/10 overflow-x-auto shrink-0">
          {Object.entries(SUBJECT_THEMES).map(([key, s]) => (
            <button
              key={key}
              onClick={() => { setActiveSubject(key); setCustomColors(null); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                activeSubject === key
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* شريط التصفية والبحث والألوان */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0 flex-wrap">
          {/* الفئات */}
          <div className="flex gap-1">
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  activeCategory === c.id
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:bg-muted border border-transparent'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* بحث */}
          <div className="relative flex-1 min-w-[120px]">
            <Search className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="بحث..."
              className="h-6 text-[11px] pr-6 py-0"
            />
          </div>

          {/* ألوان مخصصة */}
          <div className="flex items-center gap-1" title="لون رئيسي مخصص">
            <Palette className="w-3 h-3 text-muted-foreground" />
            {(['primary', 'secondary', 'accent'] as const).map(key => (
              <input
                key={key}
                type="color"
                value={colors[key]}
                title={key === 'primary' ? 'رئيسي' : key === 'secondary' ? 'ثانوي' : 'تمييز'}
                onChange={e => setCustomColors(prev => ({
                  primary: prev?.primary ?? colors.primary,
                  secondary: prev?.secondary ?? colors.secondary,
                  accent: prev?.accent ?? colors.accent,
                  [key]: e.target.value,
                }))}
                className="w-6 h-6 rounded cursor-pointer border border-border"
              />
            ))}
            {customColors && (
              <button onClick={() => setCustomColors(null)} className="text-[9px] text-muted-foreground hover:text-destructive">↩</button>
            )}
          </div>
        </div>

        {/* شبكة الإطارات */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-12">لا توجد إطارات تطابق البحث</div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {filtered.map(tpl => (
                <FrameCard
                  key={tpl.id}
                  template={tpl}
                  colors={colors}
                  onInsert={handleInsertTemplate}
                />
              ))}
            </div>
          )}
        </div>

        {/* قسم رفع الصور */}
        <div className="shrink-0 border-t border-border bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs font-medium mb-0.5">📸 ارفع صورة إطار وحوّلها</p>
              <p className="text-[10px] text-muted-foreground">ارفع صورة PNG أو JPG — سيُزال لونها الأبيض تلقائياً وتصبح إطاراً شفافاً</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-muted-foreground">حساسية الإزالة:</label>
              <input
                type="range" min={180} max={255} value={bgThreshold}
                onChange={e => setBgThreshold(+e.target.value)}
                className="w-20 h-1 cursor-pointer"
                title={`${bgThreshold} (عالية = يُزال المزيد)`}
              />
              <span className="text-[10px] text-muted-foreground w-6 text-center">{bgThreshold}</span>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'جارٍ المعالجة...' : 'رفع صورة سريعة'}
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setExtractorOpen(true)}
              title="اختر PDF أو صورة، حدّد الشكل، امسح النصوص، واحفظه كقالب دائم"
            >
              <Scissors className="w-3.5 h-3.5" />
              استخراج قالب من PDF/صورة
            </Button>
          </div>
        </div>
      </div>

      <FrameExtractor
        open={extractorOpen}
        onClose={() => setExtractorOpen(false)}
        onInsert={handleExtractorInsert}
        subject={activeSubject}
      />
    </div>
  );
}
