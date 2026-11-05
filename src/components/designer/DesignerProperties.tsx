import React, { useState } from 'react';
import type {
  DesignerState, DesignerAction, DesignerElement, TextElement,
  ShapeElement, ImageElement, DynamicFieldElement, SmartZoneElement,
  TableElement, StickerElement, PageBackground, LineElement, DecoFrameElement,
} from '@/lib/designer-types';
import { DYNAMIC_FIELDS, SMART_ZONE_DEFS, FIELD_FILL_OPTIONS } from '@/lib/designer-types';
import { SUBJECT_THEMES, getFrameById, FRAME_TEMPLATES } from '@/lib/frame-templates';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

interface Props { state: DesignerState; dispatch: React.Dispatch<DesignerAction>; }

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/50">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors uppercase tracking-wide">
        {title}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-[11px] text-muted-foreground w-20 shrink-0 text-right">{label}</Label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step = 1, suffix }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(+e.target.value)}
        className="h-7 text-xs px-2 flex-1" />
      {suffix && <span className="text-[10px] text-muted-foreground shrink-0">{suffix}</span>}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        className="w-7 h-7 cursor-pointer border rounded shrink-0" />
      <Input value={value} onChange={e => onChange(e.target.value)}
        className="h-7 text-xs px-2 flex-1 font-mono" />
    </div>
  );
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full h-7 border rounded px-2 text-xs bg-background">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// Common geometry props
function GeometrySection({ el, upd }: { el: DesignerElement; upd: (c: Partial<DesignerElement>) => void }) {
  return (
    <Section title="الموضع والحجم">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">X%</Label>
          <NumberInput value={Math.round(el.x * 10) / 10} onChange={v => upd({ x: v })} step={0.1} />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Y%</Label>
          <NumberInput value={Math.round(el.y * 10) / 10} onChange={v => upd({ y: v })} step={0.1} />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">العرض%</Label>
          <NumberInput value={Math.round(el.width * 10) / 10} onChange={v => upd({ width: Math.max(1, v) })} min={1} step={0.1} />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">الارتفاع%</Label>
          <NumberInput value={Math.round(el.height * 10) / 10} onChange={v => upd({ height: Math.max(0.5, v) })} min={0.5} step={0.1} />
        </div>
      </div>
      <Row label="الدوران">
        <div className="flex items-center gap-1">
          <input type="range" min={-180} max={180} value={el.rotation} className="flex-1"
            onChange={e => upd({ rotation: +e.target.value })} />
          <span className="text-[10px] w-10 text-right text-muted-foreground">{el.rotation}°</span>
          <button onClick={() => upd({ rotation: 0 })} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted">
            <RotateCcw className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </Row>
      <Row label="الشفافية">
        <div className="flex items-center gap-1">
          <input type="range" min={10} max={100} value={el.opacity} className="flex-1"
            onChange={e => upd({ opacity: +e.target.value })} />
          <span className="text-[10px] w-8 text-right text-muted-foreground">{el.opacity}%</span>
        </div>
      </Row>
    </Section>
  );
}

function FlagsSection({ el, upd }: { el: DesignerElement; upd: (c: Partial<DesignerElement>) => void }) {
  return (
    <Section title="الحالة">
      <div className="flex flex-wrap gap-3">
        {[
          { key: 'visible', label: 'مرئي' }, { key: 'locked', label: 'مقفل' },
          { key: 'printable', label: 'قابل للطباعة' },
        ].map(f => (
          <label key={f.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={!!(el as any)[f.key]} onChange={e => upd({ [f.key]: e.target.checked } as any)}
              className="w-3.5 h-3.5 accent-primary" />
            {f.label}
          </label>
        ))}
      </div>
      <Row label="الطبقة">
        <NumberInput value={el.zIndex} onChange={v => upd({ zIndex: v })} min={0} />
      </Row>
    </Section>
  );
}

// Text properties
function TextProps({ el, upd }: { el: TextElement; upd: (c: Partial<TextElement>) => void }) {
  return (
    <>
      <Section title="المحتوى النصي">
        <textarea value={el.content} onChange={e => upd({ content: e.target.value })}
          className="w-full border rounded text-xs px-2 py-1.5 resize-none h-20 bg-background font-sans" dir={el.direction} />
      </Section>
      <Section title="الخط">
        <Row label="الحجم">
          <NumberInput value={el.fontSize} onChange={v => upd({ fontSize: Math.max(6, v) })} min={6} max={200} suffix="pt" />
        </Row>
        <Row label="العائلة">
          <SelectInput value={el.fontFamily} onChange={v => upd({ fontFamily: v })} options={[
            { value: 'inherit', label: 'الافتراضي' },
            { value: 'Cairo', label: 'Cairo' }, { value: 'Tajawal', label: 'Tajawal' },
            { value: 'Almarai', label: 'Almarai' }, { value: 'IBM Plex Sans Arabic', label: 'IBM Plex Arabic' },
            { value: 'serif', label: 'Serif' }, { value: 'monospace', label: 'Monospace' },
          ]} />
        </Row>
        <div className="flex gap-1">
          {[
            { key: 'fontWeight', val: 'bold', label: 'B', cls: 'font-bold' },
            { key: 'fontStyle', val: 'italic', label: 'I', cls: 'italic' },
            { key: 'textDecoration', val: 'underline', label: 'U', cls: 'underline' },
          ].map(b => (
            <button key={b.key} onClick={() => upd({ [b.key]: (el as any)[b.key] === b.val ? 'normal' : b.val } as any)}
              className={`w-8 h-7 rounded border text-xs font-medium transition-colors ${b.cls} ${(el as any)[b.key] === b.val ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
              {b.label}
            </button>
          ))}
        </div>
        <Row label="المحاذاة">
          <div className="flex gap-1">
            {[{ v: 'right', l: '→' }, { v: 'center', l: '=' }, { v: 'left', l: '←' }].map(a => (
              <button key={a.v} onClick={() => upd({ textAlign: a.v as any })}
                className={`flex-1 h-7 rounded border text-xs transition-colors ${el.textAlign === a.v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                {a.l}
              </button>
            ))}
          </div>
        </Row>
        <Row label="الاتجاه">
          <div className="flex gap-1">
            {[{ v: 'rtl', l: 'RTL عربي' }, { v: 'ltr', l: 'LTR إنجليزي' }].map(d => (
              <button key={d.v} onClick={() => upd({ direction: d.v as any })}
                className={`flex-1 h-7 rounded border text-xs transition-colors ${el.direction === d.v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                {d.l}
              </button>
            ))}
          </div>
        </Row>
      </Section>
      <Section title="الألوان والحدود">
        <Row label="لون النص">
          <ColorInput value={el.color} onChange={v => upd({ color: v })} />
        </Row>
        <Row label="الخلفية">
          <ColorInput value={el.backgroundColor ?? '#ffffff'} onChange={v => upd({ backgroundColor: v })} />
        </Row>
        <Row label="لون الحدود">
          <ColorInput value={el.borderColor ?? '#000000'} onChange={v => upd({ borderColor: v })} />
        </Row>
        <Row label="سماكة الحدود">
          <NumberInput value={el.borderWidth ?? 0} onChange={v => upd({ borderWidth: v })} min={0} max={20} suffix="px" />
        </Row>
        <Row label="تقريب الزوايا">
          <NumberInput value={el.borderRadius ?? 0} onChange={v => upd({ borderRadius: v })} min={0} max={50} suffix="px" />
        </Row>
        <Row label="المسافة الداخلية">
          <NumberInput value={el.padding ?? 4} onChange={v => upd({ padding: v })} min={0} max={50} suffix="px" />
        </Row>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={!!el.shadow} onChange={e => upd({ shadow: e.target.checked })}
            className="w-3.5 h-3.5 accent-primary" />
          ظل النص
        </label>
      </Section>
    </>
  );
}

// Shape properties
function ShapeProps({ el, upd }: { el: ShapeElement; upd: (c: Partial<ShapeElement>) => void }) {
  return (
    <Section title="الشكل">
      <Row label="لون التعبئة">
        <ColorInput value={el.fill} onChange={v => upd({ fill: v })} />
      </Row>
      <Row label="لون الحدود">
        <ColorInput value={el.stroke} onChange={v => upd({ stroke: v })} />
      </Row>
      <Row label="سماكة الحدود">
        <NumberInput value={el.strokeWidth} onChange={v => upd({ strokeWidth: v })} min={0} max={20} suffix="px" />
      </Row>
      {el.type === 'rect' && (
        <Row label="تقريب الزوايا">
          <NumberInput value={el.borderRadius ?? 0} onChange={v => upd({ borderRadius: v })} min={0} max={50} suffix="px" />
        </Row>
      )}
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={!!el.shadow} onChange={e => upd({ shadow: e.target.checked })}
          className="w-3.5 h-3.5 accent-primary" />
        ظل
      </label>
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">تدرج لوني</Label>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={!!el.gradient} onChange={e => upd({ gradient: e.target.checked ? { type: 'linear', color1: el.fill, color2: '#ffffff', angle: 180 } : undefined })}
            className="w-3.5 h-3.5 accent-primary" />
          تفعيل التدرج
        </label>
        {el.gradient && (
          <div className="space-y-1.5 ps-3 border-s-2 border-primary/30">
            <Row label="اللون 1"><ColorInput value={el.gradient.color1} onChange={v => upd({ gradient: { ...el.gradient!, color1: v } })} /></Row>
            <Row label="اللون 2"><ColorInput value={el.gradient.color2} onChange={v => upd({ gradient: { ...el.gradient!, color2: v } })} /></Row>
            <Row label="الزاوية"><NumberInput value={el.gradient.angle ?? 0} onChange={v => upd({ gradient: { ...el.gradient!, angle: v } })} min={0} max={360} suffix="°" /></Row>
          </div>
        )}
      </div>
    </Section>
  );
}

// Dynamic field properties
function DynFieldProps({ el, upd }: { el: DynamicFieldElement; upd: (c: Partial<DynamicFieldElement>) => void }) {
  return (
    <Section title="الحقل الديناميكي">
      <Row label="نوع الحقل">
        <SelectInput value={el.fieldKey} onChange={v => {
          const def = DYNAMIC_FIELDS.find(f => f.key === v);
          upd({ fieldKey: v, fieldLabel: def?.label ?? v });
        }} options={DYNAMIC_FIELDS.map(f => ({ value: f.key, label: f.label }))} />
      </Row>
      <Row label="القيمة الافتراضية">
        <Input value={el.defaultValue} onChange={e => upd({ defaultValue: e.target.value })}
          className="h-7 text-xs" placeholder="فارغ" />
      </Row>
      <Row label="حجم الخط">
        <NumberInput value={el.fontSize} onChange={v => upd({ fontSize: v })} min={6} max={100} suffix="pt" />
      </Row>
      <Row label="لون النص">
        <ColorInput value={el.color} onChange={v => upd({ color: v })} />
      </Row>
    </Section>
  );
}

// Smart zone / named field properties
function ZoneProps({ el, upd }: { el: SmartZoneElement; upd: (c: Partial<SmartZoneElement>) => void }) {
  const fillOptions = FIELD_FILL_OPTIONS.map(o => ({ value: o.value, label: `${o.category} · ${o.label}` }));
  const currentFill = FIELD_FILL_OPTIONS.find(o => o.value === (el.fillContent ?? 'custom'));
  const needsSequence = !!currentFill?.needsSequence;
  const ornamentOptions = [
    { value: 'none',             label: 'بلا زخرفة' },
    { value: 'corner-dots',      label: 'نقاط الزوايا' },
    { value: 'corner-brackets',  label: 'أقواس الزوايا' },
    { value: 'double-border',    label: 'حد مزدوج' },
    { value: 'dashed-inner',     label: 'حد داخلي منقط' },
    { value: 'islamic-corners',  label: 'زخرفة إسلامية' },
    { value: 'leaf-corners',     label: 'أوراق زاوية' },
    { value: 'star-corners',     label: 'نجوم زاوية' },
  ];
  const patternOptions = [
    { value: 'lines',    label: 'خطوط أفقية' },
    { value: 'dots',     label: 'نقاط' },
    { value: 'grid',     label: 'مربعات' },
    { value: 'zigzag',   label: 'متعرج' },
    { value: 'cross',    label: 'تقاطعات' },
    { value: 'diagonal', label: 'قطري' },
  ];

  return (
    <>
      {/* ─── معرّف الحقل ──────────────────────────────────────────── */}
      <Section title="هوية الحقل">
        <Row label="اسم الحقل">
          <Input value={el.customName ?? el.label ?? ''} onChange={e => upd({ customName: e.target.value })}
            className="h-7 text-xs" placeholder="مثال: اسم الطالب / منطقة الأسئلة" />
        </Row>
        <Row label="نوع المحتوى">
          <SelectInput value={el.fillContent ?? 'custom'} onChange={v => upd({ fillContent: v as any })}
            options={fillOptions} />
        </Row>
        {needsSequence && (
          <Row label="رقم السؤال">
            <Input type="number" min={1} value={el.fillSequence ?? 1}
              onChange={e => upd({ fillSequence: Math.max(1, Number(e.target.value) || 1) })}
              className="h-7 text-xs" placeholder="1 = السؤال الأول" />
          </Row>
        )}
        <Row label="غرض المنطقة">
          <SelectInput value={el.purpose} onChange={v => upd({ purpose: v as any })}
            options={Object.entries(SMART_ZONE_DEFS).map(([k, v]) => ({ value: k, label: v.label }))} />
        </Row>
        {(el.fillContent === 'custom' || !el.fillContent) && (
          <Row label="قيمة افتراضية">
            <Input value={el.fillDefault ?? ''} onChange={e => upd({ fillDefault: e.target.value })}
              className="h-7 text-xs" placeholder="النص الذي يظهر افتراضياً" />
          </Row>
        )}
        <Row label="يظهر في">
          <SelectInput value={el.showOn ?? 'all'} onChange={v => upd({ showOn: v as any })}
            options={[
              { value: 'all',   label: 'كل الصفحات' },
              { value: 'first', label: 'الصفحة الأولى فقط' },
              { value: 'last',  label: 'الصفحة الأخيرة فقط' },
              { value: 'odd',   label: 'الصفحات الفردية' },
              { value: 'even',  label: 'الصفحات الزوجية' },
            ]} />
        </Row>
        <Row label="نمط الترقيم">
          <SelectInput value={el.numberingStyle ?? 'none'} onChange={v => upd({ numberingStyle: v as any })}
            options={[
              { value: 'none',            label: 'بدون ترقيم' },
              { value: 'decimal',         label: '1, 2, 3' },
              { value: 'arabic-indic',    label: '١، ٢، ٣' },
              { value: 'arabic-letters',  label: 'أ، ب، ج' },
              { value: 'latin-lower',     label: 'a, b, c' },
              { value: 'latin-upper',     label: 'A, B, C' },
              { value: 'roman-lower',     label: 'i, ii, iii' },
              { value: 'roman-upper',     label: 'I, II, III' },
            ]} />
        </Row>
        {(el.numberingStyle && el.numberingStyle !== 'none') && (
          <>
            <Row label="لاحقة الرقم">
              <Input value={el.numberingSuffix ?? ') '} onChange={e => upd({ numberingSuffix: e.target.value })}
                className="h-7 text-xs" placeholder=") " />
            </Row>
            <Row label="بداية الترقيم">
              <Input type="number" value={el.numberingStart ?? 1}
                onChange={e => upd({ numberingStart: Math.max(1, +e.target.value || 1) })}
                className="h-7 text-xs" />
            </Row>
          </>
        )}
      </Section>

      {/* ─── الحدود والخلفية ─────────────────────────────────────── */}
      <Section title="الحدود والخلفية">
        <Row label="نمط الحدود">
          <SelectInput value={el.borderStyle} onChange={v => upd({ borderStyle: v as any })}
            options={[
              { value: 'solid',  label: 'متصل' },
              { value: 'dashed', label: 'متقطع' },
              { value: 'dotted', label: 'منقط' },
              { value: 'none',   label: 'بلا حدود' },
            ]} />
        </Row>
        {el.borderStyle !== 'none' && (
          <>
            <Row label="لون الحدود">
              <ColorInput value={el.borderColor} onChange={v => upd({ borderColor: v })} />
            </Row>
            <Row label="سماكة الحدود">
              <NumberInput value={el.borderWidth} onChange={v => upd({ borderWidth: v })} min={1} max={20} suffix="px" />
            </Row>
          </>
        )}
        <Row label="تقريب الزوايا">
          <NumberInput value={el.borderRadius ?? 0} onChange={v => upd({ borderRadius: v })} min={0} max={80} suffix="px" />
        </Row>
        <Row label="خلفية المنطقة">
          <ColorInput value={el.backgroundColor} onChange={v => upd({ backgroundColor: v })} />
        </Row>
      </Section>

      {/* ─── التدرج اللوني ───────────────────────────────────────── */}
      <Section title="التدرج اللوني" defaultOpen={false}>
        <label className="flex items-center gap-2 text-xs cursor-pointer mb-2">
          <input type="checkbox" checked={el.gradient?.enabled ?? false}
            onChange={e => upd({ gradient: { ...(el.gradient ?? { color1: '#ffffff', color2: '#e2e8f0', angle: 135, type: 'linear' }), enabled: e.target.checked } })}
            className="w-3.5 h-3.5 accent-primary" />
          تفعيل التدرج
        </label>
        {el.gradient?.enabled && (
          <>
            <Row label="اللون 1"><ColorInput value={el.gradient.color1} onChange={v => upd({ gradient: { ...el.gradient!, color1: v } })} /></Row>
            <Row label="اللون 2"><ColorInput value={el.gradient.color2} onChange={v => upd({ gradient: { ...el.gradient!, color2: v } })} /></Row>
            <Row label="الزاوية"><NumberInput value={el.gradient.angle} onChange={v => upd({ gradient: { ...el.gradient!, angle: v } })} min={0} max={360} suffix="°" /></Row>
            <Row label="النوع">
              <SelectInput value={el.gradient.type} onChange={v => upd({ gradient: { ...el.gradient!, type: v as any } })}
                options={[{ value: 'linear', label: 'خطي' }, { value: 'radial', label: 'دائري' }]} />
            </Row>
          </>
        )}
      </Section>

      {/* ─── الظل ────────────────────────────────────────────────── */}
      <Section title="الظل" defaultOpen={false}>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={!!el.shadow} onChange={e => upd({ shadow: e.target.checked })}
            className="w-3.5 h-3.5 accent-primary" />
          إظهار الظل
        </label>
        {el.shadow && (
          <>
            <Row label="لون الظل"><ColorInput value={el.shadowColor ?? '#00000033'} onChange={v => upd({ shadowColor: v })} /></Row>
            <Row label="شدة الظل"><NumberInput value={el.shadowBlur ?? 8} onChange={v => upd({ shadowBlur: v })} min={1} max={50} suffix="px" /></Row>
          </>
        )}
      </Section>

      {/* ─── الزخرفة ─────────────────────────────────────────────── */}
      <Section title="الزخرفة والإطار" defaultOpen={false}>
        <Row label="نوع الزخرفة">
          <SelectInput value={el.ornament ?? 'none'} onChange={v => upd({ ornament: v as any })}
            options={ornamentOptions} />
        </Row>
        {(el.ornament && el.ornament !== 'none') && (
          <>
            <Row label="لون الزخرفة">
              <ColorInput value={el.ornamentColor ?? el.borderColor} onChange={v => upd({ ornamentColor: v })} />
            </Row>
            <Row label="حجم الزخرفة">
              <NumberInput value={el.ornamentSize ?? 16} onChange={v => upd({ ornamentSize: v })} min={6} max={60} suffix="px" />
            </Row>
          </>
        )}
      </Section>

      {/* ─── النمط الداخلي ───────────────────────────────────────── */}
      <Section title="النمط الداخلي" defaultOpen={false}>
        <label className="flex items-center gap-2 text-xs cursor-pointer mb-2">
          <input type="checkbox" checked={!!el.pattern}
            onChange={e => upd({ pattern: e.target.checked ? { type: 'lines', color: '#94a3b8', opacity: 30, size: 20 } : undefined })}
            className="w-3.5 h-3.5 accent-primary" />
          تفعيل النمط الداخلي
        </label>
        {el.pattern && (
          <>
            <Row label="نوع النمط">
              <SelectInput value={el.pattern.type} onChange={v => upd({ pattern: { ...el.pattern!, type: v as any } })}
                options={patternOptions} />
            </Row>
            <Row label="لون النمط"><ColorInput value={el.pattern.color} onChange={v => upd({ pattern: { ...el.pattern!, color: v } })} /></Row>
            <Row label="حجم النمط"><NumberInput value={el.pattern.size} onChange={v => upd({ pattern: { ...el.pattern!, size: v } })} min={4} max={40} suffix="px" /></Row>
            <Row label="شفافية النمط">
              <div className="flex items-center gap-1">
                <input type="range" min={5} max={100} value={el.pattern.opacity} className="flex-1"
                  onChange={e => upd({ pattern: { ...el.pattern!, opacity: +e.target.value } })} />
                <span className="text-[10px] w-8 text-right text-muted-foreground">{el.pattern.opacity}%</span>
              </div>
            </Row>
          </>
        )}
      </Section>

      {/* ─── ملء تلقائي ──────────────────────────────────────────── */}
      <Section title="خيارات إضافية" defaultOpen={false}>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={!!el.autoFill} onChange={e => upd({ autoFill: e.target.checked })}
            className="w-3.5 h-3.5 accent-primary" />
          ملء تلقائي بالمحتوى عند التطبيق
        </label>
      </Section>
    </>
  );
}

// Image properties
function ImageProps({ el, upd }: { el: ImageElement; upd: (c: Partial<ImageElement>) => void }) {
  return (
    <Section title="إعدادات الصورة">
      <Row label="ملاءمة">
        <SelectInput value={el.objectFit} onChange={v => upd({ objectFit: v as any })}
          options={[{ value: 'cover', label: 'ملء' }, { value: 'contain', label: 'ملاءمة' }, { value: 'fill', label: 'مط' }]} />
      </Row>
      {[
        { label: 'السطوع', key: 'brightness', max: 200, def: 100 },
        { label: 'التباين', key: 'contrast', max: 200, def: 100 },
        { label: 'التشبع', key: 'saturation', max: 200, def: 100 },
        { label: 'الضبابية', key: 'blur', max: 20, def: 0 },
      ].map(adj => (
        <Row key={adj.key} label={adj.label}>
          <div className="flex items-center gap-1">
            <input type="range" min={0} max={adj.max} value={(el as any)[adj.key] ?? adj.def} className="flex-1"
              onChange={e => upd({ [adj.key]: +e.target.value } as any)} />
            <span className="text-[10px] w-8 text-right text-muted-foreground">{(el as any)[adj.key] ?? adj.def}</span>
          </div>
        </Row>
      ))}
      <Row label="تقريب الزوايا">
        <NumberInput value={el.borderRadius ?? 0} onChange={v => upd({ borderRadius: v })} min={0} max={50} suffix="px" />
      </Row>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={!!el.shadow} onChange={e => upd({ shadow: e.target.checked })}
          className="w-3.5 h-3.5 accent-primary" />
        ظل الصورة
      </label>
    </Section>
  );
}

// Line properties
function LineProps({ el, upd }: { el: LineElement; upd: (c: Partial<LineElement>) => void }) {
  return (
    <Section title="إعدادات الخط">
      <Row label="اللون"><ColorInput value={el.stroke} onChange={v => upd({ stroke: v })} /></Row>
      <Row label="السماكة"><NumberInput value={el.strokeWidth} onChange={v => upd({ strokeWidth: v })} min={1} max={20} suffix="px" /></Row>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={!!el.strokeDash} onChange={e => upd({ strokeDash: e.target.checked })}
          className="w-3.5 h-3.5 accent-primary" />
        خط متقطع
      </label>
      {el.type === 'arrow' && (
        <>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={!!el.arrowEnd} onChange={e => upd({ arrowEnd: e.target.checked })}
              className="w-3.5 h-3.5 accent-primary" />
            سهم في النهاية
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={!!el.arrowStart} onChange={e => upd({ arrowStart: e.target.checked })}
              className="w-3.5 h-3.5 accent-primary" />
            سهم في البداية
          </label>
        </>
      )}
    </Section>
  );
}

// Background properties panel (when no element selected)
function BackgroundPanel({ bg, bgType, dispatch, currentPageIndex }: {
  bg: PageBackground; bgType: string;
  dispatch: React.Dispatch<DesignerAction>;
  currentPageIndex: number;
}) {
  const upd = (changes: Partial<PageBackground>) =>
    dispatch({ type: 'SET_BACKGROUND', bg: changes });

  return (
    <>
      <Section title="نوع الخلفية">
        <Row label="طبقة الخلفية">
          <SelectInput value={bg.type} onChange={v => upd({ type: v as any })} options={[
            { value: 'color', label: 'لون صلب' },
            { value: 'gradient', label: 'تدرج لوني' },
            { value: 'image', label: 'صورة' },
            { value: 'pattern', label: 'نمط' },
            { value: 'texture', label: 'ملمس' },
          ]} />
        </Row>
        {bg.type === 'color' && (
          <Row label="اللون"><ColorInput value={bg.color} onChange={v => upd({ color: v })} /></Row>
        )}
        {bg.type === 'gradient' && (
          <>
            <Row label="اللون 1"><ColorInput value={bg.gradient?.color1 ?? '#ffffff'} onChange={v => upd({ gradient: { ...bg.gradient!, color1: v } })} /></Row>
            <Row label="اللون 2"><ColorInput value={bg.gradient?.color2 ?? '#e2e8f0'} onChange={v => upd({ gradient: { ...bg.gradient!, color2: v } })} /></Row>
            <Row label="الزاوية"><NumberInput value={bg.gradient?.angle ?? 180} onChange={v => upd({ gradient: { ...bg.gradient!, angle: v } })} min={0} max={360} suffix="°" /></Row>
            <Row label="النوع">
              <SelectInput value={bg.gradient?.type ?? 'linear'} onChange={v => upd({ gradient: { ...bg.gradient!, type: v as any } })} options={[{ value: 'linear', label: 'خطي' }, { value: 'radial', label: 'دائري' }]} />
            </Row>
          </>
        )}
        {bg.type === 'pattern' && (
          <>
            <Row label="النمط">
              <SelectInput value={bg.patternType ?? 'grid'} onChange={v => upd({ patternType: v as any })} options={[
                { value: 'lines', label: 'خطوط أفقية' }, { value: 'grid', label: 'مربعات' },
                { value: 'dots', label: 'نقاط' }, { value: 'triangles', label: 'مثلثات' },
                { value: 'hexagons', label: 'سداسيات' }, { value: 'music', label: 'سطر موسيقي' },
                { value: 'drawing', label: 'ورق رسم' },
              ]} />
            </Row>
            <Row label="لون النمط"><ColorInput value={bg.patternColor ?? '#94a3b8'} onChange={v => upd({ patternColor: v })} /></Row>
            <Row label="الحجم"><NumberInput value={bg.patternSize ?? 25} onChange={v => upd({ patternSize: v })} min={5} max={100} suffix="px" /></Row>
          </>
        )}
        <Row label="الشفافية">
          <div className="flex items-center gap-1">
            <input type="range" min={10} max={100} value={bg.opacity} className="flex-1"
              onChange={e => upd({ opacity: +e.target.value })} />
            <span className="text-[10px] w-8 text-right text-muted-foreground">{bg.opacity}%</span>
          </div>
        </Row>
        {[
          { label: 'السطوع', key: 'brightness', max: 200 },
          { label: 'التباين', key: 'contrast', max: 200 },
          { label: 'التشبع', key: 'saturation', max: 200 },
          { label: 'الضبابية', key: 'blur', max: 20 },
        ].map(adj => (
          <Row key={adj.key} label={adj.label}>
            <div className="flex items-center gap-1">
              <input type="range" min={0} max={adj.max} value={(bg as any)[adj.key] ?? 100} className="flex-1"
                onChange={e => upd({ [adj.key]: +e.target.value } as any)} />
              <span className="text-[10px] w-8 text-right text-muted-foreground">{(bg as any)[adj.key] ?? 100}</span>
            </div>
          </Row>
        ))}
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={bg.applyToAll} onChange={e => upd({ applyToAll: e.target.checked })}
            className="w-3.5 h-3.5 accent-primary" />
          تطبيق على جميع الصفحات
        </label>
      </Section>
    </>
  );
}

// Multi-select properties
function MultiProps({ state, dispatch }: { state: DesignerState; dispatch: React.Dispatch<DesignerAction> }) {
  const page = state.pages[state.currentPageIndex];
  const elements = page?.elements.filter(e => state.selectedIds.includes(e.id)) ?? [];
  if (elements.length === 0) return null;

  const avgOpacity = Math.round(elements.reduce((s, e) => s + e.opacity, 0) / elements.length);

  return (
    <Section title={`${elements.length} عنصر محدد`}>
      <Row label="الشفافية">
        <div className="flex items-center gap-1">
          <input type="range" min={10} max={100} value={avgOpacity} className="flex-1"
            onChange={e => elements.forEach(el => dispatch({ type: 'UPDATE_ELEMENT', id: el.id, changes: { opacity: +e.target.value } }))} />
          <span className="text-[10px] w-8 text-right text-muted-foreground">{avgOpacity}%</span>
        </div>
      </Row>
      <div className="flex gap-2">
        <button onClick={() => elements.forEach(el => dispatch({ type: 'TOGGLE_VISIBLE', ids: [el.id] }))}
          className="flex-1 h-7 rounded border text-xs hover:bg-muted">إظهار/إخفاء</button>
        <button onClick={() => elements.forEach(el => dispatch({ type: 'TOGGLE_LOCK', ids: [el.id] }))}
          className="flex-1 h-7 rounded border text-xs hover:bg-muted">قفل/فتح</button>
      </div>
    </Section>
  );
}

export default function DesignerProperties({ state, dispatch }: Props) {
  const page = state.pages[state.currentPageIndex];
  const selectedIds = state.selectedIds;
  const el = selectedIds.length === 1 ? page?.elements.find(e => e.id === selectedIds[0]) : null;

  const upd = (changes: Partial<DesignerElement>) => {
    if (!el) return;
    dispatch({ type: 'UPDATE_ELEMENT', id: el.id, changes });
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto text-sm" dir="rtl">
      {/* Header */}
      <div className="px-3 py-2 bg-muted/30 border-b shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {el ? `خصائص: ${el.name || el.type}` : selectedIds.length > 1 ? `${selectedIds.length} عنصر` : 'الصفحة'}
        </span>
      </div>

      {/* Multi-select */}
      {selectedIds.length > 1 && <MultiProps state={state} dispatch={dispatch} />}

      {/* Single element */}
      {el && (
        <>
          <GeometrySection el={el} upd={upd} />
          {(el.type === 'text' || el.type === 'heading' || el.type === 'subheading') && (
            <TextProps el={el as TextElement} upd={c => upd(c as any)} />
          )}
          {(el.type === 'rect' || el.type === 'circle' || el.type === 'triangle' || el.type === 'star') && (
            <ShapeProps el={el as ShapeElement} upd={c => upd(c as any)} />
          )}
          {(el.type === 'line' || el.type === 'arrow') && (
            <LineProps el={el as LineElement} upd={c => upd(c as any)} />
          )}
          {el.type === 'image' && (
            <ImageProps el={el as ImageElement} upd={c => upd(c as any)} />
          )}
          {el.type === 'dynamic-field' && (
            <DynFieldProps el={el as DynamicFieldElement} upd={c => upd(c as any)} />
          )}
          {el.type === 'smart-zone' && (
            <ZoneProps el={el as SmartZoneElement} upd={c => upd(c as any)} />
          )}
          <FlagsSection el={el} upd={upd} />
        </>
      )}

      {/* No selection: background */}
      {selectedIds.length === 0 && page && (
        <BackgroundPanel
          bg={page.background}
          bgType={page.settings.backgroundType}
          dispatch={dispatch}
          currentPageIndex={state.currentPageIndex}
        />
      )}
    </div>
  );
}
