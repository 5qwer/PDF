import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  Plus, Search, BookOpen, MoreVertical, Pencil, Trash2, FileText, Tag, X, Check, Files,
  Download, Loader2, PenTool,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

async function getCategories(): Promise<string[]> {
  const s = await db.settings.get('categories');
  if (!s) return [];
  try { return JSON.parse(s.value) as string[]; } catch { return []; }
}

// ─── New Project Dialog ───────────────────────────────────────────────────────
function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [_, setLocation] = useLocation();
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const categories = useLiveQuery(() => getCategories(), []) ?? [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      const now = Date.now();
      const id = await db.projects.add({
        title: newTitle.trim(),
        subject: newSubject.trim() || undefined,
        category: newCategory || undefined,
        coverColor: `hsl(${Math.floor(Math.random() * 360)}, 70%, 55%)`,
        createdAt: now,
        updatedAt: now,
      });
      onClose();
      setNewTitle(""); setNewSubject(""); setNewCategory("");
      setLocation(`/builder/${id}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent dir="rtl">
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle>إنشاء مشروع جديد</DialogTitle>
            <DialogDescription>ابدأ ورقة عمل أو امتحانًا أو كتيب مراجعة جديدًا.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="np-title">اسم المشروع *</Label>
              <Input id="np-title" placeholder="مثال: امتحان الفيزياء — الفصل الأول 2025"
                value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-subject">المادة الدراسية</Label>
              <Input id="np-subject" placeholder="مثال: الفيزياء"
                value={newSubject} onChange={e => setNewSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-category">الفئة الدراسية</Label>
              {categories.length > 0 ? (
                <select id="np-category" dir="rtl" value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:ring-2 ring-primary/30 outline-none">
                  <option value="">— بدون تصنيف —</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <Input id="np-category" placeholder="مثال: الصف الثالث الثانوي"
                  value={newCategory} onChange={e => setNewCategory(e.target.value)} />
              )}
              {categories.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  يمكنك إضافة فئات ثابتة من <Link href="/settings" className="text-primary underline">الإعدادات</Link>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={!newTitle.trim() || isCreating}>
              {isCreating && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              إنشاء المشروع
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Doc Selection Sheet ──────────────────────────────────────────────────────
function DocSelectionSheet({ projectId, projectTitle, allowedDocIds, onClose }: {
  projectId: number; projectTitle: string; allowedDocIds?: number[]; onClose: () => void;
}) {
  const { toast } = useToast();
  const documents = useLiveQuery(() => db.documents.orderBy('createdAt').reverse().toArray(), []);
  const categories = useLiveQuery(() => getCategories(), []) ?? [];
  const [selected, setSelected] = useState<Set<number>>(new Set(allowedDocIds ?? []));
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const filtered = (documents ?? []).filter(d => {
    const matchS = d.name.toLowerCase().includes(search.toLowerCase());
    const matchC = filterCat === 'all' || d.category === filterCat || (filterCat === '__none__' && !d.category);
    return matchS && matchC;
  });
  const allDocCats = [...new Set((documents ?? []).map(d => d.category).filter(Boolean))] as string[];
  const allCats = [...new Set([...categories, ...allDocCats])];

  const toggle = (id: number) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const save = async () => {
    await db.projects.update(projectId, { allowedDocIds: selected.size > 0 ? [...selected] : undefined, updatedAt: Date.now() });
    toast({ title: `✅ تم حفظ ${selected.size} مستند للمشروع` });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-96 bg-background shadow-2xl flex flex-col border-r border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div><h2 className="font-bold text-base">تحديد المستندات</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[280px]">{projectTitle}</p></div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="بحث باسم المستند..." className="pr-9 h-8 text-xs" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {allCats.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {['all', ...allCats, '__none__'].map(cat => (
                <button key={cat} onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${filterCat === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  {cat === 'all' ? 'الكل' : cat === '__none__' ? 'غير مصنف' : cat}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {selected.size > 0 && (
            <div className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
              <Check className="w-3 h-3 text-primary" />{selected.size} مستند محدد
              <button onClick={() => setSelected(new Set())} className="text-destructive hover:underline mr-2">مسح الكل</button>
            </div>
          )}
          {filtered.length === 0
            ? <p className="text-center text-muted-foreground text-sm py-8">لا توجد مستندات مطابقة</p>
            : filtered.map(doc => {
              const isSelected = selected.has(doc.id!);
              return (
                <button key={doc.id} onClick={() => toggle(doc.id!)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-right transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-border'}`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.name}</p>
                    {doc.category && <span className="text-[10px] text-muted-foreground">{doc.category}</span>}
                  </div>
                </button>
              );
            })
          }
        </div>
        <div className="border-t p-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>إلغاء</Button>
          <Button className="flex-1" onClick={save}><Check className="w-3.5 h-3.5 me-1" />حفظ ({selected.size})</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Export Dialog ────────────────────────────────────────────────────────────
type ExportFormat = 'pdf' | 'images' | 'zip';

function ExportDialog({ project, onClose }: { project: any; onClose: () => void }) {
  const [_, setLocation] = useLocation();
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const formats: { id: ExportFormat; label: string; desc: string; icon: string }[] = [
    { id: 'pdf', label: 'PDF', desc: 'ملف PDF واحد يضم كل الصفحات (عبر الطباعة)', icon: '📄' },
    { id: 'images', label: 'صور PNG', desc: 'كل صفحة كصورة مستقلة عالية الجودة', icon: '🖼️' },
    { id: 'zip', label: 'ZIP — صور', desc: 'ضغط الصور في ملف zip واحد', icon: '🗜️' },
  ];

  const doExport = () => {
    setIsExporting(true);
    const flag = format === 'pdf' ? 'print' : format === 'images' ? 'export-images' : 'export-zip';
    onClose();
    setLocation(`/builder/${project.id}?export=${flag}`);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>تصدير المشروع</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1 truncate">{project.title}</p>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm font-medium text-foreground">اختر صيغة التصدير:</p>
          {formats.map(f => (
            <button key={f.id} onClick={() => setFormat(f.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-right transition-all ${format === f.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
              <span className="text-2xl shrink-0">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
              {format === f.id && <Check className="w-4 h-4 text-primary mr-auto shrink-0" />}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={doExport} disabled={isExporting} className="gap-2">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            تصدير
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Category Dialog ──────────────────────────────────────────────────────────
function CategoryDialog({ project, onClose }: { project: any; onClose: () => void }) {
  const { toast } = useToast();
  const categories = useLiveQuery(() => getCategories(), []) ?? [];
  const [selected, setSelected] = useState(project.category ?? '');

  const save = async () => {
    await db.projects.update(project.id!, { category: selected || undefined, updatedAt: Date.now() });
    toast({ title: selected ? `✅ تم تعيين الفئة: ${selected}` : '✅ تم إزالة التصنيف' });
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader><DialogTitle>الفئة الدراسية</DialogTitle></DialogHeader>
        <div className="py-3 space-y-3">
          <p className="text-sm text-muted-foreground truncate">{project.title}</p>
          {categories.length === 0 ? (
            <div className="text-sm text-muted-foreground p-3 bg-muted/20 rounded-lg">
              لا توجد فئات محددة. أضف فئات في صفحة <strong>الإعدادات</strong> أولاً.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button onClick={() => setSelected('')}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-right text-sm transition-colors ${!selected ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:border-primary/30'}`}>
                {!selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                <span className="text-muted-foreground">— بدون تصنيف —</span>
              </button>
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelected(cat)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-right text-sm transition-colors ${selected === cat ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:border-primary/30'}`}>
                  {selected === cat && <Check className="w-4 h-4 text-primary shrink-0" />}
                  <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={categories.length === 0}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Projects() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const projects = useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), []);
  const categories = useLiveQuery(() => getCategories(), []) ?? [];

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [docSheetProjectId, setDocSheetProjectId] = useState<number | null>(null);
  const [exportProject, setExportProject] = useState<any | null>(null);
  const [categoryProject, setCategoryProject] = useState<any | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا المشروع وكل عناصره؟")) return;
    await db.projectItems.where("projectId").equals(id).delete();
    await db.projects.delete(id);
    toast({ title: "تم حذف المشروع" });
  };

  const allProjCats = [...new Set((projects ?? []).map(p => p.category).filter(Boolean))] as string[];
  const allCats = [...new Set([...categories, ...allProjCats])];
  const hasNone = (projects ?? []).some(p => !p.category);

  const filteredProjects = (projects ?? []).filter(p => {
    const matchSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = filterCat === 'all' || p.category === filterCat || (filterCat === '__none__' && !p.category);
    return matchSearch && matchCat;
  });

  const docSheetProject = docSheetProjectId !== null
    ? (projects ?? []).find(p => p.id === docSheetProjectId) ?? null
    : null;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">مكتبة المشاريع</h1>
          <p className="text-muted-foreground mt-1">إدارة أوراق العمل والامتحانات الخاصة بك.</p>
        </div>
        <Button size="lg" className="shadow-md gap-2" onClick={() => setShowNewDialog(true)}>
          <Plus className="w-5 h-5" /> مشروع جديد
        </Button>
      </div>

      {/* Search + Category filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث في المشاريع..." className="pr-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        {/* Category pills */}
        {allCats.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
            <button onClick={() => setFilterCat('all')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filterCat === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              الكل
              <span className="mr-1.5 text-xs opacity-70">({(projects ?? []).length})</span>
            </button>
            {allCats.map(cat => {
              const count = (projects ?? []).filter(p => p.category === cat).length;
              return (
                <button key={cat} onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filterCat === cat ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  {cat}
                  <span className="mr-1.5 text-xs opacity-70">({count})</span>
                </button>
              );
            })}
            {hasNone && (
              <button onClick={() => setFilterCat(filterCat === '__none__' ? 'all' : '__none__')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filterCat === '__none__' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                غير مصنف
              </button>
            )}
          </div>
        )}
      </div>

      {/* Projects Grid */}
      {projects === undefined ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProjects.map(project => (
            <Card key={project.id} className="flex flex-col overflow-hidden hover:border-primary/50 hover:shadow-md transition-all group">
              <div className="h-2 w-full" style={{ backgroundColor: project.coverColor || 'hsl(var(--primary))' }} />
              <CardHeader className="pb-3 flex-1">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="line-clamp-2 text-lg font-bold leading-tight flex-1">
                    <Link href={`/builder/${project.id}`} className="hover:text-primary transition-colors">{project.title}</Link>
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 text-muted-foreground shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel>إجراءات</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={`/builder/${project.id}`} className="cursor-pointer w-full flex items-center gap-2">
                          <Pencil className="h-4 w-4" /> فتح المحرر
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/page-designer?projectId=${project.id}`} className="cursor-pointer w-full flex items-center gap-2">
                          <PenTool className="h-4 w-4" /> تصميم الصفحة
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setDocSheetProjectId(project.id!)}>
                        <Files className="h-4 w-4" /> تحديد المستندات
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setCategoryProject(project)}>
                        <Tag className="h-4 w-4" /> {project.category ? 'تغيير الفئة' : 'تعيين فئة'}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setExportProject(project)}>
                        <Download className="h-4 w-4" /> تصدير المشروع
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer gap-2"
                        onClick={() => handleDelete(project.id!)}>
                        <Trash2 className="h-4 w-4" /> حذف المشروع
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="flex items-center gap-2 mt-2 flex-wrap">
                  {project.subject && (
                    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {project.subject}
                    </span>
                  )}
                  {project.category && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                      <Tag className="w-2.5 h-2.5" />{project.category}
                    </span>
                  )}
                  {(project as any).pageTemplateId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-xs font-medium">
                      <PenTool className="w-2.5 h-2.5" /> قالب مخصص
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardFooter className="py-3 bg-muted/10 border-t flex justify-between items-center text-xs text-muted-foreground">
                <span>{new Date(project.updatedAt).toLocaleDateString('ar-EG')}</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center flex flex-col items-center">
          <BookOpen className="w-16 h-16 text-muted-foreground opacity-20 mb-4" />
          <h3 className="text-xl font-medium">لا توجد مشاريع</h3>
          <p className="text-muted-foreground mt-2 max-w-md">
            {searchTerm || filterCat !== 'all' ? "جرّب تعديل كلمات البحث أو تغيير الفئة." : "أنشئ مشروعك الأول بالضغط على زر \"مشروع جديد\" أعلاه."}
          </p>
          {!searchTerm && filterCat === 'all' && (
            <Button className="mt-4" onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 me-1" /> مشروع جديد
            </Button>
          )}
        </div>
      )}

      {/* Dialogs */}
      <NewProjectDialog open={showNewDialog} onClose={() => setShowNewDialog(false)} />
      {docSheetProject && (
        <DocSelectionSheet projectId={docSheetProject.id!} projectTitle={docSheetProject.title}
          allowedDocIds={docSheetProject.allowedDocIds} onClose={() => setDocSheetProjectId(null)} />
      )}
      {exportProject && <ExportDialog project={exportProject} onClose={() => setExportProject(null)} />}
      {categoryProject && <CategoryDialog project={categoryProject} onClose={() => setCategoryProject(null)} />}
    </div>
  );
}
