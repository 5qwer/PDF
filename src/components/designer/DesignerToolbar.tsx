import React from 'react';
import {
  MousePointer2, Hand, ZoomIn, Crop,
  Type, Heading1, Heading2,
  Minus, MoveRight,
  Square, Circle, Triangle, Star,
  PenTool, Spline,
  Table2, Image, Smile, Tag, Frame, Stamp,
  Variable, LayoutGrid,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { ToolType, DesignerAction } from '@/lib/designer-types';

interface ToolDef {
  id: ToolType; label: string; icon: React.ReactNode; shortcut?: string;
}

interface ToolGroup { label: string; tools: ToolDef[] }

const TOOL_GROUPS: ToolGroup[] = [
  {
    label: 'تحديد',
    tools: [
      { id: 'select',   label: 'تحديد',    icon: <MousePointer2 className="w-4 h-4" />, shortcut: 'V' },
      { id: 'move',     label: 'تحريك',    icon: <Hand className="w-4 h-4" />,          shortcut: 'H' },
      { id: 'zoom',     label: 'تكبير',    icon: <ZoomIn className="w-4 h-4" />,        shortcut: 'Z' },
      { id: 'crop',     label: 'قص',       icon: <Crop className="w-4 h-4" />,          shortcut: 'C' },
    ],
  },
  {
    label: 'نصوص',
    tools: [
      { id: 'text',       label: 'نص عادي',   icon: <Type className="w-4 h-4" />,      shortcut: 'T' },
      { id: 'heading',    label: 'عنوان رئيسي', icon: <Heading1 className="w-4 h-4" />, shortcut: 'H' },
      { id: 'subheading', label: 'عنوان فرعي', icon: <Heading2 className="w-4 h-4" /> },
    ],
  },
  {
    label: 'خطوط',
    tools: [
      { id: 'line',  label: 'خط مستقيم', icon: <Minus className="w-4 h-4" />,    shortcut: 'L' },
      { id: 'arrow', label: 'سهم',       icon: <MoveRight className="w-4 h-4" /> },
    ],
  },
  {
    label: 'أشكال',
    tools: [
      { id: 'rect',     label: 'مستطيل', icon: <Square className="w-4 h-4" />,   shortcut: 'R' },
      { id: 'circle',   label: 'دائرة',  icon: <Circle className="w-4 h-4" />,   shortcut: 'O' },
      { id: 'triangle', label: 'مثلث',   icon: <Triangle className="w-4 h-4" /> },
      { id: 'star',     label: 'نجمة',   icon: <Star className="w-4 h-4" /> },
    ],
  },
  {
    label: 'رسم',
    tools: [
      { id: 'pen',   label: 'قلم',   icon: <PenTool className="w-4 h-4" />, shortcut: 'P' },
      { id: 'curve', label: 'منحنى', icon: <Spline className="w-4 h-4" /> },
    ],
  },
  {
    label: 'محتوى',
    tools: [
      { id: 'table',  label: 'جدول',     icon: <Table2 className="w-4 h-4" /> },
      { id: 'image',  label: 'صورة',     icon: <Image className="w-4 h-4" />, shortcut: 'I' },
      { id: 'icon',   label: 'أيقونة',   icon: <Smile className="w-4 h-4" /> },
      { id: 'sticker', label: 'ملصق',   icon: <Tag className="w-4 h-4" /> },
      { id: 'frame',  label: 'إطار',    icon: <Frame className="w-4 h-4" /> },
      { id: 'stamp',  label: 'ختم',     icon: <Stamp className="w-4 h-4" /> },
    ],
  },
  {
    label: 'تخطيط',
    tools: [
      { id: 'dynamic-field', label: 'حقل ديناميكي', icon: <Variable className="w-4 h-4" /> },
      { id: 'smart-zone',    label: 'منطقة ذكية',   icon: <LayoutGrid className="w-4 h-4" /> },
    ],
  },
];

interface Props {
  activeTool: ToolType;
  dispatch: React.Dispatch<DesignerAction>;
  collapsed: boolean;
  onToggle: () => void;
  onOpenStickers: () => void;
  onOpenImageImporter: () => void;
  onOpenDynamicField: () => void;
}

export default function DesignerToolbar({
  activeTool, dispatch, collapsed, onToggle, onOpenStickers, onOpenImageImporter, onOpenDynamicField
}: Props) {
  const selectTool = (id: ToolType) => {
    if (id === 'sticker') { onOpenStickers(); return; }
    if (id === 'image') { onOpenImageImporter(); return; }
    if (id === 'dynamic-field') { onOpenDynamicField(); return; }
    dispatch({ type: 'SET_TOOL', tool: id });
  };

  if (collapsed) {
    return (
      <div className="w-8 bg-[#1e1e2e] border-l border-white/10 flex flex-col items-center py-2 shrink-0">
        <button onClick={onToggle} className="w-7 h-7 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-14 bg-[#1e1e2e] border-l border-white/10 flex flex-col py-2 shrink-0 overflow-y-auto" dir="ltr">
      {/* Toggle button */}
      <div className="flex justify-end px-1 mb-1">
        <button onClick={onToggle} className="w-6 h-6 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-3 h-3" />
        </button>
      </div>

      {TOOL_GROUPS.map((group, gi) => (
        <div key={group.label} className={gi > 0 ? 'mt-0.5 border-t border-white/5 pt-0.5' : ''}>
          <p className="text-[8px] text-white/20 text-center uppercase tracking-wide mb-0.5 px-1">{group.label}</p>
          <div className="flex flex-col items-center gap-0.5 px-1">
            {group.tools.map(tool => (
              <button
                key={tool.id}
                onClick={() => selectTool(tool.id)}
                title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
                className={`w-10 h-9 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all ${
                  activeTool === tool.id
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                    : 'text-white/50 hover:text-white hover:bg-white/10'
                }`}
              >
                {tool.icon}
                {tool.shortcut && (
                  <span className="text-[8px] leading-none opacity-50">{tool.shortcut}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-auto pt-2 border-t border-white/5">
        <div className="flex flex-col items-center gap-0.5 px-1">
          <span className="text-[8px] text-white/20">Alt+1→7</span>
        </div>
      </div>
    </div>
  );
}
