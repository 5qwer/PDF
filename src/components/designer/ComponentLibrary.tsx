import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Trash2, Tag, Star, Clock } from 'lucide-react';
import type { DesignerElement } from '@/lib/designer-types';
import { COMPONENT_TYPES } from '@/lib/designer-types';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (element: DesignerElement) => void;
}

export default function ComponentLibrary({ open, onClose, onInsert }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const components = useLiveQuery(async () => {
    const all = await db.designerComponents.orderBy('createdAt').reverse().toArray();
    return all.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
  }, []) ?? [];

  const categories = [...new Set(components.map(c => c.category).filter(Boolean))] as string[];
  const types = [...new Set(components.map(c => c.componentType).filter(Boolean))] as string[];

  const filtered = components.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchCat = filterCat === 'all' || c.category === filterCat;
    const matchType = filterType === 'all' || c.componentType === filterType;
    return matchSearch && matchCat && matchType;
  });

  const handleInsert = async (comp: typeof components[0]) => {
    // Update usage count
    await db.designerComponents.update(comp.id!, { usageCount: (comp.usageCount ?? 0) + 1 });
    onInsert({ ...comp.element, id: crypto.randomUUID() });
    onClose();
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('حذف هذا المكون من المكتبة؟')) return;
    await db.designerComponents.delete(id);
    toast({ title: 'تم حذف المكون' });
  };

  const getTypeDef = (typeId: string) => COMPONENT_TYPES.find(t => t.id === typeId);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>مكتبة المكونات ({components.length})</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث في المكونات..." className="pr-9 h-9 text-sm"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {categories.length > 0 && (
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="border rounded-md px-2 py-1.5 text-sm bg-background">
              <option value="all">كل الفئات</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {types.length > 0 && (
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="border rounded-md px-2 py-1.5 text-sm bg-background">
              <option value="all">كل الأنواع</option>
              {types.map(t => <option key={t} value={t}>{getTypeDef(t)?.label ?? t}</option>)}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
                <Star className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <p className="font-medium">لا توجد مكونات محفوظة بعد</p>
              <p className="text-sm mt-1">حدد عنصراً في المحرر واحفظه كمكون قابل لإعادة الاستخدام</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map(comp => (
                <div key={comp.id}
                  className="group border rounded-xl p-3 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer text-right"
                  onClick={() => handleInsert(comp)}>
                  {/* Preview placeholder */}
                  <div className="h-16 bg-gradient-to-br from-muted/40 to-muted rounded-lg mb-2 flex items-center justify-center">
                    {comp.thumbnail
                      ? <img src={comp.thumbnail} alt={comp.name} className="w-full h-full object-cover rounded-lg" />
                      : <span className="text-2xl">{getTypeDef(comp.componentType)?.label ? '📦' : '📦'}</span>}
                  </div>
                  <p className="font-semibold text-sm truncate">{comp.name}</p>
                  {comp.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{comp.description}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-1 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                        {getTypeDef(comp.componentType)?.label ?? comp.componentType}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />{comp.usageCount}
                      </span>
                      <button onClick={e => handleDelete(comp.id!, e)}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {comp.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {comp.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
