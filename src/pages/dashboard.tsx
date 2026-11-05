import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  Plus, FileText, BookOpen, HelpCircle, BookPlus, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectDesign } from "@/lib/db";

async function getCategories(): Promise<string[]> {
  const s = await db.settings.get('categories');
  if (!s) return [];
  try { return JSON.parse(s.value) as string[]; } catch { return []; }
}

// ── قوالب مبنيّة مسبقاً ────────────────────────────────────────────────────────
interface PageTemplate {
  id: string;
  label: string;
  description: string;
  emoji: string;
  design: Partial<ProjectDesign>;
  bg: string;
  border: string;
}

const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'classic-exam',
    label: 'امتحان رسمي',
    description: 'تصميم احترافي بترويسة وترقيم عربي',
    emoji: '📋',
    design: { numbering: 'arabic', separator: 'dashed', bgColor: 'white', showHeader: true, fontSize: 'md' },
    bg: 'bg-white',
    border: 'border-gray-200',
  },
  {
    id: 'worksheet-cream',
    label: 'ورقة عمل كريمية',
    description: 'خلفية دافئة مناسبة للطباعة',
    emoji: '📝',
    design: { numbering: 'arabic', separator: 'solid', bgColor: 'cream', showHeader: true, fontSize: 'md' },
    bg: 'bg-[#fefce8]',
    border: 'border-yellow-200',
  },
  {
    id: 'two-column',
    label: 'عمودان',
    description: 'اختبار بعمودين لتوفير المساحة',
    emoji: '📰',
    design: { numbering: 'arabic', separator: 'dashed', bgColor: 'white', showHeader: true, twoColumn: true },
    bg: 'bg-white',
    border: 'border-blue-200',
  },
  {
    id: 'lined-notebook',
    label: 'دفتر مسطّر',
    description: 'سطور للكتابة كالدفاتر المدرسية',
    emoji: '📓',
    design: { numbering: 'arabic', separator: 'none', bgColor: 'lined-blue', showHeader: false, fontSize: 'md' },
    bg: 'bg-[#f8faff]',
    border: 'border-blue-300',
  },
  {
    id: 'grid-math',
    label: 'مشطّرة — رياضيات',
    description: 'خلفية مربعات مثالية للمسائل الرياضية',
    emoji: '📐',
    design: { numbering: 'abjad', separator: 'none', bgColor: 'grid', showHeader: true, fontSize: 'lg' },
    bg: 'bg-white',
    border: 'border-green-200',
  },
  {
    id: 'dark-night',
    label: 'ليلي داكن',
    description: 'تصميم داكن أنيق للعروض التقديمية',
    emoji: '🌙',
    design: { numbering: 'arabic', separator: 'solid', bgColor: 'dark-navy', showHeader: false, fontSize: 'md' },
    bg: 'bg-[#0f172a]',
    border: 'border-slate-700',
  },
];

// ── الصفحة الرئيسية ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [_, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [templateCreating, setTemplateCreating] = useState<string | null>(null);
  const categories = useLiveQuery(() => getCategories(), []) ?? [];

  const projects = useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), []);
  const docsCount = useLiveQuery(() => db.documents.count(), []);
  const questionsCount = useLiveQuery(() => db.questions.count(), []);

  const recentProjects = projects?.slice(0, 6) ?? [];

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
      setIsCreateOpen(false);
      setNewTitle(""); setNewSubject(""); setNewCategory("");
      setLocation(`/builder/${id}`);
    } finally {
      setIsCreating(false);
    }
  };

  const createFromTemplate = async (tpl: PageTemplate) => {
    setTemplateCreating(tpl.id);
    try {
      const now = Date.now();
      const id = await db.projects.add({
        title: `${tpl.label} — جديد`,
        coverColor: `hsl(${Math.floor(Math.random() * 360)}, 70%, 55%)`,
        design: { ...{ numbering: 'arabic', separator: 'dashed', bgColor: 'white', fontSize: 'md', showHeader: true, twoColumn: false, questionsPerPage: 0 }, ...tpl.design },
        createdAt: now,
        updatedAt: now,
      });
      setLocation(`/builder/${id}`);
    } finally {
      setTemplateCreating(null);
    }
  };

  const isLoading = projects === undefined;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-10" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">لوحة التحكم</h1>
          <p className="text-muted-foreground mt-1">مرحبًا! إليك نظرة عامة على عملك.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-md gap-2">
              <Plus className="w-5 h-5" /> مشروع جديد
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>إنشاء مشروع جديد</DialogTitle>
                <DialogDescription>ابدأ ورقة عمل أو امتحانًا أو كتيب مراجعة جديدًا.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">اسم المشروع</Label>
                  <Input id="title" placeholder="مثال: امتحان الفيزياء — الفصل الأول 2025" value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">المادة</Label>
                  <Input id="subject" placeholder="مثال: الفيزياء" value={newSubject} onChange={e => setNewSubject(e.target.value)} />
                </div>
                {categories.length > 0 && (
                  <div className="space-y-2">
                    <label htmlFor="category" className="text-sm font-medium leading-none">الفئة الدراسية</label>
                    <select id="category" dir="rtl" value={newCategory} onChange={e => setNewCategory(e.target.value)}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:ring-2 ring-primary/30 outline-none">
                      <option value="">— بدون تصنيف —</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={!newTitle.trim() || isCreating}>
                  {isCreating && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                  إنشاء المشروع
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-r-4 border-r-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> المشاريع
            </CardDescription>
            <CardTitle className="text-4xl">{projects?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-r-4 border-r-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" /> المستندات
            </CardDescription>
            <CardTitle className="text-4xl">{docsCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-r-4 border-r-purple-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-purple-500" /> بنك الأسئلة
            </CardDescription>
            <CardTitle className="text-4xl">{questionsCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* ── قوالب الصفحات السريعة ── */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold tracking-tight">قوالب تصميم الصفحات</h2>
          <span className="text-xs text-muted-foreground">اضغط لإنشاء مشروع جديد بهذا التصميم مباشرةً</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PAGE_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => createFromTemplate(tpl)}
              disabled={templateCreating === tpl.id}
              className={`rounded-xl border-2 ${tpl.border} ${tpl.bg} p-3 flex flex-col items-center gap-2 text-center hover:shadow-md hover:scale-[1.03] transition-all group relative`}
            >
              {templateCreating === tpl.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              )}
              <span className="text-2xl">{tpl.emoji}</span>
              <span className="text-xs font-semibold text-gray-800 leading-tight">{tpl.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight hidden group-hover:block">{tpl.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── المشاريع الأخيرة ── */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold tracking-tight">المشاريع الأخيرة</h2>
          <Link href="/projects" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            عرض الكل
          </Link>
        </div>

        {recentProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentProjects.map(project => (
              <Card key={project.id} className="overflow-hidden hover:border-primary/50 hover:shadow-md transition-all group flex flex-col">
                <div className="h-2 w-full" style={{ backgroundColor: project.coverColor || 'hsl(var(--primary))' }} />
                <CardHeader className="flex-1">
                  <CardTitle className="line-clamp-2 leading-tight">{project.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    {project.subject && (
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                        {project.subject}
                      </span>
                    )}
                    {project.category && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                        {project.category}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="pt-0 border-t bg-muted/20 px-6 py-3 flex justify-between items-center mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-muted-foreground">
                    {new Date(project.updatedAt).toLocaleDateString('ar-EG')}
                  </span>
                  <Link href={`/builder/${project.id}`}>
                    <Button variant="ghost" size="sm" className="h-8">فتح المحرر</Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center h-48 text-center">
              <BookPlus className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-foreground">لا توجد مشاريع بعد</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                اضغط على أحد القوالب أعلاه أو أنشئ مشروعاً فارغاً.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => setIsCreateOpen(true)}>
                إنشاء مشروع
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
