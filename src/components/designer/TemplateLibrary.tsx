import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, FileText, Trash2, Download, Tag, ArrowRight, X } from 'lucide-react';
import type { DesignerTemplate } from '@/lib/designer-types';
import { useToast } from '@/hooks/use-toast';

export type ApplyScope = 'all' | 'range' | 'current';
export interface TemplateOpenOptions {
  scope: ApplyScope;
  fromPage?: number;   // 1-based, inclusive
  toPage?: number;     // 1-based, inclusive
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after the user picks a template AND chooses where to apply it. */
  onOpen: (tpl: DesignerTemplate, opts?: TemplateOpenOptions) => void;
  /** Total pages in the current project — enables the range/current options. */
  totalPages?: number;
  /** 1-based current page number, used as default for scope="current". */
  currentPage?: number;
}

export default function TemplateLibrary({ open, onClose, onOpen, totalPages, currentPage }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');

  // Scope-picker state — set when a user clicks a template.
  const [pending, setPending] = useState<DesignerTemplate | null>(null);
  const [scope, setScope] = useState<ApplyScope>('all');
  const [rangeFrom, setRangeFrom] = useState<number>(1);
  const [rangeTo, setRangeTo] = useState<number>(1);

  const templates = useLiveQuery(() =>
    db.designerTemplates.orderBy('updatedAt').reverse().toArray(), []
  ) ?? [];

  const cats = [...new Set(templates.map(t => t.category).filter(Boolean))] as string[];
  const subjects = [...new Set(templates.map(t => t.subject).filter(Boolean))] as string[];
  const grades = [...new Set(
    templates.flatMap(t => (t.linkedGrades ?? [])).filter(Boolean)
  )] as string[];

  const filtered = templates.filter(t => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q
      || t.name.toLowerCase().includes(q)
      || (t.description ?? '').toLowerCase().includes(q)
      || (t.keywords ?? []).some(k => k.toLowerCase().includes(q));
    const matchCat = filterCat === 'all' || t.category === filterCat;
    const matchSubj = filterSubject === 'all' || t.subject === filterSubject;
    const matchGrade = filterGrade === 'all' || (t.linkedGrades ?? []).includes(filterGrade);
    return matchSearch && matchCat && matchSubj && matchGrade;
  });

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('هل تريد حذف هذا القالب نهائياً؟')) return;
    await db.designerTemplates.delete(id);
    toast({ title: 'تم حذف القالب' });
  };

  const handleExport = (tpl: DesignerTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const data = JSON.stringify({
      meta: {
        name: tpl.name, description: tpl.description, category: tpl.category,
        subject: tpl.subject, keywords: tpl.keywords, applyTo: tpl.applyTo,
        linkedGrades: tpl.linkedGrades,
      },
      pages: tpl.pages,
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${tpl.name}.json`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'تم تصدير القالب' });
  };

  const pickTemplate = (tpl: DesignerTemplate) => {
    // If there's no active project (no page count), skip the scope picker
    // — the caller doesn't have anywhere meaningful to apply "current" or
    // "range" to, so just open the template as-is.
    if (!totalPages) {
      onOpen(tpl);
      onClose();
      return;
    }
    setScope('all');
    setRangeFrom(1);
    setRangeTo(totalPages);
    setPending(tpl);
  };

  const confirmScope = () => {
    if (!pending) return;
    const opts: TemplateOpenOptions = { scope };
    if (scope === 'range') {
      const from = Math.max(1, Math.min(totalPages ?? 1, rangeFrom));
      const to = Math.max(from, Math.min(totalPages ?? 1, rangeTo));
      opts.fromPage = from;
      opts.toPage = to;
    } else if (scope === 'current' && currentPage) {
      opts.fromPage = currentPage;
      opts.toPage = currentPage;
    }
    onOpen(pending, opts);
    setPending(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {pending ? `أين تُطبَّق: ${pending.name}؟` : `مكتبة القوالب (${templates.length})`}
          </DialogTitle>
        </DialogHeader>

        {pending ? (
          // ── Scope picker ───────────────────────────────────────────────────
          <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
            <div className="flex items-center gap-3 p-3 border rounded-xl bg-muted/20">
              {pending.thumbnail
                ? <img src={pending.thumbnail} alt="" className="w-16 h-16 object-cover rounded" />
                : <FileText className="w-8 h-8 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{pending.name}</p>
                {pending.description && (
                  <p className="text-xs text-muted-foreground truncate">{pending.description}</p>
                )}
              </div>
              <button onClick={() => setPending(null)}
                className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid gap-2">
              <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${scope === 'all' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                <input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} className="mt-1" />
                <div>
                  <p className="text-sm font-medium">لكل صفحات المشروع</p>
                  <p className="text-xs text-muted-foreground">يُستبدل تصميم كل صفحة بهذا القالب.</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${scope === 'range' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                <input type="radio" checked={scope === 'range'} onChange={() => setScope('range')} className="mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium">لصفحات محددة</p>
                  <p className="text-xs text-muted-foreground mb-2">اكتب من صفحة كم إلى كم (1–{totalPages}).</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">من</span>
                    <input type="number" min={1} max={totalPages} value={rangeFrom}
                      onChange={e => setRangeFrom(parseInt(e.target.value) || 1)}
                      disabled={scope !== 'range'}
                      className="w-16 border rounded px-2 py-1 text-center disabled:opacity-50" />
                    <span className="text-muted-foreground">إلى</span>
                    <input type="number" min={1} max={totalPages} value={rangeTo}
                      onChange={e => setRangeTo(parseInt(e.target.value) || 1)}
                      disabled={scope !== 'range'}
                      className="w-16 border rounded px-2 py-1 text-center disabled:opacity-50" />
                  </div>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${scope === 'current' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                <input type="radio" checked={scope === 'current'} onChange={() => setScope('current')} className="mt-1" />
                <div>
                  <p className="text-sm font-medium">للصفحة الحالية فقط{currentPage ? ` (صفحة ${currentPage})` : ''}</p>
                  <p className="text-xs text-muted-foreground">
                    يُطبَّق على الصفحة المفتوحة الآن دون غيرها.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => setPending(null)}>رجوع</Button>
              <Button onClick={confirmScope} className="gap-1">
                <ArrowRight className="w-4 h-4" /> تطبيق
              </Button>
            </div>
          </div>
        ) : (
          // ── Browser ────────────────────────────────────────────────────────
          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث بالاسم، الوصف، الوسوم..." className="pr-9 h-9"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {cats.length > 0 && (
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm bg-background">
                  <option value="all">كل الفئات</option>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {subjects.length > 0 && (
                <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm bg-background">
                  <option value="all">كل المواد</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {grades.length > 0 && (
                <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm bg-background">
                  <option value="all">كل المراحل</option>
                  {grades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  {search || filterCat !== 'all' || filterSubject !== 'all' || filterGrade !== 'all'
                    ? 'لا توجد نتائج مطابقة.'
                    : 'لا توجد قوالب محفوظة بعد.'}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filtered.map(tpl => (
                    <div key={tpl.id}
                      className="group border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => pickTemplate(tpl)}>
                      <div className="h-28 bg-gradient-to-br from-muted/40 to-muted flex items-center justify-center">
                        {tpl.thumbnail
                          ? <img src={tpl.thumbnail} alt={tpl.name} className="w-full h-full object-cover" />
                          : <FileText className="w-10 h-10 text-muted-foreground/40" />}
                      </div>
                      <div className="p-3 space-y-1">
                        <p className="font-semibold text-sm truncate">{tpl.name}</p>
                        {tpl.description && <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>}
                        <div className="flex flex-wrap gap-1">
                          {tpl.category && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                              <Tag className="w-2.5 h-2.5" />{tpl.category}
                            </span>
                          )}
                          {tpl.subject && (
                            <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground">{tpl.subject}</span>
                          )}
                          {(tpl.linkedGrades ?? []).slice(0, 2).map(g => (
                            <span key={g} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium">{g}</span>
                          ))}
                        </div>
                        <div className="flex justify-between items-center pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-muted-foreground">v{tpl.currentVersion}</span>
                          <div className="flex gap-1">
                            <button onClick={e => handleExport(tpl, e)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted">
                              <Download className="w-3 h-3" />
                            </button>
                            <button onClick={e => handleDelete(tpl.id!, e)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
