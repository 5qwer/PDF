import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit3, RefreshCw } from 'lucide-react';
import type { DesignerStyle, StyleType, DesignerElement } from '@/lib/designer-types';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedElement?: DesignerElement;
  onApplyStyle: (style: DesignerStyle) => void;
}

const TYPE_LABELS: Record<StyleType, string> = {
  heading: 'عنوان', question: 'سؤال', notes: 'ملاحظات', table: 'جدول', image: 'صورة', custom: 'مخصص',
};

export default function StylesManager({ open, onClose, selectedElement, onApplyStyle }: Props) {
  const { toast } = useToast();
  const [filterType, setFilterType] = useState<StyleType | 'all'>('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<StyleType>('custom');

  const styles = useLiveQuery(() =>
    db.designerStyles.orderBy('createdAt').toArray(), []
  ) ?? [];

  const filtered = filterType === 'all' ? styles : styles.filter(s => s.type === filterType);

  const handleSaveFromElement = async () => {
    if (!selectedElement || !newName.trim()) return;
    const props: Partial<DesignerElement> = {};
    if ('fontSize' in selectedElement) (props as any).fontSize = (selectedElement as any).fontSize;
    if ('fontFamily' in selectedElement) (props as any).fontFamily = (selectedElement as any).fontFamily;
    if ('color' in selectedElement) (props as any).color = (selectedElement as any).color;
    if ('fontWeight' in selectedElement) (props as any).fontWeight = (selectedElement as any).fontWeight;
    if ('textAlign' in selectedElement) (props as any).textAlign = (selectedElement as any).textAlign;
    if ('fill' in selectedElement) (props as any).fill = (selectedElement as any).fill;
    if ('stroke' in selectedElement) (props as any).stroke = (selectedElement as any).stroke;
    if ('backgroundColor' in selectedElement) (props as any).backgroundColor = (selectedElement as any).backgroundColor;
    await db.designerStyles.add({
      name: newName.trim(), type: newType, properties: props,
      linkedElements: [], createdAt: Date.now(), updatedAt: Date.now(),
    });
    toast({ title: 'تم حفظ النمط' });
    setNewName(''); setShowCreate(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('حذف هذا النمط؟')) return;
    await db.designerStyles.delete(id);
    toast({ title: 'تم حذف النمط' });
  };

  const handleRename = async (id: number, name: string) => {
    await db.designerStyles.update(id, { name, updatedAt: Date.now() });
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>مدير الأنماط ({styles.length})</DialogTitle>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
              <Plus className="w-3.5 h-3.5 me-1" /> نمط جديد
            </Button>
          </div>
        </DialogHeader>

        {showCreate && (
          <div className="p-3 rounded-lg bg-muted/30 border space-y-3">
            <p className="text-sm font-medium">إنشاء نمط {selectedElement ? 'من العنصر المحدد' : 'جديد'}</p>
            <div className="flex gap-2">
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="اسم النمط" className="flex-1" />
              <select value={newType} onChange={e => setNewType(e.target.value as StyleType)}
                className="border rounded-md px-2 py-1.5 text-sm bg-background">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveFromElement} disabled={!newName.trim()}>حفظ النمط</Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-1.5 flex-wrap">
          {(['all', ...Object.keys(TYPE_LABELS)] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t as any)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${filterType === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {t === 'all' ? 'الكل' : TYPE_LABELS[t as StyleType]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">لا توجد أنماط محفوظة.</p>
          ) : filtered.map(style => (
            <div key={style.id} className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
              {/* Type badge */}
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                {TYPE_LABELS[style.type]}
              </span>

              {/* Name (editable) */}
              {editingId === style.id ? (
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-sm flex-1"
                  autoFocus onBlur={() => handleRename(style.id!, editName)} onKeyDown={e => { if (e.key === 'Enter') handleRename(style.id!, editName); if (e.key === 'Escape') setEditingId(null); }} />
              ) : (
                <span className="flex-1 text-sm font-medium truncate">{style.name}</span>
              )}

              {/* Preview */}
              <div className="w-12 h-5 rounded text-[8px] flex items-center justify-center overflow-hidden border shrink-0"
                style={(style.properties as any).color ? { color: (style.properties as any).color, fontWeight: (style.properties as any).fontWeight } : {}}>
                نمط
              </div>

              {/* Actions */}
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {selectedElement && (
                  <button onClick={() => { onApplyStyle(style); onClose(); }}
                    className="w-7 h-7 rounded flex items-center justify-center hover:bg-primary/10 text-primary" title="تطبيق على العنصر">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => { setEditingId(style.id!); setEditName(style.name); }}
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-muted">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(style.id!)}
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
