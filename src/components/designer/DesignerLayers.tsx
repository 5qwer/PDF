import React, { useState } from 'react';
import {
  Eye, EyeOff, Lock, Unlock, Trash2, Copy, ArrowUp, ArrowDown,
  ChevronUp, ChevronDown, Type, Square, Circle, Image, Table2,
  Tag, Variable, LayoutGrid, Minus, PenTool, Users, AlignCenter,
} from 'lucide-react';
import type { DesignerState, DesignerAction, DesignerElement, ElementType } from '@/lib/designer-types';

const TYPE_ICONS: Record<ElementType, React.ReactNode> = {
  text:          <Type className="w-3 h-3" />,
  heading:       <Type className="w-3 h-3 text-blue-400" />,
  subheading:    <Type className="w-3 h-3 text-indigo-400" />,
  rect:          <Square className="w-3 h-3" />,
  circle:        <Circle className="w-3 h-3" />,
  triangle:      <AlignCenter className="w-3 h-3 rotate-180" />,
  star:          <span className="text-[10px]">★</span>,
  line:          <Minus className="w-3 h-3" />,
  arrow:         <ChevronDown className="w-3 h-3 rotate-[-90deg]" />,
  pen:           <PenTool className="w-3 h-3" />,
  image:         <Image className="w-3 h-3" />,
  table:         <Table2 className="w-3 h-3" />,
  sticker:       <Tag className="w-3 h-3" />,
  frame:         <Square className="w-3 h-3 text-purple-400" />,
  stamp:         <Tag className="w-3 h-3 text-red-400" />,
  'dynamic-field': <Variable className="w-3 h-3 text-green-400" />,
  'smart-zone':  <LayoutGrid className="w-3 h-3 text-amber-400" />,
  'deco-frame':  <Square className="w-3 h-3 text-pink-400" />,
};

const TYPE_LABELS: Record<ElementType, string> = {
  text: 'نص', heading: 'عنوان', subheading: 'عنوان فرعي', rect: 'مستطيل',
  circle: 'دائرة', triangle: 'مثلث', star: 'نجمة', line: 'خط', arrow: 'سهم',
  pen: 'قلم', image: 'صورة', table: 'جدول', sticker: 'ملصق', frame: 'إطار',
  stamp: 'ختم', 'dynamic-field': 'حقل', 'smart-zone': 'منطقة',
  'deco-frame': 'إطار زخرفي',
};

interface Props {
  state: DesignerState;
  dispatch: React.Dispatch<DesignerAction>;
}

export default function DesignerLayers({ state, dispatch }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const page = state.pages[state.currentPageIndex];
  const elements = [...(page?.elements ?? [])].reverse(); // Top of stack first

  const select = (id: string, shift: boolean) => {
    if (shift) {
      const ids = state.selectedIds.includes(id)
        ? state.selectedIds.filter(x => x !== id)
        : [...state.selectedIds, id];
      dispatch({ type: 'SELECT', ids });
    } else {
      dispatch({ type: 'SELECT', ids: [id] });
    }
  };

  const rename = (el: DesignerElement) => {
    dispatch({ type: 'UPDATE_ELEMENT', id: el.id, changes: { name: editName.trim() || el.name } });
    setEditingId(null);
  };

  const isSelected = (id: string) => state.selectedIds.includes(id);

  return (
    <div className="flex flex-col h-full min-h-0 border-b border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          الطبقات ({page?.elements.length ?? 0})
        </span>
        {state.selectedIds.length > 0 && (
          <div className="flex gap-0.5">
            <button onClick={() => dispatch({ type: 'GROUP_ELEMENTS', ids: state.selectedIds, groupId: crypto.randomUUID() })}
              title="تجميع" className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground">
              <Users className="w-3 h-3" />
            </button>
            <button onClick={() => dispatch({ type: 'DELETE_ELEMENTS', ids: state.selectedIds })}
              title="حذف المحدد" className="w-6 h-6 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Element list */}
      <div className="flex-1 overflow-y-auto">
        {elements.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">لا توجد عناصر بعد.</div>
        ) : elements.map(el => {
          const selected = isSelected(el.id);
          return (
            <div key={el.id}
              onClick={e => select(el.id, e.shiftKey)}
              className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors border-b border-border/30 ${selected ? 'bg-primary/10 border-primary/20' : 'hover:bg-muted/30'}`}>

              {/* Type icon */}
              <span className={`shrink-0 w-4 text-center ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                {TYPE_ICONS[el.type]}
              </span>

              {/* Name (double-click to edit) */}
              {editingId === el.id ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="flex-1 text-xs bg-background border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  onBlur={() => rename(el)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') rename(el);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <span
                  className={`flex-1 text-xs truncate ${el.visible ? '' : 'opacity-40 line-through'}`}
                  onDoubleClick={ev => { ev.stopPropagation(); setEditingId(el.id); setEditName(el.name); }}
                  title={el.name}>
                  {el.name || TYPE_LABELS[el.type]}
                </span>
              )}

              {/* Controls */}
              <div className="flex gap-0.5 shrink-0">
                {/* Reorder */}
                <button
                  onClick={e => { e.stopPropagation(); dispatch({ type: 'REORDER_ELEMENT', id: el.id, direction: 'up' }); }}
                  title="إلى الأمام"
                  className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground hover:text-foreground">
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); dispatch({ type: 'REORDER_ELEMENT', id: el.id, direction: 'down' }); }}
                  title="إلى الخلف"
                  className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground hover:text-foreground">
                  <ChevronDown className="w-3 h-3" />
                </button>

                {/* Visibility */}
                <button
                  onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_VISIBLE', ids: [el.id] }); }}
                  title={el.visible ? 'إخفاء' : 'إظهار'}
                  className={`w-5 h-5 rounded flex items-center justify-center transition-all ${el.visible ? 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground' : 'opacity-100 text-muted-foreground/40'} hover:bg-muted`}>
                  {el.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>

                {/* Lock */}
                <button
                  onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LOCK', ids: [el.id] }); }}
                  title={el.locked ? 'إلغاء القفل' : 'قفل'}
                  className={`w-5 h-5 rounded flex items-center justify-center transition-all ${el.locked ? 'opacity-100 text-amber-500' : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground'} hover:bg-muted`}>
                  {el.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>

                {/* Duplicate */}
                <button
                  onClick={e => { e.stopPropagation(); dispatch({ type: 'DUPLICATE_ELEMENTS', ids: [el.id] }); }}
                  title="تكرار"
                  className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground hover:text-foreground">
                  <Copy className="w-3 h-3" />
                </button>

                {/* Delete */}
                <button
                  onClick={e => { e.stopPropagation(); dispatch({ type: 'DELETE_ELEMENTS', ids: [el.id] }); }}
                  title="حذف"
                  className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: select all, deselect */}
      {page?.elements.length > 0 && (
        <div className="flex gap-2 px-3 py-2 border-t text-xs shrink-0">
          <button onClick={() => dispatch({ type: 'SELECT', ids: page.elements.map(e => e.id) })}
            className="text-muted-foreground hover:text-foreground transition-colors">
            تحديد الكل
          </button>
          <span className="text-muted-foreground/40">|</span>
          <button onClick={() => dispatch({ type: 'SELECT', ids: [] })}
            className="text-muted-foreground hover:text-foreground transition-colors">
            إلغاء التحديد
          </button>
        </div>
      )}
    </div>
  );
}
