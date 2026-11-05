import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Trash2, Palette } from 'lucide-react';
import { PREDEFINED_STICKERS, type StickerDef } from '@/lib/designer-types';
import type { DesignerElement } from '@/lib/designer-types';
import StickerDesigner from './StickerDesigner';

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (stickerId: string, color: string, isCustom?: boolean) => void;
}

const STICKER_CATS = [...new Set(PREDEFINED_STICKERS.map(s => s.category))];

export default function StickersLibrary({ open, onClose, onInsert }: Props) {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [showDesigner, setShowDesigner] = useState(false);
  const [stickerColors, setStickerColors] = useState<Record<string, string>>({});

  const customStickers = useLiveQuery(() => db.designerStickers.orderBy('createdAt').reverse().toArray(), []) ?? [];

  const getColor = (id: string, def: string) => stickerColors[id] ?? def;

  const filterStickers = (stickers: StickerDef[]) => stickers.filter(s => {
    const matchSearch = s.label.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || s.category === filterCat;
    return matchSearch && matchCat;
  });

  const allCats = [...new Set([...STICKER_CATS, ...customStickers.map(s => s.category)])];

  return (
    <>
      <Dialog open={open && !showDesigner} onOpenChange={o => !o && onClose()}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>مكتبة الملصقات</DialogTitle>
              <Button size="sm" variant="outline" onClick={() => setShowDesigner(true)} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> إنشاء ملصق
              </Button>
            </div>
          </DialogHeader>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث..." className="pr-9 h-8 text-sm"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Category pills */}
          <div className="flex gap-1.5 flex-wrap">
            {['all', ...allCats].map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${filterCat === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                {cat === 'all' ? 'الكل' : cat}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Predefined stickers */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">ملصقات جاهزة</h3>
              <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                {filterStickers(PREDEFINED_STICKERS).map(sticker => {
                  const color = getColor(sticker.id, sticker.defaultColor);
                  return (
                    <div key={sticker.id} className="flex flex-col items-center gap-1 group">
                      <button
                        onClick={() => { onInsert(sticker.id, color); onClose(); }}
                        className="w-12 h-12 rounded-lg border-2 border-transparent hover:border-primary/50 hover:shadow-md transition-all p-1.5 bg-muted/30 hover:bg-muted/60 flex items-center justify-center"
                        title={sticker.label}>
                        <span style={{ color }}
                          className="w-full h-full"
                          dangerouslySetInnerHTML={{ __html: sticker.svg.replace('currentColor', color) }} />
                      </button>
                      <span className="text-[9px] text-muted-foreground text-center leading-tight">{sticker.label}</span>
                      {/* Color picker */}
                      <input type="color" value={color}
                        onChange={e => setStickerColors(p => ({ ...p, [sticker.id]: e.target.value }))}
                        className="w-5 h-3 cursor-pointer border-none rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="تغيير اللون" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom stickers */}
            {customStickers.length > 0 && (filterCat === 'all' || customStickers.some(s => s.category === filterCat)) && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">ملصقاتي المخصصة</h3>
                <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                  {customStickers.filter(s => filterCat === 'all' || s.category === filterCat)
                    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
                    .map(sticker => (
                      <div key={sticker.id} className="flex flex-col items-center gap-1 group relative">
                        <button
                          onClick={() => { onInsert(`custom:${sticker.id}`, sticker.defaultColor, true); onClose(); }}
                          className="w-12 h-12 rounded-lg border-2 border-transparent hover:border-primary/50 hover:shadow-md transition-all p-1.5 bg-muted/30 hover:bg-muted/60 flex items-center justify-center"
                          dangerouslySetInnerHTML={{ __html: sticker.svgData }} />
                        <span className="text-[9px] text-muted-foreground text-center leading-tight">{sticker.name}</span>
                        <button
                          onClick={async () => { await db.designerStickers.delete(sticker.id!); }}
                          className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <StickerDesigner
        open={showDesigner}
        onClose={() => setShowDesigner(false)}
        onSaved={() => setShowDesigner(false)}
      />
    </>
  );
}
