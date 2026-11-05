import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, ImageIcon, Sliders, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProcessedImage {
  src: string;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (img: ProcessedImage) => void;
  mode: 'insert' | 'background';
}

export default function ImageImporter({ open, onClose, onInsert, mode }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [blur, setBlur] = useState(0);
  const [removing, setRemoving] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'الرجاء اختيار ملف صورة', variant: 'destructive' });
      return;
    }
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = e => setImageSrc(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleRemoveBg = async () => {
    if (!imageSrc) return;
    setRemoving(true);
    // Simulate background removal by converting to grayscale-ish + transparency
    // In a real app you'd use an API or canvas manipulation
    try {
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.src = imageSrc;
      await new Promise(r => { img.onload = r; });
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Simple white-background removal
      for (let i = 0; i < data.data.length; i += 4) {
        const r = data.data[i], g = data.data[i+1], b = data.data[i+2];
        if (r > 230 && g > 230 && b > 230) data.data[i+3] = 0;
      }
      ctx.putImageData(data, 0, 0);
      setImageSrc(canvas.toDataURL('image/png'));
      toast({ title: 'تم حذف الخلفية البيضاء' });
    } catch {
      toast({ title: 'فشل حذف الخلفية', variant: 'destructive' });
    } finally {
      setRemoving(false);
    }
  };

  const filterStr = [
    brightness !== 100 ? `brightness(${brightness}%)` : '',
    contrast !== 100 ? `contrast(${contrast}%)` : '',
    saturation !== 100 ? `saturate(${saturation}%)` : '',
    blur > 0 ? `blur(${blur}px)` : '',
  ].filter(Boolean).join(' ');

  const handleInsert = () => {
    if (!imageSrc) return;
    onInsert({ src: imageSrc, brightness, contrast, saturation, blur });
    onClose();
    setImageSrc(null); setBrightness(100); setContrast(100); setSaturation(100); setBlur(0);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{mode === 'background' ? 'استيراد صورة خلفية' : 'استيراد صورة'}</DialogTitle></DialogHeader>

        <div className="grid grid-cols-2 gap-5">
          {/* Upload area */}
          <div className="space-y-3">
            {!imageSrc ? (
              <div
                className="h-48 rounded-xl border-2 border-dashed border-muted-foreground/40 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-all"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => inputRef.current?.click()}>
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm font-medium">اسحب وأفلت الصورة هنا</p>
                <p className="text-xs text-muted-foreground">أو انقر للاختيار من جهازك</p>
                <p className="text-[10px] text-muted-foreground/60">PNG, JPG, SVG, WebP, GIF</p>
              </div>
            ) : (
              <div className="relative h-48 rounded-xl overflow-hidden bg-muted/20 border flex items-center justify-center">
                <img src={imageSrc} alt="preview"
                  className="max-w-full max-h-full object-contain"
                  style={{ filter: filterStr || undefined }} />
                <button onClick={() => setImageSrc(null)}
                  className="absolute top-2 left-2 w-7 h-7 rounded-full bg-destructive text-white flex items-center justify-center text-xs shadow">✕</button>
              </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

            {imageSrc && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => inputRef.current?.click()}>
                  <ImageIcon className="w-3.5 h-3.5 me-1" /> تغيير الصورة
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={handleRemoveBg} disabled={removing}>
                  <Wand2 className="w-3.5 h-3.5 me-1" /> {removing ? 'جاري...' : 'حذف الخلفية'}
                </Button>
              </div>
            )}
          </div>

          {/* Adjustments */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Sliders className="w-4 h-4" /> ضبط الصورة
            </Label>
            {[
              { label: 'السطوع', val: brightness, set: setBrightness, min: 0, max: 200 },
              { label: 'التباين', val: contrast, set: setContrast, min: 0, max: 200 },
              { label: 'التشبع', val: saturation, set: setSaturation, min: 0, max: 200 },
              { label: 'الضبابية', val: blur, set: setBlur, min: 0, max: 20 },
            ].map(adj => (
              <div key={adj.label} className="space-y-0.5">
                <div className="flex justify-between">
                  <Label className="text-xs">{adj.label}</Label>
                  <span className="text-xs text-muted-foreground">{adj.val}{adj.label === 'الضبابية' ? 'px' : '%'}</span>
                </div>
                <input type="range" min={adj.min} max={adj.max} value={adj.val}
                  onChange={e => adj.set(+e.target.value)} className="w-full" />
              </div>
            ))}
            <Button size="sm" variant="ghost" className="w-full text-xs"
              onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); setBlur(0); }}>
              إعادة تعيين الضبط
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleInsert} disabled={!imageSrc}>
            {mode === 'background' ? 'تعيين خلفية' : 'إدراج الصورة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
