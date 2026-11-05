import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { db } from '@/lib/db';
import DesignerWorkspace from '@/components/designer/DesignerWorkspace';
import NewPageDialog from '@/components/designer/NewPageDialog';
import TemplateLibrary from '@/components/designer/TemplateLibrary';
import ImportPagesDialog from '@/components/designer/ImportPagesDialog';
import ImportCreateDialog from '@/components/designer/ImportCreateDialog';
import type { PageSettings, DesignerTemplate, DesignerPage } from '@/lib/designer-types';
import { PAGE_SIZE_DIMS, DEFAULT_BACKGROUND } from '@/lib/designer-types';
import {
  Plus, Upload, Clock, Library, PenTool,
  FileText, Trash2, Edit3, X, Search, ArrowRight, BookOpen, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

function makeDefaultSettings(): PageSettings {
  return {
    size: 'A4', unit: 'mm', orientation: 'portrait', backgroundType: 'blank',
    margins: { top: 20, bottom: 20, left: 15, right: 15, linked: false },
  };
}

function makeDefaultPage(settings: PageSettings) {
  const id = crypto.randomUUID();
  return { id, settings, elements: [], background: { ...DEFAULT_BACKGROUND } };
}

/** استخراج projectId من الـ URL query string */
function useProjectIdFromUrl(): number | undefined {
  const [location] = useLocation();
  try {
    // wouter's useLocation gives the path. We read window.location.search for query params.
    const params = new URLSearchParams(window.location.search);
    const v = params.get('projectId');
    return v ? parseInt(v, 10) : undefined;
  } catch {
    return undefined;
  }
}

export default function PageDesigner() {
  const { toast } = useToast();
  const [mode, setMode] = useState<'start' | 'editing'>('start');
  const [initialPages, setInitialPages] = useState<any[]>([]);
  const [initialMeta, setInitialMeta] = useState<any>(null);
  const [loadedId, setLoadedId] = useState<number | undefined>(undefined);
  const projectId = useProjectIdFromUrl();

  const [showNew, setShowNew] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showImportPages, setShowImportPages] = useState(false);
  const [showImportCreate, setShowImportCreate] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [importing, setImporting] = useState(false);

  const project = useLiveQuery(
    async () => (projectId ? await db.projects.get(projectId) : undefined),
    [projectId]
  );

  const savedTemplates = useLiveQuery(() =>
    db.designerTemplates.orderBy('updatedAt').reverse().toArray(), []
  ) ?? [];

  const recentTemplates = savedTemplates.slice(0, 6);

  // إذا كان المشروع لديه قالب مطبَّق، افتحه تلقائياً
  useEffect(() => {
    if (project?.pageTemplateId && mode === 'start') {
      db.designerTemplates.get(project.pageTemplateId).then(tpl => {
        if (tpl) {
          setInitialPages(tpl.pages);
          setInitialMeta({
            name: tpl.name, description: tpl.description, category: tpl.category,
            subject: tpl.subject, keywords: tpl.keywords, applyTo: tpl.applyTo,
            linkedGrades: tpl.linkedGrades ?? [],
          });
          setLoadedId(tpl.id);
          setMode('editing');
        }
      });
    }
  }, [project?.pageTemplateId]);

  const handleNewPage = (settings: PageSettings) => {
    const page = makeDefaultPage(settings);
    setInitialPages([page]);
    setInitialMeta(null);
    setLoadedId(undefined);
    setMode('editing');
  };

  const handleOpenTemplate = (tpl: DesignerTemplate) => {
    setInitialPages(tpl.pages);
    setInitialMeta({
      name: tpl.name, description: tpl.description, category: tpl.category,
      subject: tpl.subject, keywords: tpl.keywords, applyTo: tpl.applyTo,
      linkedGrades: tpl.linkedGrades ?? [],
    });
    setLoadedId(tpl.id);
    setMode('editing');
  };

  /** يُستدعى من ImportCreateDialog لفتح الصفحات في المحرر مباشرةً */
  const handleStartEditingFromImport = (pages: DesignerPage[], meta?: any) => {
    setInitialPages(pages);
    setInitialMeta(meta ?? null);
    setLoadedId(undefined);
    setMode('editing');
  };

  const handleDeleteTemplate = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('هل تريد حذف هذا القالب نهائياً؟')) return;
    await db.designerTemplates.delete(id);
    toast({ title: 'تم حذف القالب' });
  };

  const filtered = savedTemplates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.category ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (mode === 'editing') {
    return (
      <DesignerWorkspace
        initialPages={initialPages}
        initialMeta={initialMeta}
        savedTemplateId={loadedId}
        onExit={() => setMode('start')}
        projectId={projectId}
      />
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <PenTool className="w-8 h-8 text-primary" />
            مصمّم الصفحات
          </h1>
          {project ? (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">مفتوح من مشروع:</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 text-violet-700 px-3 py-0.5 text-sm font-medium">
                <BookOpen className="w-3.5 h-3.5" /> {project.title}
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground mt-1">بيئة تصميم صفحات احترافية متكاملة</p>
          )}
        </div>
        {project && (
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => window.history.back()}>
            <ArrowRight className="w-4 h-4" /> العودة للمشروع
          </Button>
        )}
      </div>

      {/* Info about the project's applied template */}
      {project?.pageTemplateId && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-start gap-3">
          <PenTool className="w-5 h-5 text-violet-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-violet-800">هذا المشروع لديه قالب تصميم مطبَّق</p>
            <p className="text-xs text-violet-600 mt-0.5">
              اضغط على القالب المطبَّق أدناه لتعديله، أو أنشئ قالباً جديداً.
              {project.pageTemplateRange && project.pageTemplateRange !== 'all' && (
                <> النطاق المطبَّق: من صفحة {(project.pageTemplateRange as any).from} إلى {(project.pageTemplateRange as any).to}</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Quick actions — 2×2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* إنشاء صفحة جديدة */}
        <button
          onClick={() => setShowNew(true)}
          className="group flex items-start gap-4 p-5 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-all text-right">
          <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base">إنشاء صفحة جديدة</h3>
            <p className="text-sm text-muted-foreground mt-0.5">ابدأ من الصفر بمقاس وتصميم مخصص</p>
          </div>
        </button>

        {/* استيراد صفحات */}
        <button
          onClick={() => setShowImportPages(true)}
          className="group flex items-start gap-4 p-5 rounded-xl border-2 border-border hover:border-blue-400 hover:bg-blue-50/40 transition-all text-right">
          <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
            <BookOpen className="w-6 h-6 text-muted-foreground group-hover:text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-base">استيراد صفحات</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              ابحث بالاسم أو الصف أو المادة واستورد صفحة من مكتبتك
            </p>
          </div>
        </button>

        {/* عرض مكتبات الصفحات */}
        <button
          onClick={() => setShowLibrary(true)}
          className="group flex items-start gap-4 p-5 rounded-xl border-2 border-border hover:border-violet-400 hover:bg-violet-50/40 transition-all text-right">
          <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-violet-100 flex items-center justify-center shrink-0 transition-colors">
            <Layers className="w-6 h-6 text-muted-foreground group-hover:text-violet-600" />
          </div>
          <div>
            <h3 className="font-bold text-base">عرض مكتبات الصفحات</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              استعرض قوالبك المحفوظة ({savedTemplates.length}) وابحث فيها
            </p>
          </div>
        </button>

        {/* استيراد وإنشاء القالب */}
        <button
          onClick={() => setShowImportCreate(true)}
          className="group flex items-start gap-4 p-5 rounded-xl border-2 border-border hover:border-amber-400 hover:bg-amber-50/40 transition-all text-right">
          <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-amber-100 flex items-center justify-center shrink-0 transition-colors">
            <Upload className="w-6 h-6 text-muted-foreground group-hover:text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-base">استيراد وإنشاء القالب</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              استورد أي ملف (صورة، PDF، JSON) وحوّله لقالب أو استخرج تصميمه
            </p>
          </div>
        </button>
      </div>

      {/* Recent templates */}
      {recentTemplates.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" /> آخر الصفحات المستخدمة
            </h2>
            {savedTemplates.length > 6 && (
              <Button variant="ghost" size="sm" onClick={() => setShowLibrary(true)}>
                عرض الكل ({savedTemplates.length})
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {recentTemplates.map(tpl => {
              const isApplied = project?.pageTemplateId === tpl.id;
              return (
                <Card key={tpl.id}
                  className={`group hover:border-primary/50 hover:shadow-md transition-all cursor-pointer overflow-hidden relative ${isApplied ? 'border-violet-400 ring-2 ring-violet-400/30' : ''}`}
                  onClick={() => handleOpenTemplate(tpl)}>
                  {isApplied && (
                    <div className="absolute top-1 right-1 z-10 bg-violet-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      مطبَّق
                    </div>
                  )}
                  {/* Thumbnail */}
                  <div className="h-24 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center overflow-hidden">
                    {tpl.thumbnail
                      ? <img src={tpl.thumbnail} alt={tpl.name} className="w-full h-full object-cover" />
                      : <FileText className="w-8 h-8 text-muted-foreground/50" />}
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs font-semibold truncate">{tpl.name}</p>
                    {tpl.subject && <p className="text-[10px] text-muted-foreground truncate">{tpl.subject}</p>}
                  </CardContent>
                  {/* Delete */}
                  <button
                    onClick={e => handleDeleteTemplate(tpl.id!, e)}
                    className="absolute top-1 left-1 w-6 h-6 rounded-full bg-destructive/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* All saved templates search */}
      {savedTemplates.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">جميع القوالب المحفوظة</h2>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث في القوالب..." className="pr-9 h-9"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(searchTerm ? filtered : savedTemplates).map(tpl => {
              const isApplied = project?.pageTemplateId === tpl.id;
              return (
                <div key={tpl.id}
                  className={`group flex items-center gap-3 p-3 rounded-lg border hover:border-primary/40 hover:bg-muted/20 transition-all cursor-pointer ${isApplied ? 'border-violet-400 bg-violet-50/40' : ''}`}
                  onClick={() => handleOpenTemplate(tpl)}>
                  <div className="w-10 h-12 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {tpl.thumbnail
                      ? <img src={tpl.thumbnail} alt={tpl.name} className="w-full h-full object-cover" />
                      : <FileText className="w-5 h-5 text-muted-foreground/50" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                      {tpl.name}
                      {isApplied && <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded-full font-bold">مطبَّق</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[tpl.category, tpl.subject].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(tpl.updatedAt).toLocaleDateString('ar-EG')} — v{tpl.currentVersion}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="w-7 h-7 rounded flex items-center justify-center hover:bg-primary/10" onClick={e => { e.stopPropagation(); handleOpenTemplate(tpl); }}>
                      <Edit3 className="w-3.5 h-3.5 text-primary" />
                    </button>
                    <button className="w-7 h-7 rounded flex items-center justify-center hover:bg-destructive/10" onClick={e => handleDeleteTemplate(tpl.id!, e)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {savedTemplates.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <PenTool className="w-14 h-14 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg mb-1">لا توجد قوالب محفوظة بعد</h3>
            <p className="text-muted-foreground text-sm mb-4">أنشئ صفحتك الأولى وصممها، ثم احفظها كقالب.</p>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 me-1" /> إنشاء صفحة جديدة
            </Button>
          </CardContent>
        </Card>
      )}

      <NewPageDialog open={showNew} onClose={() => setShowNew(false)} onConfirm={handleNewPage} />
      <TemplateLibrary
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        onOpen={handleOpenTemplate}
      />
      <ImportPagesDialog
        open={showImportPages}
        onClose={() => setShowImportPages(false)}
        onOpen={handleOpenTemplate}
      />
      <ImportCreateDialog
        open={showImportCreate}
        onClose={() => setShowImportCreate(false)}
        onStartEditing={handleStartEditingFromImport}
      />
    </div>
  );
}
