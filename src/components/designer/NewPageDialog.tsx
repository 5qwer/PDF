import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link2, Link2Off } from 'lucide-react';
import type { PageSettings, PageSize, PageUnit, PageOrientation, PageBackgroundType, PageMargins } from '@/lib/designer-types';
import { PAGE_SIZE_DIMS } from '@/lib/designer-types';

const PAGE_SIZES: { id: PageSize; label: string }[] = [
  { id: 'A4', label: 'A4 (210×297mm)' },
  { id: 'A5', label: 'A5 (148×210mm)' },
  { id: 'B5', label: 'B5 (176×250mm)' },
  { id: 'Letter', label: 'Letter (216×279mm)' },
  { id: 'Legal', label: 'Legal (216×356mm)' },
  { id: 'Executive', label: 'Executive (184×267mm)' },
  { id: 'custom', label: 'مقاس مخصص' },
];

const BACKGROUNDS: { id: PageBackgroundType; label: string; preview: string }[] = [
  { id: 'blank',      label: 'صفحة بيضاء',    preview: 'bg-white border border-gray-200' },
  { id: 'lined',      label: 'صفحة مسطرة',     preview: 'bg-[#fefce8]' },
  { id: 'grid',       label: 'صفحة مربعات',    preview: 'bg-white' },
  { id: 'dots',       label: 'صفحة نقط',       preview: 'bg-white' },
  { id: 'geometric',  label: 'صفحة هندسية',    preview: 'bg-[#f0f9ff]' },
  { id: 'music',      label: 'صفحة موسيقى',    preview: 'bg-white' },
  { id: 'drawing',    label: 'صفحة رسم',        preview: 'bg-[#fffbeb]' },
  { id: 'custom',     label: 'مخصصة',           preview: 'bg-gradient-to-br from-purple-50 to-blue-50' },
];

const defaultMargins: PageMargins = { top: 20, bottom: 20, left: 15, right: 15, linked: false };

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (settings: PageSettings) => void;
}

export default function NewPageDialog({ open, onClose, onConfirm }: Props) {
  const [size, setSize] = useState<PageSize>('A4');
  const [unit, setUnit] = useState<PageUnit>('mm');
  const [orientation, setOrientation] = useState<PageOrientation>('portrait');
  const [bgType, setBgType] = useState<PageBackgroundType>('blank');
  const [customW, setCustomW] = useState(210);
  const [customH, setCustomH] = useState(297);
  const [margins, setMargins] = useState<PageMargins>(defaultMargins);

  const setMargin = (key: 'top' | 'bottom' | 'left' | 'right', val: number) => {
    if (margins.linked) {
      setMargins(m => ({ ...m, top: val, bottom: val, left: val, right: val }));
    } else {
      setMargins(m => ({ ...m, [key]: val }));
    }
  };

  const handleConfirm = () => {
    onConfirm({
      size, unit, orientation, backgroundType: bgType,
      customWidth: size === 'custom' ? customW : undefined,
      customHeight: size === 'custom' ? customH : undefined,
      margins,
    });
    onClose();
  };

  const dims = size !== 'custom' ? PAGE_SIZE_DIMS[size] : { w: customW, h: customH };
  const finalW = orientation === 'portrait' ? dims.w : dims.h;
  const finalH = orientation === 'portrait' ? dims.h : dims.w;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">إنشاء صفحة جديدة</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* مقاس الصفحة */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">مقاس الصفحة</Label>
            <div className="grid grid-cols-3 gap-2">
              {PAGE_SIZES.map(ps => (
                <button key={ps.id} onClick={() => setSize(ps.id)}
                  className={`px-3 py-2 rounded-lg border text-sm text-right transition-all ${size === ps.id ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:border-primary/40'}`}>
                  {ps.label}
                </button>
              ))}
            </div>
            {size === 'custom' && (
              <div className="flex gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">العرض</Label>
                  <Input type="number" value={customW} onChange={e => setCustomW(+e.target.value)} className="w-28" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الارتفاع</Label>
                  <Input type="number" value={customH} onChange={e => setCustomH(+e.target.value)} className="w-28" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الوحدة</Label>
                  <select value={unit} onChange={e => setUnit(e.target.value as PageUnit)}
                    className="border rounded-md px-2 py-2 text-sm bg-background">
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="inch">inch</option>
                    <option value="px">px</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* اتجاه الصفحة */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">اتجاه الصفحة</Label>
            <div className="flex gap-3">
              {[
                { id: 'portrait', label: 'رأسي', ratio: 'h-14 w-10' },
                { id: 'landscape', label: 'أفقي', ratio: 'h-10 w-14' },
              ].map(o => (
                <button key={o.id} onClick={() => setOrientation(o.id as PageOrientation)}
                  className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg border transition-all ${orientation === o.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <div className={`${o.ratio} border-2 border-current rounded-sm flex items-center justify-center`}>
                    <span className="text-[8px] opacity-50">{finalW}×{finalH}mm</span>
                  </div>
                  <span className="text-sm font-medium">{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* هوامش الصفحة */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">هوامش الصفحة (mm)</Label>
              <button onClick={() => setMargins(m => ({ ...m, linked: !m.linked }))}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${margins.linked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                {margins.linked ? <Link2 className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
                {margins.linked ? 'مرتبط' : 'منفصل'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['top','bottom','right','left'] as const).map(side => (
                <div key={side} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {side === 'top' ? 'الهامش العلوي' : side === 'bottom' ? 'الهامش السفلي' : side === 'right' ? 'الهامش الأيمن' : 'الهامش الأيسر'}
                  </Label>
                  <Input type="number" min={0} max={100} value={margins[side]}
                    onChange={e => setMargin(side, +e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {/* نوع الصفحة */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">نوع الصفحة</Label>
            <div className="grid grid-cols-4 gap-2">
              {BACKGROUNDS.map(bg => (
                <button key={bg.id} onClick={() => setBgType(bg.id)}
                  className={`flex flex-col items-center gap-2 p-2 rounded-lg border transition-all ${bgType === bg.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <div className={`w-12 h-16 rounded ${bg.preview} shadow-sm`} />
                  <span className="text-xs text-center leading-tight">{bg.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleConfirm}>إنشاء الصفحة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
