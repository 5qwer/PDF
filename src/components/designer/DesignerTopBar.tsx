import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, ZoomIn, ZoomOut, Undo2, Redo2, Save, Download,
  Layers, Settings2, Ruler, PanelRight, MoreHorizontal, FilePlus,
  Copy, ClipboardPaste, Trash2, FileJson, Printer, BookOpen,
} from 'lucide-react';
import type { DesignerState, DesignerAction } from '@/lib/designer-types';

interface Props {
  state: DesignerState;
  dispatch: React.Dispatch<DesignerAction>;
  onExit: () => void;
  onSave: () => void;
  onExport: (format: 'json' | 'print') => void;
  onAddPage: () => void;
  onApplyToProject?: () => void;
  projectTitle?: string;
}

export default function DesignerTopBar({ state, dispatch, onExit, onSave, onExport, onAddPage, onApplyToProject, projectTitle }: Props) {
  const [showMore, setShowMore] = useState(false);
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;
  const hasSelected = state.selectedIds.length > 0;

  const zoomIn = () => dispatch({ type: 'SET_ZOOM', zoom: Math.min(400, state.zoom + 25) });
  const zoomOut = () => dispatch({ type: 'SET_ZOOM', zoom: Math.max(25, state.zoom - 25) });
  const zoomFit = () => dispatch({ type: 'SET_ZOOM', zoom: 100 });

  return (
    <div className="h-12 bg-[#1e1e2e] border-b border-white/10 flex items-center gap-1 px-2 shrink-0 z-40" dir="rtl">
      {/* Exit */}
      <Button size="sm" variant="ghost" onClick={onExit}
        className="text-white/70 hover:text-white hover:bg-white/10 gap-1.5 h-8 px-2.5 text-xs">
        <ArrowRight className="w-3.5 h-3.5" />
        {state.isDirty ? '⬤ ' : ''}{state.templateMeta.name || 'بدون عنوان'}
      </Button>

      {/* Project context badge */}
      {projectTitle && (
        <div className="flex items-center gap-1.5 px-2 h-6 rounded bg-violet-500/20 border border-violet-400/30">
          <BookOpen className="w-3 h-3 text-violet-300" />
          <span className="text-[10px] text-violet-200 truncate max-w-[120px]">{projectTitle}</span>
        </div>
      )}

      <div className="w-px h-6 bg-white/10 mx-1" />

      {/* Undo / Redo */}
      <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo}
        title="تراجع (Ctrl+Z)"
        className="w-8 h-8 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <Undo2 className="w-4 h-4" />
      </button>
      <button onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo}
        title="إعادة (Ctrl+Y)"
        className="w-8 h-8 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <Redo2 className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-white/10 mx-1" />

      {/* Zoom */}
      <button onClick={zoomOut} title="تصغير" className="w-8 h-8 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
        <ZoomOut className="w-4 h-4" />
      </button>
      <button onClick={zoomFit} title="المقاس الطبيعي"
        className="px-2 h-8 rounded text-xs font-mono text-white/80 hover:text-white hover:bg-white/10 min-w-[52px] text-center transition-colors">
        {state.zoom}%
      </button>
      <button onClick={zoomIn} title="تكبير" className="w-8 h-8 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
        <ZoomIn className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-white/10 mx-1" />

      {/* Pages indicator */}
      <div className="flex items-center gap-1.5 text-xs text-white/50">
        <span>{state.currentPageIndex + 1}</span>
        <span>/</span>
        <span>{state.pages.length}</span>
        <span className="text-white/30">صفحة</span>
      </div>

      <button onClick={onAddPage} title="صفحة جديدة"
        className="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors ms-1">
        <FilePlus className="w-3.5 h-3.5" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Copy / Paste / Delete (when selected) */}
      {hasSelected && (
        <>
          <button onClick={() => dispatch({ type: 'COPY' })} title="نسخ (Ctrl+C)"
            className="w-8 h-8 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => dispatch({ type: 'PASTE' })} title="لصق (Ctrl+V)"
            className="w-8 h-8 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <ClipboardPaste className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => dispatch({ type: 'DELETE_ELEMENTS', ids: state.selectedIds })} title="حذف"
            className="w-8 h-8 rounded flex items-center justify-center text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
        </>
      )}

      {/* Panel toggles */}
      <button onClick={() => dispatch({ type: 'TOGGLE_PANEL', panel: 'toolbar' })} title="شريط الأدوات"
        className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${state.showToolbar ? 'text-primary bg-primary/20' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
        <PanelRight className="w-3.5 h-3.5 scale-x-[-1]" />
      </button>
      <button onClick={() => dispatch({ type: 'TOGGLE_PANEL', panel: 'layers' })} title="الطبقات"
        className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${state.showLayers ? 'text-primary bg-primary/20' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
        <Layers className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => dispatch({ type: 'TOGGLE_PANEL', panel: 'properties' })} title="الخصائص"
        className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${state.showProperties ? 'text-primary bg-primary/20' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
        <Settings2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => dispatch({ type: 'TOGGLE_PANEL', panel: 'rulers' })} title="المساطر"
        className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${state.showRulers ? 'text-primary bg-primary/20' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
        <Ruler className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-6 bg-white/10 mx-1" />

      {/* Apply to Project */}
      {onApplyToProject && (
        <Button size="sm" onClick={onApplyToProject}
          className="h-8 px-3 text-xs gap-1.5 bg-violet-600 hover:bg-violet-500 text-white border-0">
          <BookOpen className="w-3.5 h-3.5" />
          تطبيق على المشروع
        </Button>
      )}

      {/* Save */}
      <Button size="sm" onClick={onSave}
        className={`h-8 px-3 text-xs gap-1.5 ${state.isDirty ? 'bg-primary hover:bg-primary/90' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
        <Save className="w-3.5 h-3.5" />
        {state.isDirty ? 'حفظ *' : 'محفوظ'}
      </Button>

      {/* Export */}
      <div className="relative">
        <Button size="sm" variant="ghost" onClick={() => setShowMore(!showMore)}
          className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
        {showMore && (
          <div className="absolute left-0 top-full mt-1 w-44 bg-popover border rounded-lg shadow-lg py-1 z-50">
            <button onClick={() => { onExport('json'); setShowMore(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted text-right">
              <FileJson className="w-3.5 h-3.5" /> تصدير JSON
            </button>
            <button onClick={() => { onExport('print'); setShowMore(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted text-right">
              <Printer className="w-3.5 h-3.5" /> طباعة / PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
