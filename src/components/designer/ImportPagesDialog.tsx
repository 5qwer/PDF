import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { DesignerTemplate } from '@/lib/designer-types';
import {
  Search, X, FileText, BookOpen, GraduationCap, Layers,
  Grid3x3, List, Filter, LayoutTemplate,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

// الصفوف الدراسية المتاحة
const GRADES = [
  'الصف الأول الابتدائي', 'الصف الثاني الابتدائي', 'الصف الثالث الابتدائي',
  'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي',
  'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي',
  'الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي',
];

// المواد الدراسية
const SUBJECTS = [
  'الرياضيات', 'اللغة العربية', 'العلوم', 'الفيزياء', 'الكيمياء', 'الأحياء',
  'التاريخ', 'الجغرافيا', 'اللغة الإنجليزية', 'الدراسات الاجتماعية',
  'التربية الدينية', 'الحاسب الآلي', 'التربية الفنية', 'التربية البدنية',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onOpen: (tpl: DesignerTemplate) => void;
  initialViewMode?: 'grid' | 'list';
  title?: string;
}

export default function ImportPagesDialog({
  open, onClose, onOpen,
  initialViewMode = 'grid',
  title = 'استيراد صفحات — مكتبة الصفحات',
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode);
  const [showFilters, setShowFilters] = useState(false);

  const templates = useLiveQuery(
    () => db.designerTemplates.orderBy('updatedAt').reverse().toArray(), []
  ) ?? [];

  // استخراج الصفوف والمواد المتوفرة في المكتبة
  const availableGrades = [...new Set(
    templates.flatMap(t => t.linkedGrades ?? []).filter(Boolean)
  )];
  const availableSubjects = [...new Set(
    templates.map(t => t.subject).filter(Boolean) as string[]
  )];

  const filtered = templates.filter(t => {
    const searchLower = searchTerm.trim().toLowerCase();
    const matchSearch = !searchLower ||
      t.name.toLowerCase().includes(searchLower) ||
      (t.description ?? '').toLowerCase().includes(searchLower) ||
      (t.subject ?? '').toLowerCase().includes(searchLower) ||
      (t.keywords ?? []).some(k => k.toLowerCase().includes(searchLower));
    const matchGrade = !filterGrade ||
      (t.linkedGrades ?? []).some(g => g === filterGrade) ||
      (t.category ?? '').includes(filterGrade);
    const matchSubject = !filterSubject ||
      (t.subject ?? '') === filterSubject;
    return matchSearch && matchGrade && matchSubject;
  });

  const hasActiveFilters = !!(searchTerm || filterGrade || filterSubject);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filtered.length} / {templates.length} صفحة
            </span>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`w-8 h-8 flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'hover:bg-muted'}`}
                title="عرض شبكي"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`w-8 h-8 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'hover:bg-muted'}`}
                title="عرض قائمة"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search + Filter bar */}
        <div className="px-6 py-3 border-b bg-muted/20 shrink-0 space-y-2">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="البحث بالاسم أو المادة أو الكلمات المفتاحية..."
                className="pr-9 h-9"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border text-sm transition-colors ${
                showFilters || filterGrade || filterSubject
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              الفلاتر
              {(filterGrade || filterSubject) && (
                <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                  {[filterGrade, filterSubject].filter(Boolean).length}
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => { setSearchTerm(''); setFilterGrade(''); setFilterSubject(''); }}
              >
                مسح الكل
              </Button>
            )}
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="flex gap-3 flex-wrap pt-1">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-muted-foreground shrink-0" />
                <select
                  className="border rounded-lg px-3 h-9 text-sm outline-none focus:ring-2 ring-primary/30 bg-background"
                  value={filterGrade}
                  onChange={e => setFilterGrade(e.target.value)}
                >
                  <option value="">كل الصفوف</option>
                  {/* Grades from library first */}
                  {availableGrades.length > 0 && (
                    <optgroup label="صفوف في مكتبتك">
                      {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="كل الصفوف">
                    {GRADES.filter(g => !availableGrades.includes(g)).map(g => <option key={g} value={g}>{g}</option>)}
                  </optgroup>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
                <select
                  className="border rounded-lg px-3 h-9 text-sm outline-none focus:ring-2 ring-primary/30 bg-background"
                  value={filterSubject}
                  onChange={e => setFilterSubject(e.target.value)}
                >
                  <option value="">كل المواد</option>
                  {availableSubjects.length > 0 && (
                    <optgroup label="مواد في مكتبتك">
                      {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="كل المواد">
                    {SUBJECTS.filter(s => !availableSubjects.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <LayoutTemplate className="w-16 h-16 mb-4 opacity-15" />
              <p className="font-semibold text-lg">لا توجد صفحات في المكتبة بعد</p>
              <p className="text-sm mt-1 text-center max-w-xs">
                أنشئ صفحات في مصمّم الصفحات واحفظها كقوالب لتظهر هنا
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Search className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-semibold">لا توجد صفحات مطابقة</p>
              <p className="text-sm mt-1">جرب تغيير كلمات البحث أو الفلاتر</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => { setSearchTerm(''); setFilterGrade(''); setFilterSubject(''); }}
              >
                مسح الفلاتر
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map(tpl => (
                <Card
                  key={tpl.id}
                  className="group hover:border-primary/60 hover:shadow-xl transition-all cursor-pointer overflow-hidden"
                  onClick={() => { onOpen(tpl); onClose(); }}
                >
                  <div className="h-32 bg-gradient-to-br from-muted/40 to-muted flex items-center justify-center overflow-hidden relative">
                    {tpl.thumbnail
                      ? <img
                          src={tpl.thumbnail}
                          alt={tpl.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      : <FileText className="w-10 h-10 text-muted-foreground/30" />
                    }
                    <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-primary text-xs font-bold px-3 py-1.5 rounded-full shadow">
                        فتح
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-2.5">
                    <p className="text-xs font-semibold truncate">{tpl.name}</p>
                    {tpl.subject && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{tpl.subject}</p>
                    )}
                    {(tpl.linkedGrades ?? []).length > 0 && (
                      <p className="text-[10px] text-primary/70 flex items-center gap-1 mt-0.5">
                        <GraduationCap className="w-3 h-3" />
                        {tpl.linkedGrades!.slice(0, 1).join(', ')}
                        {tpl.linkedGrades!.length > 1 && (
                          <span className="text-muted-foreground">+{tpl.linkedGrades!.length - 1}</span>
                        )}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* List view */
            <div className="space-y-1.5">
              {filtered.map(tpl => (
                <div
                  key={tpl.id}
                  className="group flex items-center gap-3 p-3 rounded-xl border hover:border-primary/40 hover:bg-muted/20 transition-all cursor-pointer"
                  onClick={() => { onOpen(tpl); onClose(); }}
                >
                  <div className="w-14 h-16 rounded-lg overflow-hidden shrink-0 border bg-muted">
                    {tpl.thumbnail
                      ? <img src={tpl.thumbnail} alt={tpl.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <FileText className="w-6 h-6 text-muted-foreground/40" />
                        </div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{tpl.name}</p>
                    {tpl.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{tpl.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {tpl.subject && (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          {tpl.subject}
                        </span>
                      )}
                      {(tpl.linkedGrades ?? []).map(g => (
                        <span key={g} className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                          <GraduationCap className="w-2.5 h-2.5" />{g}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {new Date(tpl.updatedAt).toLocaleDateString('ar-EG')}
                  </div>
                  <span className="text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    فتح ←
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex items-center justify-between shrink-0 bg-muted/10">
          <p className="text-xs text-muted-foreground">
            انقر على أي صفحة لفتحها في مصمّم الصفحات
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>إغلاق</Button>
        </div>
      </div>
    </div>
  );
}
