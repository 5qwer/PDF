import React, { useReducer, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type {
  DesignerState, DesignerAction, DesignerPage, DesignerElement,
  PageBackground, PageSettings, DesignerTemplate,
} from '@/lib/designer-types';
import { DEFAULT_BACKGROUND } from '@/lib/designer-types';
import { useToast } from '@/hooks/use-toast';

// Sub-components
import DesignerTopBar from './DesignerTopBar';
import DesignerToolbar from './DesignerToolbar';
import DesignerCanvas from './DesignerCanvas';
import DesignerLayers from './DesignerLayers';
import DesignerProperties from './DesignerProperties';
import NewPageDialog from './NewPageDialog';
import TemplateLibrary from './TemplateLibrary';
import StickersLibrary from './StickersLibrary';
import ComponentLibrary from './ComponentLibrary';
import StylesManager from './StylesManager';
import ImageImporter from './ImageImporter';
import SaveTemplateDialog from './SaveTemplateDialog';

// ─── Reducer ──────────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

function clonePage(page: DesignerPage): DesignerPage {
  return { ...page, elements: page.elements.map(e => ({ ...e })), background: { ...page.background } };
}

function clonePages(pages: DesignerPage[]): DesignerPage[] {
  return pages.map(clonePage);
}

function withHistory(state: DesignerState): DesignerState {
  const hist = state.history.slice(0, state.historyIndex + 1);
  hist.push(state.pages.map(clonePage));
  if (hist.length > MAX_HISTORY) hist.shift();
  return { ...state, history: hist, historyIndex: hist.length - 1 };
}

function designerReducer(state: DesignerState, action: DesignerAction): DesignerState {
  switch (action.type) {

    case 'SET_TOOL':
      return { ...state, activeTool: action.tool };

    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(25, Math.min(400, action.zoom)) };

    case 'SET_PAN':
      return { ...state, panX: action.x, panY: action.y };

    case 'SELECT':
      return { ...state, selectedIds: action.ids };

    case 'ADD_ELEMENT': {
      const pages = clonePages(state.pages);
      const el = { ...action.element, zIndex: pages[state.currentPageIndex].elements.length };
      pages[state.currentPageIndex].elements.push(el);
      const next = withHistory({ ...state, pages, selectedIds: [el.id], isDirty: true });
      return next;
    }

    case 'UPDATE_ELEMENT': {
      const pages = clonePages(state.pages);
      const idx = pages[state.currentPageIndex].elements.findIndex(e => e.id === action.id);
      if (idx >= 0) pages[state.currentPageIndex].elements[idx] = { ...pages[state.currentPageIndex].elements[idx], ...action.changes } as DesignerElement;
      return { ...state, pages, isDirty: true };
    }

    case 'DELETE_ELEMENTS': {
      const pages = clonePages(state.pages);
      pages[state.currentPageIndex].elements = pages[state.currentPageIndex].elements.filter(e => !action.ids.includes(e.id));
      return withHistory({ ...state, pages, selectedIds: [], isDirty: true });
    }

    case 'REORDER_ELEMENT': {
      const pages = clonePages(state.pages);
      const els = pages[state.currentPageIndex].elements;
      const i = els.findIndex(e => e.id === action.id);
      if (i < 0) return state;
      const [el] = els.splice(i, 1);
      switch (action.direction) {
        case 'up':     els.splice(Math.min(els.length, i + 1), 0, el); break;
        case 'down':   els.splice(Math.max(0, i - 1), 0, el); break;
        case 'top':    els.push(el); break;
        case 'bottom': els.unshift(el); break;
      }
      pages[state.currentPageIndex].elements = els.map((e, idx) => ({ ...e, zIndex: idx }));
      return withHistory({ ...state, pages, isDirty: true });
    }

    case 'GROUP_ELEMENTS': {
      const pages = clonePages(state.pages);
      pages[state.currentPageIndex].elements = pages[state.currentPageIndex].elements.map(e =>
        action.ids.includes(e.id) ? { ...e, groupId: action.groupId } : e
      );
      return withHistory({ ...state, pages, isDirty: true });
    }

    case 'UNGROUP': {
      const pages = clonePages(state.pages);
      pages[state.currentPageIndex].elements = pages[state.currentPageIndex].elements.map(e =>
        e.groupId === action.groupId ? { ...e, groupId: undefined } : e
      );
      return withHistory({ ...state, pages, isDirty: true });
    }

    case 'SET_BACKGROUND': {
      const pages = clonePages(state.pages);
      const newBg = { ...pages[state.currentPageIndex].background, ...action.bg };
      if (newBg.applyToAll) {
        pages.forEach((p, i) => { pages[i].background = { ...newBg }; });
      } else {
        pages[state.currentPageIndex].background = newBg;
      }
      return { ...state, pages, isDirty: true };
    }

    case 'SET_PAGE_SETTINGS': {
      const pages = clonePages(state.pages);
      pages[state.currentPageIndex].settings = { ...pages[state.currentPageIndex].settings, ...action.settings };
      return { ...state, pages, isDirty: true };
    }

    case 'ADD_PAGE': {
      const pages = clonePages(state.pages);
      pages.push({ ...action.page });
      return withHistory({ ...state, pages, currentPageIndex: pages.length - 1, selectedIds: [], isDirty: true });
    }

    case 'DELETE_PAGE': {
      if (state.pages.length <= 1) return state;
      const pages = clonePages(state.pages);
      pages.splice(action.index, 1);
      const idx = Math.min(state.currentPageIndex, pages.length - 1);
      return withHistory({ ...state, pages, currentPageIndex: idx, selectedIds: [], isDirty: true });
    }

    case 'GO_TO_PAGE':
      return { ...state, currentPageIndex: Math.max(0, Math.min(state.pages.length - 1, action.index)), selectedIds: [] };

    case 'DUPLICATE_PAGE': {
      const pages = clonePages(state.pages);
      const dup = clonePage(pages[action.index]);
      dup.id = crypto.randomUUID();
      dup.elements = dup.elements.map(e => ({ ...e, id: crypto.randomUUID() }));
      pages.splice(action.index + 1, 0, dup);
      return withHistory({ ...state, pages, currentPageIndex: action.index + 1, isDirty: true });
    }

    case 'REORDER_PAGES': {
      const pages = clonePages(state.pages);
      const [p] = pages.splice(action.from, 1);
      pages.splice(action.to, 0, p);
      return withHistory({ ...state, pages, currentPageIndex: action.to, isDirty: true });
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      const prevIdx = state.historyIndex - 1;
      const prevPages = state.history[prevIdx].map(clonePage);
      return { ...state, pages: prevPages, historyIndex: prevIdx, selectedIds: [], isDirty: true };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const nextIdx = state.historyIndex + 1;
      const nextPages = state.history[nextIdx].map(clonePage);
      return { ...state, pages: nextPages, historyIndex: nextIdx, selectedIds: [], isDirty: true };
    }

    case 'PUSH_HISTORY': {
      return withHistory(state);
    }

    case 'COPY':
      return {
        ...state,
        clipboard: state.selectedIds
          .map(id => state.pages[state.currentPageIndex].elements.find(e => e.id === id))
          .filter(Boolean) as DesignerElement[],
      };

    case 'PASTE': {
      if (!state.clipboard.length) return state;
      const pages = clonePages(state.pages);
      const pasted: DesignerElement[] = state.clipboard.map(e => ({
        ...e, id: crypto.randomUUID(), x: e.x + 2, y: e.y + 2,
        zIndex: pages[state.currentPageIndex].elements.length,
      }));
      pages[state.currentPageIndex].elements.push(...pasted);
      return withHistory({ ...state, pages, selectedIds: pasted.map(e => e.id), isDirty: true });
    }

    case 'DUPLICATE_ELEMENTS': {
      const pages = clonePages(state.pages);
      const duped: DesignerElement[] = action.ids.map(id => {
        const el = pages[state.currentPageIndex].elements.find(e => e.id === id);
        if (!el) return null as any;
        return { ...el, id: crypto.randomUUID(), x: el.x + 2, y: el.y + 2, zIndex: pages[state.currentPageIndex].elements.length };
      }).filter(Boolean);
      pages[state.currentPageIndex].elements.push(...duped);
      return withHistory({ ...state, pages, selectedIds: duped.map(e => e.id), isDirty: true });
    }

    case 'TOGGLE_LOCK': {
      const pages = clonePages(state.pages);
      pages[state.currentPageIndex].elements = pages[state.currentPageIndex].elements.map(e =>
        action.ids.includes(e.id) ? { ...e, locked: !e.locked } : e
      );
      return { ...state, pages, isDirty: true };
    }

    case 'TOGGLE_VISIBLE': {
      const pages = clonePages(state.pages);
      pages[state.currentPageIndex].elements = pages[state.currentPageIndex].elements.map(e =>
        action.ids.includes(e.id) ? { ...e, visible: !e.visible } : e
      );
      return { ...state, pages, isDirty: true };
    }

    case 'SET_META':
      return { ...state, templateMeta: { ...state.templateMeta, ...action.meta } };

    case 'TOGGLE_PANEL':
      switch (action.panel) {
        case 'layers':     return { ...state, showLayers: !state.showLayers };
        case 'properties': return { ...state, showProperties: !state.showProperties };
        case 'toolbar':    return { ...state, showToolbar: !state.showToolbar };
        case 'rulers':     return { ...state, showRulers: !state.showRulers };
        default: return state;
      }

    case 'MARK_SAVED':
      return { ...state, isDirty: false, savedTemplateId: action.id };

    case 'LOAD_TEMPLATE':
      return {
        ...state,
        pages: action.pages.map(clonePage),
        templateMeta: { ...state.templateMeta, ...(action.meta ?? {}) },
        savedTemplateId: action.id,
        selectedIds: [],
        isDirty: false,
        history: [action.pages.map(clonePage)],
        historyIndex: 0,
      };

    case 'CLEAR': {
      const newPage: DesignerPage = { id: crypto.randomUUID(), settings: action.settings, elements: [], background: { ...DEFAULT_BACKGROUND } };
      return {
        ...state,
        pages: [newPage],
        currentPageIndex: 0,
        selectedIds: [],
        isDirty: false,
        history: [[newPage]],
        historyIndex: 0,
      };
    }

    default:
      return state;
  }
}

// ─── Initial State ────────────────────────────────────────────────────────────

function makeInitialState(
  pages: DesignerPage[],
  meta: Partial<DesignerState['templateMeta']> | null,
  savedId?: number,
): DesignerState {
  const safeMeta: DesignerState['templateMeta'] = {
    name: meta?.name ?? '', description: meta?.description ?? '',
    category: meta?.category ?? '', subject: meta?.subject ?? '',
    keywords: meta?.keywords ?? [], applyTo: meta?.applyTo ?? 'all',
    linkedGrades: meta?.linkedGrades ?? [],
  };
  return {
    pages: pages.map(p => ({ ...p, elements: p.elements ?? [], background: p.background ?? { ...DEFAULT_BACKGROUND } })),
    currentPageIndex: 0,
    selectedIds: [],
    activeTool: 'select',
    zoom: 100,
    panX: 0, panY: 0,
    showLayers: true,
    showProperties: true,
    showToolbar: true,
    showRulers: true,
    clipboard: [],
    history: [pages.map(p => ({ ...p, elements: [...(p.elements ?? [])], background: { ...(p.background ?? DEFAULT_BACKGROUND) } }))],
    historyIndex: 0,
    isDirty: false,
    savedTemplateId: savedId,
    templateMeta: safeMeta,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialPages: DesignerPage[];
  initialMeta: any;
  savedTemplateId?: number;
  onExit: () => void;
  /** إذا فُتح من داخل مشروع، يُمرَّر معرّفه هنا */
  projectId?: number;
}

// ─── Apply to Project Dialog ──────────────────────────────────────────────────

function ApplyToProjectDialog({
  open, onClose, templateId, templateName, projectId,
}: {
  open: boolean; onClose: () => void;
  templateId?: number; templateName: string; projectId?: number;
}) {
  const { toast } = useToast();
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), []);
  const [selectedProjectId, setSelectedProjectId] = React.useState<number | undefined>(projectId);
  const [rangeType, setRangeType] = React.useState<'all' | 'specific'>('all');
  const [fromPage, setFromPage] = React.useState(1);
  const [toPage, setToPage] = React.useState(5);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { if (open) setSelectedProjectId(projectId); }, [open, projectId]);

  const handleApply = async () => {
    if (!selectedProjectId || !templateId) {
      toast({ title: 'احفظ القالب أولاً ثم طبّقه على المشروع', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const range = rangeType === 'all' ? 'all' : { from: fromPage, to: toPage };
      await db.projects.update(selectedProjectId, {
        pageTemplateId: templateId,
        pageTemplateRange: range,
        updatedAt: Date.now(),
      });
      const proj = (projects ?? []).find(p => p.id === selectedProjectId);
      toast({ title: `✅ تم تطبيق القالب على: ${proj?.title ?? 'المشروع'}` });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" dir="rtl">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold">تطبيق القالب على مشروع</h2>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{templateName}</p>
          {!templateId && (
            <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-3 py-2 rounded-lg">
              ⚠️ احفظ القالب أولاً لتتمكن من ربطه بمشروع
            </p>
          )}
        </div>

        {/* اختيار المشروع */}
        <div className="space-y-2">
          <label className="text-sm font-medium">اختر المشروع</label>
          <select
            value={selectedProjectId ?? ''}
            onChange={e => setSelectedProjectId(e.target.value ? +e.target.value : undefined)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 ring-primary/30 outline-none"
          >
            <option value="">— اختر مشروعاً —</option>
            {(projects ?? []).map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        {/* نطاق الصفحات */}
        <div className="space-y-3">
          <label className="text-sm font-medium">تطبيق على</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={rangeType === 'all'} onChange={() => setRangeType('all')} className="accent-primary" />
              جميع الصفحات
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={rangeType === 'specific'} onChange={() => setRangeType('specific')} className="accent-primary" />
              نطاق محدد
            </label>
          </div>
          {rangeType === 'specific' && (
            <div className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">من صفحة</label>
                <input type="number" min={1} value={fromPage} onChange={e => setFromPage(+e.target.value)}
                  className="w-16 border rounded px-2 py-1 text-sm text-center bg-background focus:outline-none focus:ring-2 ring-primary/30" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">إلى صفحة</label>
                <input type="number" min={fromPage} value={toPage} onChange={e => setToPage(+e.target.value)}
                  className="w-16 border rounded px-2 py-1 text-sm text-center bg-background focus:outline-none focus:ring-2 ring-primary/30" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-lg border text-sm hover:bg-muted transition-colors">
            إلغاء
          </button>
          <button onClick={handleApply} disabled={!selectedProjectId || !templateId || saving}
            className="flex-1 h-10 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'جاري التطبيق...' : 'تطبيق القالب'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DesignerWorkspace({ initialPages, initialMeta, savedTemplateId, onExit, projectId }: Props) {
  const { toast } = useToast();
  const [state, dispatch] = useReducer(designerReducer, null, () =>
    makeInitialState(initialPages, initialMeta, savedTemplateId)
  );

  // Modals
  const [showNewPage, setShowNewPage] = React.useState(false);
  const [showLibrary, setShowLibrary] = React.useState(false);
  const [showStickers, setShowStickers] = React.useState(false);
  const [showComponents, setShowComponents] = React.useState(false);
  const [showStyles, setShowStyles] = React.useState(false);
  const [showSave, setShowSave] = React.useState(false);
  const [showImageImporter, setShowImageImporter] = React.useState(false);
  const [imageImportMode, setImageImportMode] = React.useState<'insert' | 'background'>('insert');
  const [toolbarCollapsed, setToolbarCollapsed] = React.useState(false);
  const [showApplyToProject, setShowApplyToProject] = React.useState(false);

  // Load project title if opened from project context
  const projectTitle = useLiveQuery(
    async () => (projectId ? (await db.projects.get(projectId))?.title : undefined),
    [projectId]
  );

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Autosave ────────────────────────────────────────────────────────────────

  const saveTemplate = useCallback(async (
    meta: DesignerState['templateMeta'],
    pages: DesignerPage[],
    id?: number,
    asNew = false,
  ): Promise<number> => {
    const now = Date.now();
    if (id && !asNew) {
      const existing = await db.designerTemplates.get(id);
      if (existing) {
        const newVersion = (existing.currentVersion ?? 1) + 1;
        const versions = [...(existing.versions ?? []), { version: newVersion - 1, pages: existing.pages, savedAt: now }].slice(-10);
        await db.designerTemplates.update(id, { ...meta, pages, updatedAt: now, currentVersion: newVersion, versions });
        return id;
      }
    }
    const newId = await db.designerTemplates.add({
      ...meta, pages, createdAt: now, updatedAt: now, currentVersion: 1, versions: [],
    });
    return newId as number;
  }, []);

  useEffect(() => {
    if (!state.isDirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      if (!state.templateMeta.name) return; // Don't autosave unnamed templates
      try {
        const id = await saveTemplate(state.templateMeta, state.pages, state.savedTemplateId, false);
        dispatch({ type: 'MARK_SAVED', id });
        toast({ title: '💾 تم الحفظ التلقائي', duration: 2000 });
      } catch (e) { /* silent */ }
    }, 30000); // 30 seconds
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [state.isDirty, state.pages, state.templateMeta, state.savedTemplateId]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (ctrl && e.key === 'z') { e.preventDefault(); dispatch({ type: 'UNDO' }); return; }
      if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); dispatch({ type: 'REDO' }); return; }
      if (ctrl && e.key === 'c') { e.preventDefault(); dispatch({ type: 'COPY' }); return; }
      if (ctrl && e.key === 'v') { e.preventDefault(); dispatch({ type: 'PASTE' }); return; }
      if (ctrl && e.key === 'd') { e.preventDefault(); dispatch({ type: 'DUPLICATE_ELEMENTS', ids: state.selectedIds }); return; }
      if (ctrl && e.key === 'a') { e.preventDefault(); dispatch({ type: 'SELECT', ids: state.pages[state.currentPageIndex]?.elements.map(e => e.id) ?? [] }); return; }
      if (ctrl && e.key === 's') { e.preventDefault(); setShowSave(true); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedIds.length > 0) { e.preventDefault(); dispatch({ type: 'DELETE_ELEMENTS', ids: state.selectedIds }); }
        return;
      }
      if (e.key === 'Escape') { dispatch({ type: 'SELECT', ids: [] }); dispatch({ type: 'SET_TOOL', tool: 'select' }); return; }

      // Tool shortcuts
      if (!ctrl) {
        const toolMap: Record<string, any> = { v: 'select', h: 'move', z: 'zoom', t: 'text', l: 'line', r: 'rect', o: 'circle', p: 'pen', i: 'image' };
        if (toolMap[e.key.toLowerCase()]) {
          dispatch({ type: 'SET_TOOL', tool: toolMap[e.key.toLowerCase()] });
          return;
        }
        // Arrow keys: nudge selected elements
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && state.selectedIds.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 0.1;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          state.selectedIds.forEach(id => {
            const el = state.pages[state.currentPageIndex]?.elements.find(e => e.id === id);
            if (el) dispatch({ type: 'UPDATE_ELEMENT', id, changes: { x: el.x + dx, y: el.y + dy } });
          });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.selectedIds, state.pages, state.currentPageIndex]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleExit = () => {
    if (state.isDirty) {
      if (!confirm('لديك تغييرات غير محفوظة. هل تريد الخروج؟')) return;
    }
    onExit();
  };

  const handleSave = () => setShowSave(true);

  const handleSaveConfirm = async (meta: DesignerState['templateMeta'], asNew: boolean) => {
    try {
      dispatch({ type: 'SET_META', meta });
      const id = await saveTemplate(meta, state.pages, state.savedTemplateId, asNew);
      dispatch({ type: 'MARK_SAVED', id });
      toast({ title: '✅ تم حفظ القالب بنجاح', description: meta.name });
    } catch (e) {
      toast({ title: 'فشل الحفظ', variant: 'destructive' });
    }
  };

  const handleExport = (format: 'json' | 'print') => {
    if (format === 'json') {
      const data = JSON.stringify({ meta: state.templateMeta, pages: state.pages }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${state.templateMeta.name || 'template'}.json`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'تم تصدير القالب بنجاح' });
    } else {
      window.print();
    }
  };

  const handleAddPage = (settings: PageSettings) => {
    const newPage: DesignerPage = { id: crypto.randomUUID(), settings, elements: [], background: { ...DEFAULT_BACKGROUND } };
    dispatch({ type: 'ADD_PAGE', page: newPage });
  };

  const handleInsertSticker = (stickerId: string, color: string) => {
    const id = crypto.randomUUID();
    const el: any = {
      id, type: 'sticker', name: 'ملصق', x: 40, y: 40, width: 8, height: 8,
      rotation: 0, opacity: 100, locked: false, visible: true, printable: true, zIndex: state.pages[state.currentPageIndex].elements.length,
      version: 1, stickerId, color,
    };
    dispatch({ type: 'ADD_ELEMENT', element: el });
    setShowStickers(false);
  };

  const handleInsertComponent = (element: DesignerElement) => {
    dispatch({ type: 'ADD_ELEMENT', element });
  };

  const handleImageInsert = (imgData: { src: string; brightness: number; contrast: number; saturation: number; blur: number }) => {
    if (imageImportMode === 'background') {
      dispatch({ type: 'SET_BACKGROUND', bg: { type: 'image', imageData: imgData.src, brightness: imgData.brightness, contrast: imgData.contrast, saturation: imgData.saturation, blur: imgData.blur } });
    } else {
      const el: any = {
        id: crypto.randomUUID(), type: 'image', name: 'صورة', x: 20, y: 20, width: 30, height: 25,
        rotation: 0, opacity: 100, locked: false, visible: true, printable: true,
        zIndex: state.pages[state.currentPageIndex].elements.length, version: 1,
        src: imgData.src, objectFit: 'contain', brightness: imgData.brightness,
        contrast: imgData.contrast, saturation: imgData.saturation, blur: imgData.blur,
      };
      dispatch({ type: 'ADD_ELEMENT', element: el });
    }
  };

  const handleOpenLibraryTemplate = (tpl: DesignerTemplate) => {
    dispatch({ type: 'LOAD_TEMPLATE', pages: tpl.pages, meta: { name: tpl.name, description: tpl.description, category: tpl.category, subject: tpl.subject, keywords: tpl.keywords, applyTo: tpl.applyTo, linkedGrades: tpl.linkedGrades ?? [] }, id: tpl.id });
    setShowLibrary(false);
    toast({ title: 'تم فتح القالب' });
  };

  const handleApplyStyle = (style: any) => {
    if (state.selectedIds.length === 0) return;
    state.selectedIds.forEach(id => {
      dispatch({ type: 'UPDATE_ELEMENT', id, changes: style.properties });
    });
  };

  const currentPage = state.pages[state.currentPageIndex];
  const currentPageEl = state.selectedIds.length === 1 ? currentPage?.elements.find(e => e.id === state.selectedIds[0]) : undefined;

  const showRightPanel = state.showLayers || state.showProperties;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1a2e]" dir="rtl">
      {/* Top bar */}
      <DesignerTopBar
        state={state}
        dispatch={dispatch}
        onExit={handleExit}
        onSave={handleSave}
        onExport={handleExport}
        onAddPage={() => setShowNewPage(true)}
        onApplyToProject={projectId !== undefined ? () => setShowApplyToProject(true) : undefined}
        projectTitle={projectTitle ?? undefined}
      />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left toolbar */}
        <DesignerToolbar
          activeTool={state.activeTool}
          dispatch={dispatch}
          collapsed={toolbarCollapsed || !state.showToolbar}
          onToggle={() => setToolbarCollapsed(!toolbarCollapsed)}
          onOpenStickers={() => setShowStickers(true)}
          onOpenImageImporter={() => { setImageImportMode('insert'); setShowImageImporter(true); }}
          onOpenDynamicField={() => dispatch({ type: 'SET_TOOL', tool: 'dynamic-field' })}
        />

        {/* Canvas */}
        <DesignerCanvas
          state={state}
          dispatch={dispatch}
          onOpenImageImporter={() => { setImageImportMode('insert'); setShowImageImporter(true); }}
        />

        {/* Right panel */}
        {showRightPanel && (
          <div className="w-72 bg-background border-l border-border flex flex-col overflow-hidden shrink-0">
            {/* Page tabs (when multi-page) */}
            {state.pages.length > 1 && (
              <div className="flex gap-1 px-2 py-1.5 bg-muted/30 border-b overflow-x-auto shrink-0">
                {state.pages.map((p, i) => (
                  <button key={p.id} onClick={() => dispatch({ type: 'GO_TO_PAGE', index: i })}
                    className={`px-2 py-0.5 rounded text-xs shrink-0 transition-colors ${i === state.currentPageIndex ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
            )}

            {/* Layers */}
            {state.showLayers && (
              <div className="flex-1 overflow-hidden min-h-0">
                <DesignerLayers state={state} dispatch={dispatch} />
              </div>
            )}

            {/* Properties */}
            {state.showProperties && (
              <div className={`flex flex-col overflow-hidden ${state.showLayers ? 'h-80 border-t border-border' : 'flex-1'}`}>
                <DesignerProperties state={state} dispatch={dispatch} />
              </div>
            )}

            {/* Quick actions */}
            <div className="shrink-0 border-t border-border p-2 flex flex-wrap gap-1">
              <button onClick={() => setShowComponents(true)}
                className="px-2 py-1 rounded text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors">
                📦 مكونات
              </button>
              <button onClick={() => setShowStyles(true)}
                className="px-2 py-1 rounded text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors">
                🎨 أنماط
              </button>
              <button onClick={() => { setImageImportMode('background'); setShowImageImporter(true); }}
                className="px-2 py-1 rounded text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors">
                🖼️ خلفية
              </button>
              {state.selectedIds.length > 0 && (
                <button
                  onClick={async () => {
                    if (!state.templateMeta.name) { toast({ title: 'احفظ القالب أولاً' }); return; }
                    const el = currentPageEl;
                    if (!el) return;
                    await db.designerComponents.add({
                      name: el.name || el.type, description: '', category: 'عناصر', componentType: 'custom',
                      element: el, thumbnail: undefined, usageCount: 0, tags: [],
                      createdAt: Date.now(), updatedAt: Date.now(), currentVersion: 1, versions: [],
                    });
                    toast({ title: 'تم حفظ المكون في المكتبة' });
                  }}
                  className="px-2 py-1 rounded text-xs bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                  ⭐ حفظ مكون
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ─────────────────────────────────────────────────── */}

      <NewPageDialog open={showNewPage} onClose={() => setShowNewPage(false)} onConfirm={handleAddPage} />

      <TemplateLibrary open={showLibrary} onClose={() => setShowLibrary(false)} onOpen={handleOpenLibraryTemplate} />

      <StickersLibrary open={showStickers} onClose={() => setShowStickers(false)} onInsert={handleInsertSticker} />

      <ComponentLibrary open={showComponents} onClose={() => setShowComponents(false)} onInsert={handleInsertComponent} />

      <StylesManager
        open={showStyles}
        onClose={() => setShowStyles(false)}
        selectedElement={currentPageEl}
        onApplyStyle={handleApplyStyle}
      />

      <ImageImporter
        open={showImageImporter}
        onClose={() => setShowImageImporter(false)}
        onInsert={handleImageInsert}
        mode={imageImportMode}
      />

      <SaveTemplateDialog
        open={showSave}
        onClose={() => setShowSave(false)}
        onSave={handleSaveConfirm}
        initialMeta={state.templateMeta}
        isSaved={!!state.savedTemplateId}
      />

      <ApplyToProjectDialog
        open={showApplyToProject}
        onClose={() => setShowApplyToProject(false)}
        templateId={state.savedTemplateId}
        templateName={state.templateMeta.name || 'بدون عنوان'}
        projectId={projectId}
      />
    </div>
  );
}
