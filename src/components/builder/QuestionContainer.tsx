/**
 * QuestionContainer — عرض السؤال بتخطيطه الأصلي
 *
 * وضعان:
 *   layout   — عرض وفي للتخطيط الأصلي (عناصر مُعاد بناؤها بنسبها الأصلية)
 *   editable — نفس الشكل لكن كل عنصر قابل للتعديل
 *
 * لوحة الخصائص:
 *   - لون النص / الاختيارات / رقم السؤال
 *   - حجم الخط (مضاعف)
 *   - الهوامش / الحدود / الظل
 *   - إعادة الترقيم / إظهار-إخفاء الرقم
 *   - حفظ كقالب
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  QuestionLayout, QuestionStyle, LayoutLine, LocalTemplate,
  DEFAULT_QUESTION_STYLE, db,
} from '@/lib/db';
import { cn } from '@/lib/utils';
import {
  Settings2, Eye, Pencil, Save, LayoutTemplate, X,
  ChevronDown, ChevronRight,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeStyle(base: QuestionStyle, override?: Partial<QuestionStyle>): QuestionStyle {
  return { ...DEFAULT_QUESTION_STYLE, ...base, ...(override ?? {}) };
}

/** أعِد النسبة المئوية لحجم الخط بالنسبة للحاوية */
function scaledFont(fontSize: number, baseFontSize: number, scale: number) {
  // نسبة الخط الأصلي إلى الخط الأساسي → ضرب في المضاعف
  const ratio = fontSize / baseFontSize;
  return ratio * scale;
}

// ─── Line Renderers ────────────────────────────────────────────────────────────

function QuestionNumber({ number, style, editable, onEdit }: {
  number: string;
  style: QuestionStyle;
  editable: boolean;
  onEdit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(number);

  if (!style.showNumber) return null;

  if (editable && editing) {
    return (
      <input
        autoFocus
        className="inline-block w-10 text-center text-xs font-bold rounded border border-primary/40 outline-none focus:ring-1 ring-primary/30"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { setEditing(false); onEdit(val); }}
        onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onEdit(val); } }}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-[11px] shrink-0',
        editable && 'cursor-pointer hover:ring-2 ring-primary/30',
      )}
      style={{
        background: style.numberColor ?? '#f59e0b',
        color: '#fff',
      }}
      onClick={() => editable && setEditing(true)}
      title={editable ? 'انقر لتعديل الرقم' : undefined}
    >
      {val}
    </span>
  );
}

function EditableText({ text, className, style: cssProp, onSave }: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);

  if (editing) {
    return (
      <textarea
        autoFocus
        className={cn('w-full border border-primary/40 rounded px-1 py-0.5 outline-none focus:ring-1 ring-primary/30 resize-none', className)}
        style={cssProp}
        value={val}
        rows={Math.max(1, val.split('\n').length)}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { setEditing(false); onSave(val); }}
        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { setEditing(false); onSave(val); } }}
      />
    );
  }

  return (
    <span
      className={cn(className, 'cursor-text hover:bg-primary/5 rounded px-0.5 transition-colors')}
      style={cssProp}
      onClick={() => setEditing(true)}
      title="انقر للتعديل"
    >
      {val || <span className="text-muted-foreground/40 italic">فارغ</span>}
    </span>
  );
}

// ─── Single Line Renderer ──────────────────────────────────────────────────────

function LineRenderer({
  line, style, editable, baseFontSize, containerWidthPx,
  onLineEdit,
}: {
  line: LayoutLine;
  style: QuestionStyle;
  editable: boolean;
  baseFontSize: number;
  containerWidthPx: number;
  onLineEdit: (patch: Partial<LayoutLine>) => void;
}) {
  const fontScale = style.fontScale ?? 1;
  const sizeRatio = scaledFont(line.fontSize, baseFontSize, fontScale);
  // حجم الخط كنسبة من حجم viewport → نستخدم em نسبياً
  const fw = line.fontWeight === 'bold' ? '700' : '400';
  const ff = line.fontFamily ?? "'Cairo', 'Tajawal', sans-serif";
  const textColor = style.textColor ?? '#1a1a1a';
  const lineSpacing = style.lineSpacing ?? 1.6;

  const textStyle: React.CSSProperties = {
    fontWeight: fw,
    fontFamily: ff,
    color: textColor,
    lineHeight: lineSpacing,
    fontSize: `${sizeRatio}em`,
    direction: 'rtl',
    unicodeBidi: 'embed',
  };

  switch (line.type) {

    case 'question-number':
      return (
        <div className="flex items-center gap-1.5 mb-1">
          <QuestionNumber
            number={line.number ?? line.text ?? '1'}
            style={style}
            editable={editable}
            onEdit={v => onLineEdit({ number: v, text: v })}
          />
        </div>
      );

    case 'question-stem':
      return editable ? (
        <div className="flex items-start gap-1.5 mb-1">
          <EditableText
            text={line.text ?? ''}
            className="flex-1 leading-relaxed"
            style={{ ...textStyle, fontWeight: '700' }}
            onSave={v => onLineEdit({ text: v })}
          />
        </div>
      ) : (
        <p className="mb-1" style={{ ...textStyle, fontWeight: '700' }}>
          {line.text}
        </p>
      );

    case 'poem-header':
      return editable ? (
        <div className="mb-0.5 pb-0.5 border-b border-dashed border-gray-300 text-center">
          <EditableText
            text={line.text ?? ''}
            style={{ ...textStyle, textAlign: 'center' }}
            onSave={v => onLineEdit({ text: v })}
          />
        </div>
      ) : (
        <p className="mb-0.5 pb-0.5 border-b border-dashed border-gray-300 text-center"
          style={{ ...textStyle }}>
          {line.text}
        </p>
      );

    case 'poem-verse':
      return (
        <div
          className="grid items-center gap-x-1 py-px"
          style={{ gridTemplateColumns: '1fr auto 1fr', direction: 'rtl' }}
          dir="rtl"
        >
          {editable ? (
            <>
              <EditableText
                text={line.sadr ?? ''}
                style={{ ...textStyle, textAlign: 'right', fontFamily: "'Amiri','Scheherazade New','Noto Naskh Arabic',serif" }}
                onSave={v => onLineEdit({ sadr: v })}
              />
              <span className="text-gray-400 text-[10px] font-bold select-none px-1 text-center">***</span>
              <EditableText
                text={line.ajuz ?? ''}
                style={{ ...textStyle, textAlign: 'right', fontFamily: "'Amiri','Scheherazade New','Noto Naskh Arabic',serif" }}
                onSave={v => onLineEdit({ ajuz: v })}
              />
            </>
          ) : (
            <>
              <p style={{ ...textStyle, textAlign: 'right', fontFamily: "'Amiri','Scheherazade New','Noto Naskh Arabic',serif" }}>
                {line.sadr}
              </p>
              <span className="text-gray-400 text-[10px] font-bold select-none px-1 text-center">***</span>
              <p style={{ ...textStyle, textAlign: 'right', fontFamily: "'Amiri','Scheherazade New','Noto Naskh Arabic',serif" }}>
                {line.ajuz}
              </p>
            </>
          )}
        </div>
      );

    case 'choice':
      return (
        <div className="flex items-baseline gap-1 py-px pr-1" dir="rtl">
          <span
            className="shrink-0 font-bold text-[11px] w-4 text-center leading-tight"
            style={{ color: style.choiceColor ?? '#2563eb' }}
          >
            {line.letter}
          </span>
          <span className="shrink-0 text-gray-300 text-[8px]">●</span>
          {editable ? (
            <EditableText
              text={line.text ?? ''}
              className="flex-1"
              style={{ ...textStyle, color: textColor }}
              onSave={v => onLineEdit({ text: v })}
            />
          ) : (
            <span style={{ ...textStyle, color: textColor }} className="flex-1">
              {line.text}
            </span>
          )}
        </div>
      );

    case 'footnote':
      return (
        <p
          className="text-[10px] text-gray-500 leading-snug bg-amber-50 rounded-sm px-2 py-0.5 border-r-[3px] border-amber-400 mt-0.5"
          style={{ direction: 'rtl' }}
          dir="rtl"
        >
          {editable ? (
            <EditableText
              text={line.text ?? ''}
              style={{ fontSize: '0.85em', color: '#78716c' }}
              onSave={v => onLineEdit({ text: v })}
            />
          ) : line.text}
        </p>
      );

    default:
      return editable ? (
        <div className="mb-0.5" dir="rtl">
          <EditableText
            text={line.text ?? ''}
            className="w-full"
            style={textStyle}
            onSave={v => onLineEdit({ text: v })}
          />
        </div>
      ) : (
        <p style={textStyle} className="mb-0.5" dir="rtl">
          {line.text}
        </p>
      );
  }
}

// ─── Question Properties Panel ─────────────────────────────────────────────────

function PropertiesPanel({
  style, onSave, onClose, onSaveTemplate,
}: {
  style: QuestionStyle;
  onSave: (s: QuestionStyle) => void;
  onClose: () => void;
  onSaveTemplate: (s: QuestionStyle, name: string) => void;
}) {
  const [s, setS] = useState<QuestionStyle>(style);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateInput, setShowTemplateInput] = useState(false);
  // Keep local state in sync when the parent's style changes (e.g. new item selected)
  useEffect(() => { setS(style); }, [style]);
  // Live-apply every change so the user sees the effect immediately —
  // no need to click "تطبيق" for the change to take effect.
  const up = (patch: Partial<QuestionStyle>) => {
    setS(prev => {
      const next = { ...prev, ...patch };
      onSave(next);
      return next;
    });
  };

  const templates = useLiveQuery(() => db.templates.orderBy('createdAt').reverse().toArray(), []);

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl" onClick={onClose}>
      <div
        className="w-72 bg-white shadow-2xl flex flex-col overflow-hidden border-l border-border ms-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm">خصائص السؤال</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Mode */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">وضع العرض</p>
            <div className="grid grid-cols-2 gap-2">
              {([['layout', 'تخطيط', Eye], ['editable', 'قابل للتعديل', Pencil]] as const).map(([v, label, Icon]) => (
                <button key={v} onClick={() => up({ mode: v })}
                  className={cn(
                    'border rounded-lg py-2 px-3 text-xs font-medium transition-colors flex items-center gap-1.5',
                    s.mode === v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                  )}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {s.mode === 'layout' ? 'عرض السؤال كما في الـPDF — لا تعديل' : 'كل عنصر قابل للتعديل مع الحفاظ على التنسيق'}
            </p>
          </div>

          {/* Number display */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">إظهار رقم السؤال</span>
            <button
              onClick={() => up({ showNumber: !s.showNumber })}
              className={cn('relative w-9 h-5 rounded-full transition-colors', s.showNumber ? 'bg-primary' : 'bg-muted-foreground/30')}
            >
              <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', s.showNumber ? 'right-0.5' : 'left-0.5')} />
            </button>
          </div>

          {/* Font scale */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-muted-foreground">حجم الخط</p>
              <span className="text-xs tabular-nums text-primary font-bold">{((s.fontScale ?? 1) * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0.6" max="2" step="0.05"
              value={s.fontScale ?? 1}
              onChange={e => up({ fontScale: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          {/* Line spacing */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-muted-foreground">تباعد الأسطر</p>
              <span className="text-xs tabular-nums text-primary font-bold">{(s.lineSpacing ?? 1.6).toFixed(1)}</span>
            </div>
            <input type="range" min="1" max="3" step="0.1"
              value={s.lineSpacing ?? 1.6}
              onChange={e => up({ lineSpacing: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          {/* Colors */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">الألوان</p>
            <div className="space-y-2">
              {([
                ['textColor', 'النص الرئيسي', '#1a1a1a'],
                ['numberColor', 'رقم السؤال', '#f59e0b'],
                ['choiceColor', 'الاختيارات', '#2563eb'],
                ['bgColor', 'الخلفية', 'transparent'],
                ['borderColor', 'الحدود', 'transparent'],
              ] as [keyof QuestionStyle, string, string][]).map(([key, label, def]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={(s[key] as string) || def}
                      onChange={e => up({ [key]: e.target.value } as any)}
                      className="w-6 h-6 rounded cursor-pointer border border-border p-0"
                    />
                    {s[key] && s[key] !== def && (
                      <button onClick={() => up({ [key]: undefined } as any)}
                        className="text-[9px] text-muted-foreground hover:text-destructive">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Border / Padding */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">الإطار</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">سُمك الحدود</span>
                <input type="number" min={0} max={8} value={s.borderWidth ?? 0}
                  onChange={e => up({ borderWidth: parseInt(e.target.value) })}
                  className="w-14 text-center text-xs border border-border rounded px-2 py-1" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">زوايا مدوّرة</span>
                <input type="number" min={0} max={24} value={s.borderRadius ?? 0}
                  onChange={e => up({ borderRadius: parseInt(e.target.value) })}
                  className="w-14 text-center text-xs border border-border rounded px-2 py-1" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">هوامش داخلية</span>
                <input type="number" min={0} max={32} value={s.padding ?? 8}
                  onChange={e => up({ padding: parseInt(e.target.value) })}
                  className="w-14 text-center text-xs border border-border rounded px-2 py-1" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">ظل</span>
                <button
                  onClick={() => up({ shadow: !s.shadow })}
                  className={cn('relative w-9 h-5 rounded-full transition-colors', s.shadow ? 'bg-primary' : 'bg-muted-foreground/30')}
                >
                  <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', s.shadow ? 'right-0.5' : 'left-0.5')} />
                </button>
              </div>
            </div>
          </div>

          {/* Templates */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">القوالب</p>
            {templates && templates.length > 0 && (
              <div className="mb-2 space-y-1">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setS({ ...t.style })}
                    className="w-full text-right text-xs border border-border rounded-lg px-3 py-1.5 hover:bg-primary/5 hover:border-primary/40 transition-colors flex items-center gap-1.5"
                  >
                    <LayoutTemplate className="w-3 h-3 text-primary shrink-0" />
                    <span className="flex-1 truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
            {showTemplateInput ? (
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  className="flex-1 border border-border rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 ring-primary/30"
                  placeholder="اسم القالب..."
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && templateName.trim()) {
                      onSaveTemplate(s, templateName.trim());
                      setTemplateName('');
                      setShowTemplateInput(false);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (templateName.trim()) {
                      onSaveTemplate(s, templateName.trim());
                      setTemplateName('');
                      setShowTemplateInput(false);
                    }
                  }}
                  className="px-2 py-1 bg-primary text-white rounded-lg text-xs hover:bg-primary/90"
                >
                  حفظ
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowTemplateInput(true)}
                className="w-full text-xs border border-dashed border-border rounded-lg py-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                حفظ التنسيق الحالي كقالب
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-border rounded-lg py-2 text-xs font-medium hover:bg-muted transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={() => { onSave(s); onClose(); }}
            className="flex-1 bg-primary text-white rounded-lg py-2 text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            تطبيق
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main QuestionContainer ────────────────────────────────────────────────────

export interface QuestionContainerProps {
  layout: QuestionLayout;
  style?: QuestionStyle;
  /** رقم السؤال الظاهر (قد يختلف عن الرقم المضمّن في التخطيط) */
  displayNumber?: number | string | null;
  onStyleChange?: (s: QuestionStyle) => void;
  /** هل تظهر أدوات التحكم (إعدادات)؟ */
  showControls?: boolean;
  className?: string;
  /**
   * عدد الأسئلة في الصفحة — عندما يكون > 0 يعمل المكوّن في وضع الـ slot
   * ويضغط المحتوى تلقائياً ليناسب المساحة المخصصة له
   */
  qppCount?: number;
}

export function QuestionContainer({
  layout,
  style: styleProp,
  displayNumber,
  onStyleChange,
  showControls = true,
  className,
  qppCount = 0,
}: QuestionContainerProps) {
  const [showProps, setShowProps] = useState(false);
  const [lines, setLines] = useState<LayoutLine[]>(layout.lines);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef     = useRef<HTMLDivElement>(null);

  /** حجم الخط المضغوط — يُحسب لاحقاً عند الفيض */
  const [scaledFontPx, setScaledFontPx] = useState<number | undefined>(undefined);

  const inQppMode = qppCount > 0;

  const style = mergeStyle(DEFAULT_QUESTION_STYLE, styleProp);
  const editable = style.mode === 'editable';

  const handleLineEdit = useCallback((idx: number, patch: Partial<LayoutLine>) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }, []);

  const handleSaveTemplate = useCallback(async (s: QuestionStyle, name: string) => {
    await db.templates.add({ name, style: s, createdAt: Date.now() });
  }, []);

  // ── Scale-to-fit logic ───────────────────────────────────────────────────────
  // في وضع qpp: قِس ارتفاع المحتوى مقابل حجم الـ slot وقلّل الخط إذا فاض
  useEffect(() => {
    if (!inQppMode) {
      setScaledFontPx(undefined);
      return;
    }
    // إعادة الضبط ثم القياس بعد رسم الـ DOM
    setScaledFontPx(undefined);
    const id = requestAnimationFrame(() => {
      const outer = containerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const outerH = outer.clientHeight;
      const innerH = inner.scrollHeight;
      if (outerH > 0 && innerH > outerH * 1.02) {
        const currentFontPx = parseFloat(getComputedStyle(inner).fontSize) || 14;
        const newFontPx = Math.max(7, currentFontPx * (outerH / innerH) * 0.97);
        setScaledFontPx(newFontPx);
      }
    });
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inQppMode, lines.length, style.fontScale, qppCount]);

  // Filter out lines with no displayable content
  const visibleLines = lines.filter(l => {
    if (l.type === 'question-number') return style.showNumber !== false;
    return true;
  });

  const padding = style.padding ?? 8;
  const containerStyle: React.CSSProperties = {
    padding: `${padding}px`,
    background: style.bgColor ?? 'transparent',
    borderWidth: style.borderWidth ?? 0,
    borderStyle: 'solid',
    borderColor: style.borderColor ?? 'transparent',
    borderRadius: style.borderRadius ?? 0,
    boxShadow: style.shadow ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
    position: 'relative',
    // في وضع qpp: احتل المساحة الكاملة للـ slot واخفِ الفائض
    ...(inQppMode ? { height: '100%', overflow: 'hidden' } : {}),
  };

  return (
    <>
      {showProps && (
        <PropertiesPanel
          style={style}
          onSave={s => onStyleChange?.(s)}
          onClose={() => setShowProps(false)}
          onSaveTemplate={handleSaveTemplate}
        />
      )}

      <div
        ref={containerRef}
        className={cn('group/qc relative', className)}
        style={containerStyle}
        dir="rtl"
      >
        {/* Controls — top-left, appear on hover */}
        {showControls && (
          <div className="no-print absolute top-0.5 left-0.5 z-10 opacity-0 group-hover/qc:opacity-100 transition-opacity flex gap-0.5">
            <button
              onClick={() => setShowProps(true)}
              className={cn(
                'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors',
                editable
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-muted/80 text-muted-foreground hover:bg-muted'
              )}
              title="خصائص السؤال"
            >
              <Settings2 className="w-2.5 h-2.5" />
              {editable ? 'تحرير' : 'تخطيط'}
            </button>
          </div>
        )}

        {/* Lines — ref هنا لقياس الارتفاع الطبيعي */}
        <div
          ref={innerRef}
          className="flex flex-col"
          style={{
            gap: `${(style.lineSpacing ?? 1.6) * 0.15}em`,
            // تطبيق حجم الخط المضغوط عند الفيض
            fontSize: scaledFontPx ? `${scaledFontPx}px` : undefined,
          }}
        >
          {visibleLines.map((line, i) => (
            <LineRenderer
              key={i}
              line={line}
              style={style}
              editable={editable}
              baseFontSize={layout.baseFontSize || 12}
              containerWidthPx={containerRef.current?.offsetWidth ?? 400}
              onLineEdit={patch => handleLineEdit(lines.indexOf(line), patch)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
