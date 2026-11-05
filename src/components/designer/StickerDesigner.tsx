import React, { useState } from 'react';
import { db } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PREDEFINED_STICKERS } from '@/lib/designer-types';

interface Props { open: boolean; onClose: () => void; onSaved: () => void; }

const SHAPES = [
  { id: 'circle', label: 'دائرة', svg: (c: string, t: string) => `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="${c}"/>${t ? `<text x="50" y="58" text-anchor="middle" font-size="24" fill="white" font-weight="bold">${t}</text>` : ''}</svg>` },
  { id: 'rect', label: 'مستطيل', svg: (c: string, t: string) => `<svg viewBox="0 0 100 100"><rect x="5" y="15" width="90" height="70" rx="10" fill="${c}"/>${t ? `<text x="50" y="58" text-anchor="middle" font-size="20" fill="white" font-weight="bold">${t}</text>` : ''}</svg>` },
  { id: 'star', label: 'نجمة', svg: (c: string, t: string) => `<svg viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="${c}"/>${t ? `<text x="50" y="58" text-anchor="middle" font-size="16" fill="white" font-weight="bold">${t}</text>` : ''}</svg>` },
  { id: 'diamond', label: 'معين', svg: (c: string, t: string) => `<svg viewBox="0 0 100 100"><polygon points="50,5 95,50 50,95 5,50" fill="${c}"/>${t ? `<text x="50" y="56" text-anchor="middle" font-size="18" fill="white" font-weight="bold">${t}</text>` : ''}</svg>` },
  { id: 'shield', label: 'درع', svg: (c: string, t: string) => `<svg viewBox="0 0 100 100"><path d="M50,5 L90,20 V55 C90,75 70,92 50,97 C30,92 10,75 10,55 V20 Z" fill="${c}"/>${t ? `<text x="50" y="58" text-anchor="middle" font-size="18" fill="white" font-weight="bold">${t}</text>` : ''}</svg>` },
  { id: 'ribbon', label: 'شريط', svg: (c: string, t: string) => `<svg viewBox="0 0 100 100"><path d="M10,10 H90 V65 L50,90 L10,65 Z" fill="${c}"/>${t ? `<text x="50" y="50" text-anchor="middle" font-size="18" fill="white" font-weight="bold">${t}</text>` : ''}</svg>` },
  { id: 'tag', label: 'بطاقة', svg: (c: string, t: string) => `<svg viewBox="0 0 100 100"><path d="M10,10 H65 L90,50 L65,90 H10 Z" fill="${c}"/><circle cx="22" cy="30" r="6" fill="white"/>${t ? `<text x="47" y="55" text-anchor="middle" font-size="18" fill="white" font-weight="bold">${t}</text>` : ''}</svg>` },
  { id: 'explosion', label: 'انفجار', svg: (c: string, t: string) => `<svg viewBox="0 0 100 100"><polygon points="50,2 58,35 90,20 75,50 98,58 70,65 82,95 50,78 18,95 30,65 2,58 25,50 10,20 42,35" fill="${c}"/>${t ? `<text x="50" y="58" text-anchor="middle" font-size="14" fill="white" font-weight="bold">${t}</text>` : ''}</svg>` },
];

const ICONS = [
  { id: 'check', label: '✓', path: 'M10,50 L35,75 L90,20' },
  { id: 'x', label: '✗', path: 'M20,20 L80,80 M80,20 L20,80' },
  { id: 'star', label: '★', path: '' },
  { id: 'excl', label: '!', path: '' },
  { id: 'question', label: '?', path: '' },
  { id: 'plus', label: '+', path: 'M50,10 V90 M10,50 H90' },
  { id: 'arrow', label: '→', path: 'M10,50 H85 M65,25 L90,50 L65,75' },
  { id: 'bulb', label: '💡', path: '' },
];

const CATS = ['تعليمية', 'أشكال', 'أسهم', 'أختام', 'مخصصة'];

export default function StickerDesigner({ open, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [cat, setCat] = useState('مخصصة');
  const [selectedShape, setSelectedShape] = useState(SHAPES[0].id);
  const [color, setColor] = useState('#3b82f6');
  const [text, setText] = useState('');
  const [shadow, setShadow] = useState(false);
  const [glow, setGlow] = useState(false);
  const [opacity, setOpacity] = useState(100);
  const [borderRadius, setBorderRadius] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState(false);

  const shape = SHAPES.find(s => s.id === selectedShape) ?? SHAPES[0];
  const svgData = shape.svg(color, text);

  const previewStyle: React.CSSProperties = {
    opacity: opacity / 100,
    transform: `rotate(${rotation}deg) scaleX(${flip ? -1 : 1})`,
    filter: shadow ? 'drop-shadow(2px 4px 6px rgba(0,0,0,0.4))' : glow ? `drop-shadow(0 0 8px ${color})` : undefined,
  };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'أدخل اسم الملصق', variant: 'destructive' }); return; }
    const finalSvg = `<svg viewBox="0 0 100 100" style="filter:${shadow ? 'drop-shadow(2px 4px 6px rgba(0,0,0,0.4))' : glow ? `drop-shadow(0 0 8px ${color})` : 'none'}">${shape.svg(color, text).replace(/<svg[^>]*>/, '').replace('</svg>', '')}</svg>`;
    await db.designerStickers.add({
      name: name.trim(), svgData: finalSvg, category: cat,
      defaultColor: color, tags: [], createdAt: Date.now(),
    });
    toast({ title: '✅ تم حفظ الملصق في مكتبتك' });
    setName(''); setText(''); setColor('#3b82f6'); setShadow(false); setGlow(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>محرر الملصقات</DialogTitle></DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: settings */}
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">اسم الملصق</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: ملصق مهم" />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">الفئة</Label>
              <select value={cat} onChange={e => setCat(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">الشكل</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {SHAPES.map(s => (
                  <button key={s.id} onClick={() => setSelectedShape(s.id)}
                    className={`p-1.5 rounded-lg border text-xs transition-all ${selectedShape === s.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                    <span className="text-xs">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">نص داخل الملصق</Label>
              <Input value={text} onChange={e => setText(e.target.value)} placeholder="اختياري" maxLength={6} />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">اللون الأساسي</Label>
              <div className="flex gap-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="w-10 h-9 cursor-pointer border rounded" />
                <Input value={color} onChange={e => setColor(e.target.value)} className="flex-1 font-mono text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">الشفافية ({opacity}%)</Label>
                <input type="range" min={20} max={100} value={opacity} onChange={e => setOpacity(+e.target.value)} className="w-full" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الدوران ({rotation}°)</Label>
                <input type="range" min={-180} max={180} value={rotation} onChange={e => setRotation(+e.target.value)} className="w-full" />
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              {[
                { key: 'shadow', label: 'ظل', val: shadow, set: setShadow },
                { key: 'glow', label: 'توهج', val: glow, set: setGlow },
                { key: 'flip', label: 'انعكاس', val: flip, set: setFlip },
              ].map(opt => (
                <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input type="checkbox" checked={opt.val} onChange={e => opt.set(e.target.checked)} className="w-4 h-4 accent-primary" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Right: preview */}
          <div className="flex flex-col items-center gap-4">
            <Label className="text-sm font-medium self-start">المعاينة</Label>
            <div className="w-40 h-40 rounded-2xl bg-muted/30 flex items-center justify-center border shadow-inner">
              <div className="w-24 h-24" style={previewStyle}
                dangerouslySetInnerHTML={{ __html: svgData }} />
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {[16, 32, 48, 64].map(sz => (
                <div key={sz} className="flex items-center justify-center bg-muted/20 rounded-lg p-1.5">
                  <div style={{ ...previewStyle, width: sz, height: sz }}
                    dangerouslySetInnerHTML={{ __html: svgData }} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">معاينة بأحجام مختلفة</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave}>حفظ في مكتبتي</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
