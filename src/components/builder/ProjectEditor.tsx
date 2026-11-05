/**
 * ProjectEditor — محرر صفحات المشروع
 *
 * يدعم الآن ثلاثة أنواع من المحتوى:
 *   rich-layout   — سؤال مُعاد بناؤه بتخطيطه الأصلي (QuestionContainer)
 *   image         — صورة JPEG مجمدة
 *   text          — نص مسطح مع SmartTextRenderer
 *   custom-text   — كتلة نص حر قابلة للتعديل
 *   uploaded-image — صورة مرفوعة من الجهاز
 */
import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LocalProjectItem, DEFAULT_DESIGN, ProjectDesign, QuestionStyle } from '@/lib/db';
import { getPageBgStyle } from '@/lib/pageBgStyle';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { QuestionContainer } from './QuestionContainer';
import {
  Plus, Trash2, Printer, ChevronUp, ChevronDown,
  FileQuestion, Loader2, ImagePlus, Type, Settings2, X,
  Copy, MoveUp, MoveDown, Palette, Download, FileDown, LayoutTemplate, Check,
} from 'lucide-react';
import type { DesignerTemplate, NumberingStyle } from '@/lib/designer-types';
import { formatQuestionNumber } from '@/lib/designer-types';
import TemplateLibrary, { type TemplateOpenOptions } from '@/components/designer/TemplateLibrary';

// ─── TextBlock ───────────────────────────────────────────────────────────────
function TextBlock({ item, onSave }: { item: LocalProjectItem; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(!item.textContent);
  const [val, setVal] = useState(item.textContent ?? '');

  const commit = () => { setEditing(false); onSave(val); };

  if (editing) {
    return (
      <div className="w-full">
        <textarea
          autoFocus
          className="w-full min-h-[56px] text-sm border border-primary/40 rounded p-2 resize-y outline-none focus:ring-2 ring-primary/30 leading-relaxed"
          dir="rtl"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) commit(); }}
          placeholder="اكتب نصك هنا…"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">Ctrl+Enter أو انقر خارجًا للحفظ</p>
      </div>
    );
  }
  return (
    <div
      className="w-full min-h-[24px] text-sm leading-relaxed cursor-text hover:bg-muted/30 rounded px-1 py-0.5 transition-colors"
      dir="rtl"
      onClick={() => setEditing(true)}
      title="انقر للتعديل"
    >
      {val || <span className="text-muted-foreground italic text-xs">نص فارغ — انقر للكتابة</span>}
    </div>
  );
}

// ─── Design Panel ─────────────────────────────────────────────────────────────
function DesignPanel({ design, onSave, onClose }: {
  design: ProjectDesign;
  onSave: (d: ProjectDesign) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<ProjectDesign>(design);
  const up = (patch: Partial<ProjectDesign>) => setD(prev => ({ ...prev, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-80 bg-white shadow-2xl flex flex-col overflow-hidden border-r border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-base">تصميم الصفحة</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Questions per page */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">عدد الأسئلة في الصفحة</p>
            <p className="text-[10px] text-muted-foreground mb-2">
              المسافات تتوزع تلقائيًا — اضبطه على 0 لإيقاف الميزة
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={30}
                value={d.questionsPerPage ?? 0}
                onChange={e => up({ questionsPerPage: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-20 border border-border rounded-lg px-3 py-2 text-sm text-center font-bold focus:ring-2 ring-primary/30 outline-none"
              />
              <span className="text-sm text-muted-foreground">سؤال / صفحة</span>
            </div>
          </div>

          {/* Watermark */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">علامة مائية (Watermark)</p>
            <input
              type="text"
              value={d.watermark ?? ''}
              onChange={e => up({ watermark: e.target.value })}
              placeholder="مثال: سري — لا يُنشر"
              dir="rtl"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 ring-primary/30 outline-none"
            />
            {d.watermark && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">تعتيم:</span>
                <input
                  type="range" min={5} max={40} step={5}
                  value={d.watermarkOpacity ?? 15}
                  onChange={e => up({ watermarkOpacity: Number(e.target.value) })}
                  className="flex-1 accent-primary"
                />
                <span className="text-[10px] tabular-nums w-8">{d.watermarkOpacity ?? 15}%</span>
              </div>
            )}
          </div>

          {/* Numbering */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">ترقيم الأسئلة</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['arabic',        '١ ٢ ٣'],
                ['abjad',         'أ ب ج'],
                ['decimal',       '1 2 3'],
                ['latin-lower',   'a b c'],
                ['latin-upper',   'A B C'],
                ['roman-lower',   'i ii iii'],
                ['roman-upper',   'I II III'],
                ['none',          'بدون'],
              ] as const).map(([v, label]) => (
                <button key={v} onClick={() => up({ numbering: v as ProjectDesign['numbering'] })}
                  className={`border rounded-lg py-2 text-sm font-medium transition-colors ${d.numbering === v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}>
                  {label}
                </button>
              ))}
            </div>
            {d.numbering !== 'none' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  لاحقة
                  <input type="text" maxLength={3} value={d.numberingSuffix ?? ''}
                    onChange={e => up({ numberingSuffix: e.target.value })}
                    placeholder=") "
                    className="w-full border rounded px-2 py-1 text-xs bg-background" />
                </label>
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  يبدأ من
                  <input type="number" min={1} value={d.numberingStart ?? 1}
                    onChange={e => up({ numberingStart: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full border rounded px-2 py-1 text-xs bg-background" />
                </label>
              </div>
            )}
          </div>

          {/* Separator */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">فاصل بين الأسئلة</p>
            <div className="grid grid-cols-3 gap-2">
              {([['dashed','متقطع'],['solid','متصل'],['none','بدون']] as const).map(([v, label]) => (
                <button key={v} onClick={() => up({ separator: v })}
                  className={`border rounded-lg py-2 text-sm font-medium transition-colors ${d.separator === v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Background — tabbed by category */}
          <BgPanel value={d.bgColor ?? 'white'} onChange={id => up({ bgColor: id })} />

          {/* Page-level colors */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">ألوان موحّدة للأسئلة</p>
            <p className="text-[10px] text-muted-foreground mb-2">
              تُطبَّق على كل أسئلة الصفحة — للتنسيق الموحّد حين تجمع PDF بأكثر من مصدر
            </p>
            <div className="space-y-2">
              {([
                ['pageTextColor',   'لون النص',           '#1a1a1a'],
                ['pageChoiceColor', 'لون الاختيارات',     '#2563eb'],
                ['pageNumberColor', 'لون رقم السؤال',    '#f59e0b'],
              ] as [keyof ProjectDesign, string, string][]).map(([key, label, def]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={(d[key] as string | undefined) ?? def}
                      onChange={e => up({ [key]: e.target.value } as Partial<ProjectDesign>)}
                      className="w-7 h-7 rounded cursor-pointer border border-border p-0"
                    />
                    {d[key] && d[key] !== def && (
                      <button
                        onClick={() => up({ [key]: undefined } as Partial<ProjectDesign>)}
                        className="text-[9px] text-muted-foreground hover:text-destructive"
                        title="إزالة اللون"
                      >✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">حجم الخط</p>
            <div className="grid grid-cols-3 gap-2">
              {([['sm','صغير'],['md','متوسط'],['lg','كبير']] as const).map(([v, label]) => (
                <button key={v} onClick={() => up({ fontSize: v })}
                  className={`border rounded-lg py-2 text-sm font-medium transition-colors ${d.fontSize === v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            {([
              ['showHeader','إظهار ترويسة الصفحة'] as const,
              ['twoColumn','تخطيط عمودين'] as const,
            ]).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm">{label}</span>
                <button
                  onClick={() => up({ [key]: !d[key as keyof ProjectDesign] } as any)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${d[key as keyof ProjectDesign] ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${d[key as keyof ProjectDesign] ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t p-4">
          <Button className="w-full" onClick={() => { onSave(d); onClose(); }}>
            حفظ التصميم
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page background presets ——  المنطق الفعلي في src/lib/pageBgStyle.ts ─────

interface BgPreset { id: string; label: string; preview: React.CSSProperties; }

// ─── Background panel with tabs ──────────────────────────────────────────────
type BgTab = 'solid' | 'dark' | 'lined' | 'grid' | 'dots' | 'gradient' | 'emoji';
const BG_TABS: { id: BgTab; label: string }[] = [
  { id: 'solid',    label: 'فاتح' },
  { id: 'dark',     label: 'داكن' },
  { id: 'lined',    label: 'سطور' },
  { id: 'grid',     label: 'مشطرة' },
  { id: 'dots',     label: 'نقاط' },
  { id: 'gradient', label: 'تدرج' },
  { id: 'emoji',    label: 'إيموجي' },
];
const BG_BY_TAB: Record<BgTab, BgPreset[]> = {
  solid: [
    { id: 'white',        label: 'أبيض',    preview: { background: '#ffffff' } },
    { id: 'cream',        label: 'كريمي',   preview: { background: '#fefce8' } },
    { id: 'blue-light',   label: 'أزرق',   preview: { background: '#eff6ff' } },
    { id: 'green-light',  label: 'أخضر',   preview: { background: '#f0fdf4' } },
    { id: 'pink-light',   label: 'وردي',   preview: { background: '#fdf2f8' } },
    { id: 'purple-light', label: 'بنفسجي', preview: { background: '#faf5ff' } },
    { id: 'gray-light',   label: 'رمادي',  preview: { background: '#f9fafb' } },
    { id: 'peach',        label: 'خوخي',   preview: { background: '#fff7ed' } },
    { id: 'mint',         label: 'نعناعي', preview: { background: '#f0fdfa' } },
    { id: 'rose',         label: 'وردة',   preview: { background: '#fff1f2' } },
    { id: 'sky',          label: 'سماوي',  preview: { background: '#e0f2fe' } },
    { id: 'sand',         label: 'رملي',   preview: { background: '#fdf8f0' } },
    { id: 'amber',        label: 'عنبر',   preview: { background: '#fffbeb' } },
    { id: 'lavender',     label: 'خزامى',  preview: { background: '#f3f0ff' } },
    { id: 'teal-light',   label: 'زيتي',   preview: { background: '#f0fffe' } },
    { id: 'orange-light', label: 'برتقالي',preview: { background: '#fff8f0' } },
  ],
  dark: [
    { id: 'dark-navy',    label: 'كحلي',   preview: { background: '#0f172a' } },
    { id: 'dark-slate',   label: 'أردوازي',preview: { background: '#1e293b' } },
    { id: 'dark-green',   label: 'أخضر',   preview: { background: '#052e16' } },
    { id: 'dark-purple',  label: 'بنفسجي', preview: { background: '#1e1b4b' } },
    { id: 'dark-red',     label: 'أحمر',   preview: { background: '#1c0606' } },
    { id: 'dark-teal',    label: 'زيتوني', preview: { background: '#042f2e' } },
    { id: 'dark-brown',   label: 'بني',    preview: { background: '#1c0a00' } },
    { id: 'dark-gray',    label: 'رمادي',  preview: { background: '#111827' } },
    { id: 'dark-blue',    label: 'أزرق',   preview: { background: '#0c1a42' } },
    { id: 'dark-rose',    label: 'وردي',   preview: { background: '#1a0010' } },
  ],
  lined: [
    { id: 'lined',         label: 'رمادية', preview: { background: '#fff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 9px,#ccc 9px,#ccc 10px)' } },
    { id: 'lined-blue',    label: 'زرقاء',  preview: { background: '#f8faff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 9px,#bfdbfe 9px,#bfdbfe 10px)' } },
    { id: 'lined-green',   label: 'خضراء',  preview: { background: '#f0fdf4', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 9px,#bbf7d0 9px,#bbf7d0 10px)' } },
    { id: 'lined-rose',    label: 'وردية',  preview: { background: '#fff1f2', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 9px,#fecdd3 9px,#fecdd3 10px)' } },
    { id: 'lined-purple',  label: 'بنفسجية',preview: { background: '#faf5ff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 9px,#e9d5ff 9px,#e9d5ff 10px)' } },
    { id: 'lined-amber',   label: 'عنبر',   preview: { background: '#fffbeb', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 9px,#fde68a 9px,#fde68a 10px)' } },
    { id: 'lined-teal',    label: 'زيتوني', preview: { background: '#f0fdfa', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 9px,#99f6e4 9px,#99f6e4 10px)' } },
    { id: 'lined-dark',    label: 'داكنة',  preview: { background: '#1e293b', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 9px,#334155 9px,#334155 10px)' } },
  ],
  grid: [
    { id: 'grid',          label: 'رمادية', preview: { background: '#fff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 8px,#e5e7eb 8px,#e5e7eb 9px),repeating-linear-gradient(to right,transparent 0,transparent 8px,#e5e7eb 8px,#e5e7eb 9px)' } },
    { id: 'grid-blue',     label: 'زرقاء',  preview: { background: '#f8faff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 8px,#dbeafe 8px,#dbeafe 9px),repeating-linear-gradient(to right,transparent 0,transparent 8px,#dbeafe 8px,#dbeafe 9px)' } },
    { id: 'grid-green',    label: 'خضراء',  preview: { background: '#f0fdf4', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 8px,#bbf7d0 8px,#bbf7d0 9px),repeating-linear-gradient(to right,transparent 0,transparent 8px,#bbf7d0 8px,#bbf7d0 9px)' } },
    { id: 'grid-rose',     label: 'وردية',  preview: { background: '#fff1f2', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 8px,#fecdd3 8px,#fecdd3 9px),repeating-linear-gradient(to right,transparent 0,transparent 8px,#fecdd3 8px,#fecdd3 9px)' } },
    { id: 'grid-purple',   label: 'بنفسجية',preview: { background: '#faf5ff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 8px,#e9d5ff 8px,#e9d5ff 9px),repeating-linear-gradient(to right,transparent 0,transparent 8px,#e9d5ff 8px,#e9d5ff 9px)' } },
    { id: 'grid-dark',     label: 'داكنة',  preview: { background: '#1e293b', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 8px,#334155 8px,#334155 9px),repeating-linear-gradient(to right,transparent 0,transparent 8px,#334155 8px,#334155 9px)' } },
  ],
  dots: [
    { id: 'dots',          label: 'رمادية', preview: { background: '#fff', backgroundImage: 'radial-gradient(circle,#d1d5db 1.5px,transparent 1.5px)', backgroundSize: '10px 10px' } },
    { id: 'dots-blue',     label: 'زرقاء',  preview: { background: '#f8faff', backgroundImage: 'radial-gradient(circle,#93c5fd 1.5px,transparent 1.5px)', backgroundSize: '10px 10px' } },
    { id: 'dots-green',    label: 'خضراء',  preview: { background: '#f0fdf4', backgroundImage: 'radial-gradient(circle,#86efac 1.5px,transparent 1.5px)', backgroundSize: '10px 10px' } },
    { id: 'dots-rose',     label: 'وردية',  preview: { background: '#fff1f2', backgroundImage: 'radial-gradient(circle,#fda4af 1.5px,transparent 1.5px)', backgroundSize: '10px 10px' } },
    { id: 'dots-purple',   label: 'بنفسجية',preview: { background: '#faf5ff', backgroundImage: 'radial-gradient(circle,#d8b4fe 1.5px,transparent 1.5px)', backgroundSize: '10px 10px' } },
    { id: 'dots-amber',    label: 'عنبر',   preview: { background: '#fffbeb', backgroundImage: 'radial-gradient(circle,#fcd34d 1.5px,transparent 1.5px)', backgroundSize: '10px 10px' } },
    { id: 'dots-dark',     label: 'داكنة',  preview: { background: '#1e293b', backgroundImage: 'radial-gradient(circle,#475569 1.5px,transparent 1.5px)', backgroundSize: '10px 10px' } },
  ],
  gradient: [
    { id: 'grad-sky',      label: 'سماوي',  preview: { background: 'linear-gradient(135deg,#dbeafe,#e0f2fe,#f0fdf4)' } },
    { id: 'grad-sunset',   label: 'غروب',   preview: { background: 'linear-gradient(135deg,#fef9c3,#fde68a,#fecaca)' } },
    { id: 'grad-lavender', label: 'خزامى',  preview: { background: 'linear-gradient(135deg,#f5f3ff,#ede9fe,#fdf4ff)' } },
    { id: 'grad-mint',     label: 'نعناع',  preview: { background: 'linear-gradient(135deg,#d1fae5,#f0fdfa,#ecfdf5)' } },
    { id: 'grad-rose',     label: 'وردة',   preview: { background: 'linear-gradient(135deg,#ffe4e6,#fef2f2,#fdf2f8)' } },
    { id: 'grad-ocean',    label: 'محيط',   preview: { background: 'linear-gradient(135deg,#1e3a5f,#1e4d7b,#1a6b9a)' } },
    { id: 'grad-forest',   label: 'غابة',   preview: { background: 'linear-gradient(135deg,#1a3a2a,#15532e,#166534)' } },
    { id: 'grad-dusk',     label: 'غسق',    preview: { background: 'linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)' } },
    { id: 'grad-peach',    label: 'خوخ',    preview: { background: 'linear-gradient(135deg,#fff7ed,#fed7aa,#fde68a)' } },
    { id: 'grad-cotton',   label: 'قطن',    preview: { background: 'linear-gradient(135deg,#fdf2f8,#fce7f3,#fdf4ff)' } },
    { id: 'grad-aurora',   label: 'شفق',    preview: { background: 'linear-gradient(135deg,#d1fae5,#a5f3fc,#c7d2fe)' } },
    { id: 'grad-gold',     label: 'ذهبي',   preview: { background: 'linear-gradient(135deg,#fffbeb,#fef3c7,#fde68a)' } },
  ],
  emoji: [
    { id: 'emoji-star',    label: '⭐ نجوم',    preview: { background: '#fffbf0' } },
    { id: 'emoji-book',    label: '📚 كتب',     preview: { background: '#f0f9ff' } },
    { id: 'emoji-pen',     label: '✏️ أقلام',   preview: { background: '#f9fafb' } },
    { id: 'emoji-math',    label: '➕ رياضيات', preview: { background: '#f0fdf4' } },
    { id: 'emoji-heart',   label: '❤️ قلوب',    preview: { background: '#fff1f2' } },
    { id: 'emoji-brain',   label: '🧠 مخ',      preview: { background: '#faf5ff' } },
    { id: 'emoji-atom',    label: '⚛️ علوم',    preview: { background: '#e0f2fe' } },
    { id: 'emoji-trophy',  label: '🏆 جوائز',   preview: { background: '#fffbeb' } },
    { id: 'emoji-moon',    label: '🌙 قمر',     preview: { background: '#0f172a' } },
    { id: 'emoji-sun',     label: '☀️ شمس',     preview: { background: '#fffbeb' } },
    { id: 'emoji-flower',  label: '🌸 زهور',    preview: { background: '#fdf2f8' } },
    { id: 'emoji-rocket',  label: '🚀 فضاء',    preview: { background: '#0c1a42' } },
    { id: 'emoji-soccer',  label: '⚽ رياضة',   preview: { background: '#f0fdf4' } },
    { id: 'emoji-music',   label: '🎵 موسيقى',  preview: { background: '#faf5ff' } },
    { id: 'emoji-globe',   label: '🌍 عالم',    preview: { background: '#eff6ff' } },
    { id: 'emoji-diamond', label: '💎 ماسة',    preview: { background: '#f0fffe' } },
  ],
};

function BgPanel({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const activeTab: BgTab =
    value.startsWith('emoji')  ? 'emoji'    :
    value.startsWith('grad')   ? 'gradient' :
    value.startsWith('dots')   ? 'dots'     :
    value.startsWith('grid')   ? 'grid'     :
    value.startsWith('lined')  ? 'lined'    :
    value.startsWith('dark-')  ? 'dark'     : 'solid';

  const [tab, setTab] = useState<BgTab>(activeTab);
  const presets = BG_BY_TAB[tab];
  const allLabel = Object.values(BG_BY_TAB).flat().find(p => p.id === value)?.label ?? 'أبيض';

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2">خلفية الصفحة</p>
      {/* Tabs */}
      <div className="flex gap-1 mb-3 bg-muted/40 rounded-lg p-1">
        {BG_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-colors ${
              tab === t.id
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Grid of presets */}
      <div className="grid grid-cols-3 gap-2">
        {presets.map(({ id, label, preview }) => {
          const isSel = value === id;
          return (
            <button
              key={id}
              title={label}
              onClick={() => onChange(id)}
              className={`relative rounded-lg overflow-hidden border-2 flex flex-col items-center transition-all ${
                isSel ? 'border-primary shadow-md' : 'border-transparent hover:border-border'
              }`}
              style={{ height: 52 }}
            >
              <div className="absolute inset-0" style={preview} />
              {isSel && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow">
                    <span className="text-white text-[9px] font-bold">✓</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-white/80 text-center text-[9px] py-0.5 leading-tight">
                {label}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-center text-primary font-medium mt-1.5">
        الخلفية: {allLabel}
      </p>
    </div>
  );
}

// ─── Export Dialog ────────────────────────────────────────────────────────────
function ExportDialog({ projectTitle, onClose }: { projectTitle: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const doPrint = () => { onClose(); setTimeout(() => window.print(), 150); };

  // Export the current #print-area straight to a real PDF file — no browser
  // print dialog, no page-headers, no "Save as PDF" step. Uses jsPDF +
  // html2canvas so what the user sees on screen becomes the PDF pages.
  const doPdf = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const area = document.getElementById('print-area');
      if (!area) throw new Error('لا يوجد محتوى للتصدير');
      const pages = Array.from(area.querySelectorAll<HTMLElement>('.print-page'));
      const targets = pages.length ? pages : [area];
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < targets.length; i++) {
        const el = targets[i];
        const canvas = await html2canvas(el, {
          scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
        });
        const img = canvas.toDataURL('image/jpeg', 0.92);
        // Fit image into A4 while preserving aspect ratio
        const cw = canvas.width, ch = canvas.height;
        const ratio = Math.min(pageW / (cw * 0.264583), pageH / (ch * 0.264583));
        const w = cw * 0.264583 * ratio;
        const h = ch * 0.264583 * ratio;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;
        if (i > 0) pdf.addPage();
        pdf.addImage(img, 'JPEG', x, y, w, h);
      }
      const safe = projectTitle.replace(/[^\p{L}\p{N}_\-. ]/gu, '').trim() || 'مشروع';
      pdf.save(`${safe}.pdf`);
      onClose();
    } catch (err) {
      console.error(err);
      alert('تعذّر إنشاء ملف PDF — حاول مرة أخرى');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-base flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            تصدير: <span className="truncate max-w-[140px]">{projectTitle}</span>
          </h2>
          <button onClick={onClose} disabled={busy} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <button onClick={doPdf} disabled={busy}
            className="w-full flex items-center gap-4 p-4 border-2 rounded-xl hover:border-red-400 hover:bg-red-50 transition-all text-right disabled:opacity-50 disabled:cursor-wait">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <FileDown className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{busy ? 'جارٍ إنشاء الملف…' : 'تصدير كـ PDF مباشرةً'}</p>
              <p className="text-xs text-muted-foreground">ملف PDF جاهز — بدون نافذة طباعة</p>
            </div>
          </button>
          <button onClick={doPrint} disabled={busy}
            className="w-full flex items-center gap-4 p-4 border-2 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-all text-right disabled:opacity-50">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Printer className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">تصدير للطباعة</p>
              <p className="text-xs text-muted-foreground">افتح نافذة الطباعة (اختر "حفظ كـ PDF" داخلها لو أردت)</p>
            </div>
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center pb-4">
          تلميح: التصدير المباشر يلتقط الصفحات كما تظهر على الشاشة
        </p>
      </div>
    </div>
  );
}

// ─── Template Picker Modal ─────────────────────────────────────────────────────
function TemplatePickerModal({ templates, currentId, onSelect, onClose, onOpenDesigner }: {
  templates: DesignerTemplate[];
  currentId?: number;
  onSelect: (id: number | undefined) => Promise<void>;
  onClose: () => void;
  onOpenDesigner: () => void;
}) {
  const [search, setSearch] = React.useState('');
  const filtered = search
    ? templates.filter(t => t.name.includes(search) || (t.subject ?? '').includes(search))
    : templates;
  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ms-auto w-80 bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-primary" /> قالب الصفحة
          </h2>
          <button onClick={onClose} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-2 border-b shrink-0">
          <input
            className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 ring-primary/30 bg-background"
            placeholder="بحث في القوالب…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {/* بدون قالب */}
          <button
            onClick={async () => { await onSelect(undefined); onClose(); }}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-right transition-all ${
              !currentId ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/30'
            }`}
          >
            <div className="w-9 h-11 rounded border bg-gray-50 flex items-center justify-center shrink-0 text-xl">📄</div>
            <div className="flex-1">
              <p className="text-sm font-semibold">بدون قالب</p>
              <p className="text-xs text-muted-foreground">صفحة فارغة بالإعدادات الحالية</p>
            </div>
            {!currentId && <Check className="w-4 h-4 text-primary shrink-0" />}
          </button>

          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <LayoutTemplate className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">لا توجد قوالب محفوظة بعد</p>
              <p className="text-xs mt-1">أنشئ قالباً من مصمّم الصفحات أولاً</p>
            </div>
          ) : filtered.map(tpl => (
            <button
              key={tpl.id}
              onClick={async () => { await onSelect(tpl.id!); onClose(); }}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-right transition-all ${
                currentId === tpl.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/30'
              }`}
            >
              <div className="w-9 h-11 rounded border overflow-hidden shrink-0">
                {tpl.thumbnail
                  ? <img src={tpl.thumbnail} className="w-full h-full object-cover" alt={tpl.name} />
                  : <div className="w-full h-full bg-muted flex items-center justify-center"><FileQuestion className="w-4 h-4 text-muted-foreground/40" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{tpl.name}</p>
                {(tpl.subject || tpl.category) && (
                  <p className="text-xs text-muted-foreground truncate">{tpl.subject || tpl.category}</p>
                )}
              </div>
              {currentId === tpl.id && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          ))}
        </div>
        <div className="p-3 border-t shrink-0">
          <Button variant="outline" size="sm" className="w-full text-xs gap-2" onClick={() => { onClose(); onOpenDesigner(); }}>
            <Plus className="w-3.5 h-3.5" />
            فتح مصمّم الصفحات — إنشاء قالب جديد
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Numbering helper ─────────────────────────────────────────────────────────
function getLabel(idx: number, style: ProjectDesign['numbering'], start = 1, suffix = '') {
  if (style === 'none') return null;
  // Map legacy short names to shared formatter styles
  const mapped: NumberingStyle =
    style === 'arabic' ? 'arabic-indic' :
    style === 'abjad'  ? 'arabic-letters' :
    (style as NumberingStyle);
  const s = formatQuestionNumber(idx, mapped, start);
  return suffix ? `${s}${suffix}` : s;
}
const FONT_CLASS = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

// ─── Arabic OCR text normalizer ───────────────────────────────────────────────
function normalizeArabicText(raw: string): string {
  return raw
    .replace(/\u0640+/g, '')
    .replace(/[ \t]{3,}/g, '   ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ ([\u064B-\u065F])/g, '$1')
    .trim();
}

// ─── Smart exam text parser ───────────────────────────────────────────────────
type TextSection =
  | { type: 'poem-verse'; sadr: string; ajuz: string }
  | { type: 'poem-header'; text: string }
  | { type: 'choice'; letter: string; text: string }
  | { type: 'question-stem'; text: string }
  | { type: 'footnote'; text: string }
  | { type: 'paragraph'; text: string };

const QUESTION_VERBS =
  /^(حدد|بيّن|بين|اشرح|اذكر|علّل|علل|قارن|استخرج|اكتب|وضّح|وضح|فسّر|فسر|حلل|ناقش|قيّم|قيم|أعرب|دلل|استنتج|ما|كيف|لماذا|من|متى|أين|هات|أكمل|صحح|رتب|اختر)\b/;
const GLOSSARY_WORDS = ['المؤثل','كماة','ضراغم','الكماة','جياد','أبطال','فرسان'];

// ─── Fix duplicate choice letters (e.g. all "أ") ─────────────────────────────
const CHOICE_LETTERS_FIX = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'];
function fixDuplicateChoices(sections: TextSection[]): TextSection[] {
  const result = [...sections];
  let i = 0;
  while (i < result.length) {
    if (result[i].type !== 'choice') { i++; continue; }
    let j = i;
    while (j < result.length && result[j].type === 'choice') j++;
    const run = result.slice(i, j);
    const letters = run.map(s => (s as { letter: string }).letter ?? '');
    const hasDup = new Set(letters).size < letters.length || (letters.length > 1 && new Set(letters).size === 1);
    if (hasDup) {
      for (let k = i; k < j; k++) {
        result[k] = { ...result[k], letter: CHOICE_LETTERS_FIX[k - i] ?? String(k - i + 1) } as any;
      }
    }
    i = j;
  }
  return result;
}

function parseExamText(raw: string): TextSection[] {
  const text = normalizeArabicText(raw);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const sections: TextSection[] = [];

  for (const line of lines) {
    if (/\*{3}|\*\s*\*\s*\*/.test(line)) {
      const parts = line.split(/\s*\*{3}\s*|\s*\*\s*\*\s*\*\s*/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        sections.push({ type: 'poem-verse', sadr: parts[0], ajuz: parts[1] });
      }
      continue;
    }
    const hasGlossaryWord = GLOSSARY_WORDS.some(w => line.includes(w));
    if (hasGlossaryWord && line.includes(':')) {
      sections.push({ type: 'footnote', text: line });
      continue;
    }
    if (/^(قال|شعر|للشاعر|من شعر)\s+/.test(line) && !line.includes('***')) {
      sections.push({ type: 'poem-header', text: line });
      continue;
    }
    if (QUESTION_VERBS.test(line)) {
      sections.push({ type: 'question-stem', text: line });
      continue;
    }
    const choiceMatch = line.match(/^([أابتثجحخدذرزسشصضطظعغفقكلمنهوي])\s+(.+)/u);
    if (choiceMatch) {
      sections.push({ type: 'choice', letter: choiceMatch[1], text: choiceMatch[2] });
      continue;
    }
    sections.push({ type: 'paragraph', text: line });
  }
  return fixDuplicateChoices(sections);
}

// ─── CategoryQuickEdit ────────────────────────────────────────────────────────
function CategoryQuickEdit({ projectId, current }: { projectId: number; current?: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current ?? '');
  const allProjects = useLiveQuery(() => db.projects.toArray(), []);
  const categories = [...new Set((allProjects ?? []).map(p => p.category).filter(Boolean) as string[])];

  const save = async () => {
    await db.projects.update(projectId, { category: value.trim() || undefined, updatedAt: Date.now() });
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setValue(current ?? ''); setOpen(true); }}
        title="تعديل الفئة/الصف"
        className="text-[10px] text-muted-foreground hover:text-primary border border-dashed border-muted-foreground/30 hover:border-primary/50 px-2 py-0.5 rounded transition-colors"
      >
        {current ? `✏️ ${current}` : '+ إضافة فئة'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        list="cat-list-editor"
        placeholder="اسم الصف/الفئة"
        className="text-[10px] border border-primary/50 rounded px-2 py-0.5 h-7 outline-none focus:ring-1 ring-primary/30 bg-background w-28"
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false); }}
      />
      <datalist id="cat-list-editor">
        {categories.map(c => <option key={c} value={c} />)}
      </datalist>
      <button onClick={save} className="text-[10px] text-white bg-primary px-2 py-0.5 rounded h-7 hover:bg-primary/90 transition-colors">حفظ</button>
      <button onClick={() => setOpen(false)} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ProjectEditor({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const project  = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const allItems = useLiveQuery(
    () => db.projectItems.where('projectId').equals(projectId).sortBy('sortOrder'),
    [projectId]
  );

  const [showDesign, setShowDesign] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [dragOverPage, setDragOverPage]   = useState<number | null>(null);
  const [dragOverFilePage, setDragOverFilePage] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetPage, setUploadTargetPage] = useState(0);
  /** رقم الصفحة التي يظهر عليها منتقي الخلفية السريع */
  const [bgPickerPage, setBgPickerPage] = useState<number | null>(null);

  const templates = useLiveQuery(
    () => db.designerTemplates.orderBy('updatedAt').reverse().toArray(), []
  ) ?? [];

  const applyTemplate = async (id: number | undefined, opts?: TemplateOpenOptions) => {
    const patch: Partial<typeof project> = { pageTemplateId: id, updatedAt: Date.now() };
    if (opts?.scope === 'range' && opts.fromPage && opts.toPage) {
      patch.pageTemplateRange = { from: opts.fromPage, to: opts.toPage };
    } else if (opts?.scope === 'current' && opts.fromPage) {
      patch.pageTemplateRange = { from: opts.fromPage, to: opts.fromPage };
    } else {
      patch.pageTemplateRange = 'all';
    }
    await db.projects.update(projectId, patch);
    const scopeLabel = opts?.scope === 'range' ? `صفحات ${opts.fromPage}–${opts.toPage}`
      : opts?.scope === 'current' ? `صفحة ${opts.fromPage}` : 'كل الصفحات';
    toast({ title: id ? `✅ تم تطبيق القالب على ${scopeLabel}` : 'تم إزالة القالب' });
  };

  if (!project || allItems === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeTemplate = templates.find(t => t.id === project.pageTemplateId);
  const design: ProjectDesign = { ...DEFAULT_DESIGN, ...project.design };
  const pageCount = Math.max(
    project.pageCount ?? 1,
    allItems.length > 0 ? Math.max(...allItems.map(i => i.pageIndex)) + 1 : 1
  );

  const pages: LocalProjectItem[][] = Array.from({ length: pageCount }, (_, p) =>
    allItems.filter(i => i.pageIndex === p).sort((a, b) => a.sortOrder - b.sortOrder)
  );

  const nextOrder = (pageIndex: number) => {
    const pi = allItems.filter(i => i.pageIndex === pageIndex);
    return pi.length > 0 ? Math.max(...pi.map(i => i.sortOrder)) + 1 : 1;
  };

  const addPage = async () => {
    await db.projects.update(projectId, { pageCount: pageCount + 1, updatedAt: Date.now() });
    toast({ title: `تم إضافة صفحة ${pageCount + 1}` });
  };

  const duplicatePage = async (pageIdx: number) => {
    const srcItems = pages[pageIdx];
    const newPageIdx = pageIdx + 1;
    const itemsAfter = allItems.filter(i => i.pageIndex >= newPageIdx);
    for (const item of itemsAfter) {
      await db.projectItems.update(item.id!, { pageIndex: item.pageIndex + 1 });
    }
    for (const item of srcItems) {
      await db.projectItems.add({
        projectId, pageIndex: newPageIdx,
        sortOrder: item.sortOrder,
        questionId: item.questionId,
        contentType: item.contentType,
        imageData: item.imageData,
        textContent: item.textContent,
        layoutData: item.layoutData,
        questionStyle: item.questionStyle,
        createdAt: Date.now(),
      });
    }
    await db.projects.update(projectId, { pageCount: pageCount + 1, updatedAt: Date.now() });
    toast({ title: `تم نسخ الصفحة ${pageIdx + 1}` });
  };

  const movePage = async (pageIdx: number, dir: 'up' | 'down') => {
    const otherIdx = dir === 'up' ? pageIdx - 1 : pageIdx + 1;
    if (otherIdx < 0 || otherIdx >= pageCount) return;
    const myItems    = allItems.filter(i => i.pageIndex === pageIdx);
    const otherItems = allItems.filter(i => i.pageIndex === otherIdx);
    for (const i of myItems)    await db.projectItems.update(i.id!, { pageIndex: otherIdx });
    for (const i of otherItems) await db.projectItems.update(i.id!, { pageIndex: pageIdx });
  };

  // ── Drop handler ──────────────────────────────────────────────────────────
  const handleDrop = async (e: React.DragEvent, pageIndex: number) => {
    e.preventDefault();
    setDragOverPage(null);
    setDragOverFilePage(null);

    // File drop from OS
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith('image/')) {
        toast({ title: 'يُقبل الصور فقط (PNG، JPG، …)', variant: 'destructive' });
        return;
      }
      await addImageFile(file, pageIndex);
      return;
    }

    const qId = e.dataTransfer.getData('q-id');
    if (!qId) return;

    // جلب السؤال من قاعدة البيانات بالمعرّف — يتجنب حد حجم بيانات السحب
    const q = await db.questions.get(Number(qId));
    if (!q) {
      toast({ title: 'تعذّر العثور على السؤال', variant: 'destructive' });
      return;
    }

    await db.projectItems.add({
      projectId, pageIndex,
      sortOrder: nextOrder(pageIndex),
      questionId: q.id,
      contentType: q.contentType ?? 'image',
      imageData: q.imageData,
      textContent: q.textContent,
      layoutData: q.layoutData,
      createdAt: Date.now(),
    });
    await db.projects.update(projectId, { updatedAt: Date.now() });

    const typeLabel =
      q.contentType === 'rich-layout' ? '📐 تمت إضافة التخطيط' :
      q.contentType === 'text'        ? '📝 تمت إضافة النص' :
      '📷 تمت إضافة الصورة';
    toast({ title: typeLabel });
  };

  const handleDragOver = (e: React.DragEvent, pageIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (e.dataTransfer.types.includes('Files')) {
      setDragOverFilePage(pageIndex);
      setDragOverPage(null);
    } else {
      setDragOverPage(pageIndex);
      setDragOverFilePage(null);
    }
  };

  const handleDragLeave = (e: React.DragEvent, pageIndex: number) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverPage    === pageIndex) setDragOverPage(null);
    if (dragOverFilePage === pageIndex) setDragOverFilePage(null);
  };

  const addImageFile = (file: File, pageIndex: number): Promise<void> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = async () => {
        await db.projectItems.add({
          projectId, pageIndex,
          sortOrder: nextOrder(pageIndex),
          contentType: 'uploaded-image',
          imageData: reader.result as string,
          createdAt: Date.now(),
        });
        await db.projects.update(projectId, { updatedAt: Date.now() });
        toast({ title: '🖼️ تمت إضافة الصورة' });
        resolve();
      };
      reader.readAsDataURL(file);
    });

  const addTextBlock = async (pageIndex: number) => {
    await db.projectItems.add({
      projectId, pageIndex,
      sortOrder: nextOrder(pageIndex),
      contentType: 'custom-text',
      textContent: '',
      createdAt: Date.now(),
    });
    await db.projects.update(projectId, { updatedAt: Date.now() });
  };

  const deleteItem = async (id: number) => {
    await db.projectItems.delete(id);
    await db.projects.update(projectId, { updatedAt: Date.now() });
  };

  const moveItem = async (item: LocalProjectItem, dir: 'up' | 'down') => {
    const sorted = allItems
      .filter(i => i.pageIndex === item.pageIndex)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(i => i.id === item.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const sibling = sorted[swapIdx];
    await db.projectItems.update(item.id!, { sortOrder: sibling.sortOrder });
    await db.projectItems.update(sibling.id!, { sortOrder: item.sortOrder });
  };

  const moveToPosition = async (item: LocalProjectItem, newIdx: number) => {
    const sorted = allItems
      .filter(i => i.pageIndex === item.pageIndex)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const curIdx = sorted.findIndex(i => i.id === item.id);
    if (curIdx === newIdx || newIdx < 0 || newIdx >= sorted.length) return;
    // Reorder: remove from current, insert at new position, re-assign sortOrders
    const reordered = [...sorted];
    const [moved] = reordered.splice(curIdx, 1);
    reordered.splice(newIdx, 0, moved);
    await Promise.all(
      reordered.map((it, i) => db.projectItems.update(it.id!, { sortOrder: (i + 1) * 10 }))
    );
  };

  const saveDesign = async (d: ProjectDesign) => {
    await db.projects.update(projectId, { design: d, updatedAt: Date.now() });
    toast({ title: '✅ تم حفظ التصميم' });
  };

  const pageBgStyle = getPageBgStyle(design.bgColor);
  // alias (was previously incorrectly referenced as pageBg)
  const pageBg = pageBgStyle;
  const sepClass =
    design.separator === 'dashed' ? 'border-b border-dashed border-gray-200 mt-2 mb-1' :
    design.separator === 'solid'  ? 'border-b border-gray-300 mt-2 mb-1' : '';
  const qpp = design.questionsPerPage ?? 0;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-page { page-break-after: always; }
        }
      `}</style>

      <input
        ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0];
          if (f) await addImageFile(f, uploadTargetPage);
          e.target.value = '';
        }}
      />

      {showDesign && (
        <DesignPanel design={design} onSave={saveDesign} onClose={() => setShowDesign(false)} />
      )}

      {showExport && (
        <ExportDialog projectTitle={project.title} onClose={() => setShowExport(false)} />
      )}

      {showTemplatePicker && (
        <TemplateLibrary
          open={showTemplatePicker}
          onClose={() => setShowTemplatePicker(false)}
          totalPages={pageCount}
          currentPage={1}
          onOpen={(tpl, opts) => { applyTemplate(tpl.id, opts); }}
        />
      )}

      <div className="flex flex-col h-full overflow-hidden bg-muted/10" dir="rtl">

        {/* ── Toolbar ── */}
        <div className="shrink-0 border-b bg-background flex items-center justify-between px-4 py-2 shadow-sm no-print flex-wrap gap-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-sm truncate max-w-[160px]">{project.title}</h2>
            {project.category && (
              <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                {project.category}
              </span>
            )}
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {pages.length} {pages.length === 1 ? 'صفحة' : 'صفحات'}
            </span>
            {qpp > 0 && (
              <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                {qpp} أسئلة/صفحة
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Category quick-edit */}
            <CategoryQuickEdit projectId={projectId} current={project.category} />
            {/* Template picker */}
            <Button
              variant={activeTemplate ? 'default' : 'outline'}
              size="sm"
              className={`h-8 text-xs gap-1.5 max-w-[120px] ${activeTemplate ? 'bg-violet-600 hover:bg-violet-700 text-white border-0' : ''}`}
              onClick={() => setShowTemplatePicker(true)}
              title={activeTemplate ? `القالب: ${activeTemplate.name}` : 'اختر قالب صفحة'}
            >
              <LayoutTemplate className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{activeTemplate ? activeTemplate.name : 'قالب'}</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
              onClick={() => setShowDesign(true)}>
              <Settings2 className="w-3.5 h-3.5" />تصميم
            </Button>
            {/* Page count control */}
            <div className="flex items-center border border-border rounded-lg h-8 overflow-hidden shrink-0">
              <button
                onClick={async () => {
                  if (pageCount <= 1) return;
                  await db.projects.update(projectId, { pageCount: pageCount - 1, updatedAt: Date.now() });
                  toast({ title: `الصفحات: ${pageCount - 1}` });
                }}
                disabled={pageCount <= 1}
                className="w-7 h-full flex items-center justify-center hover:bg-muted border-r border-border text-muted-foreground hover:text-foreground transition-colors text-lg font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                title="حذف آخر صفحة"
              >−</button>
              <span className="px-1.5 text-xs font-semibold tabular-nums select-none">{pageCount}</span>
              <button
                onClick={addPage}
                className="w-7 h-full flex items-center justify-center hover:bg-muted border-l border-border text-muted-foreground hover:text-foreground transition-colors text-lg font-medium"
                title="إضافة صفحة"
              >+</button>
            </div>
            <Button size="sm"
              className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0"
              onClick={() => setShowExport(true)}>
              <Download className="w-3.5 h-3.5" />تصدير
            </Button>
          </div>
        </div>

        {/* ── Pages ── */}
        <div className="flex-1 overflow-auto p-6 flex flex-col items-center gap-8 pb-24" id="print-area">
          {pages.map((items, pageIdx) => {
            const isOver     = dragOverPage     === pageIdx;
            const isFileOver = dragOverFilePage === pageIdx;
            const anyOver    = isOver || isFileOver;

            return (
              <div key={pageIdx} className="w-full max-w-[794px] print-page">

                {/* Page label + controls */}
                <div className="flex items-center justify-between mb-2 no-print">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      صفحة {pageIdx + 1}
                    </span>
                    {qpp > 0 && items.length > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        items.length === qpp ? 'bg-green-100 text-green-700' :
                        items.length > qpp ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {items.length}/{qpp}
                      </span>
                    )}
                    {pageIdx > 0 && (
                      <button onClick={() => movePage(pageIdx, 'up')}
                        className="w-5 h-5 rounded border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                        title="تحريك الصفحة للأعلى">
                        <MoveUp className="w-3 h-3" />
                      </button>
                    )}
                    {pageIdx < pageCount - 1 && (
                      <button onClick={() => movePage(pageIdx, 'down')}
                        className="w-5 h-5 rounded border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                        title="تحريك الصفحة للأسفل">
                        <MoveDown className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm"
                      className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-primary"
                      onClick={() => { setUploadTargetPage(pageIdx); fileInputRef.current?.click(); }}>
                      <ImagePlus className="w-3 h-3" />رفع صورة
                    </Button>
                    <Button variant="ghost" size="sm"
                      className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-primary"
                      onClick={() => addTextBlock(pageIdx)}>
                      <Type className="w-3 h-3" />نص حر
                    </Button>
                    <Button variant="ghost" size="sm"
                      className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-primary"
                      onClick={() => duplicatePage(pageIdx)}
                      title="نسخ هذه الصفحة">
                      <Copy className="w-3 h-3" />نسخ
                    </Button>
                    {pageIdx > 0 && (
                      <Button variant="ghost" size="sm"
                        className="h-6 text-[11px] gap-1 text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          if (!confirm('حذف هذه الصفحة وكل عناصرها؟')) return;
                          await db.projectItems.bulkDelete(items.map(i => i.id!));
                          await db.projects.update(projectId, {
                            pageCount: Math.max(1, pageCount - 1),
                            updatedAt: Date.now(),
                          });
                        }}>
                        <Trash2 className="w-3 h-3" />حذف
                      </Button>
                    )}
                  </div>
                </div>

                {/* ── A4 page ── */}
                <div
                  className={`shadow-xl w-full aspect-[1/1.414] relative border transition-all group/page ${
                    anyOver ? 'border-primary ring-2 ring-primary ring-inset' : 'border-border'
                  }`}
                  style={pageBg}
                  onDragOver={e => handleDragOver(e, pageIdx)}
                  onDragLeave={e => handleDragLeave(e, pageIdx)}
                  onDrop={e => handleDrop(e, pageIdx)}
                >
                  {/* خلفية قالب الصفحة المصمّم */}
                  {activeTemplate?.thumbnail && (
                    <div
                      className="absolute inset-0 z-0 pointer-events-none"
                      style={{ backgroundImage: `url(${activeTemplate.thumbnail})`, backgroundSize: '100% 100%' }}
                    />
                  )}

                  {/* زر منتقي الخلفية السريع */}
                  <div className="no-print absolute top-2 left-2 z-40">
                    <button
                      onClick={() => setBgPickerPage(prev => prev === pageIdx ? null : pageIdx)}
                      className="w-7 h-7 rounded-full bg-white/85 border border-border/60 shadow flex items-center justify-center hover:bg-white hover:shadow-md transition-all opacity-0 group-hover/page:opacity-100"
                      title="خلفية الصفحة"
                    >
                      <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    {bgPickerPage === pageIdx && (
                      <div
                        className="absolute top-8 left-0 z-50 bg-white border border-border shadow-2xl rounded-xl p-3 w-64"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold">خلفية الصفحة</span>
                          <button onClick={() => setBgPickerPage(null)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <BgPanel
                          value={design.bgColor ?? 'white'}
                          onChange={async id => {
                            await db.projects.update(projectId, { design: { ...design, bgColor: id }, updatedAt: Date.now() });
                            setBgPickerPage(null);
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {/* Watermark */}
                  {design.watermark && (
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden"
                      style={{ opacity: (design.watermarkOpacity ?? 15) / 100 }}
                    >
                      <span
                        className="text-gray-500 font-bold select-none"
                        style={{
                          fontSize: 'clamp(24px, 5vw, 48px)',
                          transform: 'rotate(-35deg)',
                          whiteSpace: 'nowrap',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {design.watermark}
                      </span>
                    </div>
                  )}

                  {/* Header */}
                  {design.showHeader && (
                    <div className="absolute top-0 inset-x-0 px-8 pt-5 pb-2 border-b border-dashed border-gray-200 flex justify-between items-start z-20">
                      <div className="text-[10px] text-gray-400">{project.academyName || ''}</div>
                      <div className="text-center">
                        <div className="font-bold text-sm text-gray-800">{project.title}</div>
                        {project.subject && <div className="text-[10px] text-gray-500 mt-0.5">{project.subject}</div>}
                      </div>
                      <div className="text-[10px] text-gray-400">{project.teacherName || ''}</div>
                    </div>
                  )}

                  {/* Content — scrollable in editor, clipped on print */}
                  <div
                    className={`absolute inset-0 px-7 flex flex-col z-20 ${
                      design.showHeader ? 'pt-14' : 'pt-5'
                    } pb-8 overflow-y-auto print:overflow-hidden`}
                    style={{ gap: qpp > 0 ? '2px' : '6px' }}
                  >
                    {design.twoColumn ? (
                      <div className="grid grid-cols-2 gap-3 h-full min-h-0">
                        {[0, 1].map(col => {
                          const colItems = items.filter((_, i) => i % 2 === col);
                          const colQpp   = qpp > 0 ? Math.ceil(qpp / 2) : 0;
                          return (
                            <div key={col} className="flex flex-col min-h-0 overflow-hidden"
                              style={{ gap: colQpp > 0 ? '2px' : '6px' }}>
                              {colItems.map((item, localIdx) => (
                                <div
                                  key={item.id}
                                  style={colQpp > 0
                                    ? { flex: `0 0 calc(${100 / colQpp}% - 2px)`, overflow: 'hidden', minHeight: 0 }
                                    : { flexShrink: 0 }
                                  }
                                >
                                  <ItemRenderer
                                    item={item}
                                    idx={col + localIdx * 2}
                                    itemCount={items.length}
                                    design={design}
                                    qppMode={colQpp > 0}
                                    qpp={colQpp}
                                    sepClass={colQpp > 0 ? '' : sepClass}
                                    onMoveUp={() => moveItem(item, 'up')}
                                    onMoveDown={() => moveItem(item, 'down')}
                                    onDelete={() => deleteItem(item.id!)}
                                    onSaveText={t => db.projectItems.update(item.id!, { textContent: t })}
                                    onSaveStyle={s => db.projectItems.update(item.id!, { questionStyle: s })}
                                    onMoveToPosition={pos => moveToPosition(item, pos)}
                                  />
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ) : items.length > 0 ? (
                      items.map((item, idx) => (
                        <div
                          key={item.id}
                          style={qpp > 0
                            ? { flex: `0 0 calc(${100 / qpp}% - 2px)`, overflow: 'hidden', minHeight: 0 }
                            : { flexShrink: 0 }
                          }
                        >
                          <ItemRenderer
                            item={item}
                            idx={idx}
                            itemCount={items.length}
                            design={design}
                            qppMode={qpp > 0}
                            qpp={qpp}
                            sepClass={qpp > 0 ? '' : sepClass}
                            onMoveUp={() => moveItem(item, 'up')}
                            onMoveDown={() => moveItem(item, 'down')}
                            onDelete={() => deleteItem(item.id!)}
                            onSaveText={t => db.projectItems.update(item.id!, { textContent: t })}
                            onSaveStyle={s => db.projectItems.update(item.id!, { questionStyle: s })}
                            onMoveToPosition={pos => moveToPosition(item, pos)}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/25 no-print gap-3 pointer-events-none">
                        <FileQuestion className="w-10 h-10" />
                        <p className="text-sm">اسحب الأسئلة من اليمين</p>
                        <p className="text-xs">أو استخدم "رفع صورة" / "نص حر" أعلاه</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="absolute bottom-0 inset-x-0 px-8 py-1.5 border-t border-dashed border-gray-200 flex justify-between items-center pointer-events-none z-20">
                    <span className="text-[9px] text-gray-400">
                      {project.teacherName ? `إعداد: ${project.teacherName}` : ''}
                    </span>
                    <span className="text-[9px] text-gray-400">صفحة {pageIdx + 1}</span>
                  </div>

                  {/* Drop overlay */}
                  {anyOver && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                      <div className={`rounded-2xl shadow-2xl px-10 py-6 flex flex-col items-center gap-2 border-2 ${
                        isFileOver
                          ? 'bg-blue-50/95 border-blue-400'
                          : 'bg-green-50/95 border-green-400'
                      }`}>
                        {isFileOver
                          ? <><ImagePlus className="w-10 h-10 text-blue-500" /><p className="text-base font-bold text-blue-700">أفلت الصورة هنا</p></>
                          : <><FileQuestion className="w-10 h-10 text-green-600" /><p className="text-base font-bold text-green-700">أفلت السؤال هنا ✓</p></>
                        }
                        <p className="text-xs text-gray-500">صفحة {pageIdx + 1}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add page */}
          <button
            className="no-print w-full max-w-[794px] h-14 border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            onClick={addPage}
          >
            <Plus className="w-4 h-4" />
            إضافة صفحة جديدة
          </button>
        </div>
      </div>
    </>
  );
}

// ─── ItemRenderer ──────────────────────────────────────────────────────────────
function ItemRenderer({ item, idx, itemCount, design, qppMode, qpp, sepClass, onMoveUp, onMoveDown, onDelete, onSaveText, onSaveStyle, onMoveToPosition }: {
  item: LocalProjectItem;
  idx: number;
  itemCount: number;
  design: ProjectDesign;
  qppMode: boolean;
  qpp: number;
  sepClass: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onSaveText: (t: string) => void;
  onSaveStyle: (s: QuestionStyle) => void;
  onMoveToPosition: (pos: number) => void;
}) {
  const [hover, setHover] = useState(false);
  const [posMode, setPosMode] = useState(false);
  const [posVal, setPosVal] = useState('');
  const ct      = item.contentType ?? 'image';
  const isText  = ct === 'text' || ct === 'custom-text';
  const isRich  = ct === 'rich-layout';
  const label   = getLabel(idx, design.numbering, design.numberingStart ?? 1, design.numberingSuffix ?? '');
  const fontCls = FONT_CLASS[design.fontSize];

  // ألوان الصفحة الموحّدة كقيم افتراضية — يمكن للسؤال تجاوزها بتنسيقه الخاص
  const effectiveStyle: QuestionStyle = {
    mode: 'layout',   // قيمة افتراضية مطلوبة نوعياً
    ...(design.pageTextColor   ? { textColor:   design.pageTextColor   } : {}),
    ...(design.pageChoiceColor ? { choiceColor: design.pageChoiceColor } : {}),
    ...(design.pageNumberColor ? { numberColor: design.pageNumberColor } : {}),
    ...item.questionStyle,
  };

  return (
    <div
      className={`relative ${qppMode ? 'h-full flex flex-col' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Number badge — shown for non-rich items only (rich items handle their own number) */}
      {label && !isRich && (
        <div className="flex items-center gap-1 mb-0.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-[10px] shrink-0">
            {label}
          </span>
        </div>
      )}

      {/* Content area */}
      <div className={`flex gap-1.5 ${qppMode ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>
        <div className={`flex-1 min-w-0 ${qppMode ? 'h-full overflow-hidden' : ''}`}>
          {isRich && item.layoutData ? (
            // ── Rich layout (new) ────────────────────────────────────────────
            <QuestionContainer
              layout={item.layoutData}
              style={effectiveStyle}
              displayNumber={label}
              onStyleChange={onSaveStyle}
              showControls={true}
              qppCount={qpp}
              className={`w-full ${qppMode ? 'h-full' : ''}`}
            />
          ) : isText ? (
            ct === 'custom-text' ? (
              <div dir="rtl" className={qppMode ? 'h-full overflow-hidden' : ''}>
                <TextBlock item={item} onSave={onSaveText} />
              </div>
            ) : (
              <SmartTextRenderer
                text={item.textContent ?? ''}
                fontCls={fontCls}
                qppMode={qppMode}
              />
            )
          ) : (
            <img
              src={item.imageData}
              alt={`سؤال ${idx + 1}`}
              draggable={false}
              className="w-full object-contain object-right"
              style={qppMode
                ? { width: '100%', height: '100%', maxHeight: '100%', objectFit: 'contain', objectPosition: 'right top' }
                : { maxHeight: design.twoColumn ? 110 : 140 }
              }
            />
          )}
        </div>

        {/* Inline edit controls */}
        <div className={`no-print shrink-0 flex flex-col gap-0.5 transition-opacity ${hover ? 'opacity-100' : 'opacity-0'}`}>
          <button onClick={onMoveUp}
            className="w-5 h-5 rounded bg-white border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors">
            <ChevronUp className="w-3 h-3" />
          </button>
          {/* Position badge — click to jump to exact position */}
          {posMode ? (
            <input
              type="number" min={1} max={itemCount}
              value={posVal}
              autoFocus
              className="w-5 h-5 text-[8px] text-center border border-primary rounded outline-none bg-white font-bold"
              onChange={e => setPosVal(e.target.value)}
              onBlur={() => {
                const n = parseInt(posVal);
                if (!isNaN(n) && n >= 1 && n <= itemCount) onMoveToPosition(n - 1);
                setPosMode(false);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const n = parseInt(posVal);
                  if (!isNaN(n) && n >= 1 && n <= itemCount) onMoveToPosition(n - 1);
                  setPosMode(false);
                }
                if (e.key === 'Escape') setPosMode(false);
              }}
            />
          ) : (
            <button
              onClick={() => { setPosMode(true); setPosVal(String(idx + 1)); }}
              className="w-5 h-5 rounded bg-amber-100 border border-amber-300 shadow-sm flex items-center justify-center text-amber-700 font-bold text-[8px] hover:bg-amber-200 transition-colors"
              title="انقر لتغيير الموضع"
            >
              {idx + 1}
            </button>
          )}
          <button onClick={onMoveDown}
            className="w-5 h-5 rounded bg-white border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors">
            <ChevronDown className="w-3 h-3" />
          </button>
          <button onClick={onDelete}
            className="w-5 h-5 rounded bg-white border border-border shadow-sm flex items-center justify-center text-destructive hover:bg-destructive hover:text-white hover:border-destructive transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Separator */}
      {!qppMode && sepClass && !isRich && <div className={sepClass} />}
      {!qppMode && sepClass && isRich && <div className="border-b border-dashed border-gray-200 mt-1 mb-0.5" />}
    </div>
  );
}

// ─── SmartTextRenderer ────────────────────────────────────────────────────────
function SmartTextRenderer({ text, fontCls, qppMode }: {
  text: string;
  fontCls: string;
  qppMode: boolean;
}) {
  const sections = parseExamText(text);
  const [showRaw, setShowRaw] = useState(false);

  if (showRaw) {
    return (
      <div dir="rtl" className={`${qppMode ? 'h-full overflow-hidden' : ''} relative`}>
        <button
          className="no-print absolute top-0 left-0 text-[9px] text-primary underline z-10"
          onClick={() => setShowRaw(false)}>
          عرض منسق
        </button>
        <p className={`${fontCls} text-gray-700 leading-relaxed whitespace-pre-wrap pt-4`}>{text}</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className={`${qppMode ? 'h-full flex flex-col overflow-hidden' : 'flex flex-col'} relative gap-0`}>
      <button
        className="no-print self-start text-[8px] text-muted-foreground/40 hover:text-primary leading-none mb-0.5"
        title="عرض النص الخام"
        onClick={() => setShowRaw(true)}
      >
        ⟨ نص خام
      </button>

      {sections.map((sec, i) => {
        switch (sec.type) {
          case 'poem-header':
            return (
              <p key={i}
                className={`${fontCls} font-semibold text-gray-700 text-center pb-0.5 border-b border-dashed border-gray-300 mb-1`}>
                {sec.text}
              </p>
            );
          case 'poem-verse':
            return (
              <div
                key={i}
                dir="rtl"
                className="grid items-center gap-x-1 py-px"
                style={{ gridTemplateColumns: '1fr auto 1fr' }}
              >
                <p className={`${fontCls} text-gray-800 leading-relaxed text-right`}
                  style={{ fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif" }}>
                  {sec.sadr}
                </p>
                <span className="text-gray-400 text-[10px] font-bold select-none px-1 text-center">***</span>
                <p className={`${fontCls} text-gray-800 leading-relaxed text-right`}
                  style={{ fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif" }}>
                  {sec.ajuz}
                </p>
              </div>
            );
          case 'footnote':
            return (
              <p key={i}
                className="text-[10px] text-gray-500 leading-snug bg-amber-50 rounded-sm px-2 py-0.5 border-r-[3px] border-amber-400 mt-0.5">
                {sec.text}
              </p>
            );
          case 'question-stem':
            return (
              <p key={i} className={`${fontCls} font-bold text-gray-900 leading-snug mt-1`}>
                {sec.text}
              </p>
            );
          case 'choice':
            return (
              <div key={i} className="flex items-baseline gap-1 py-px pr-1">
                <span className="shrink-0 font-bold text-primary text-[11px] w-4 text-center leading-tight">
                  {sec.letter}
                </span>
                <span className="shrink-0 text-gray-300 text-[8px]">●</span>
                <span className={`${fontCls} text-gray-700 flex-1 leading-snug`}>{sec.text}</span>
              </div>
            );
          default:
            return (
              <p key={i} className={`${fontCls} text-gray-800 leading-relaxed`}>
                {sec.text}
              </p>
            );
        }
      })}
    </div>
  );
}
