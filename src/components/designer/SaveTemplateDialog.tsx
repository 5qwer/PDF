import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus } from 'lucide-react';

interface TemplateMeta {
  name: string; description: string; category: string; subject: string;
  keywords: string[]; applyTo: 'all' | 'specific'; linkedGrades: string[];
}

const CATEGORIES = ['ورق أسئلة', 'أوراق عمل', 'اختبارات', 'كتالوج', 'مراجعة', 'تقييم', 'نشاط', 'أخرى'];
const SUBJECTS = ['رياضيات', 'علوم', 'لغة عربية', 'لغة إنجليزية', 'دراسات اجتماعية', 'تربية إسلامية', 'كيمياء', 'فيزياء', 'أحياء', 'تاريخ', 'جغرافيا', 'أخرى'];
const GRADES = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (meta: TemplateMeta, asNew: boolean) => void;
  initialMeta?: Partial<TemplateMeta>;
  isSaved: boolean;
}

export default function SaveTemplateDialog({ open, onClose, onSave, initialMeta, isSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCat, setCustomCat] = useState('');
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState('');
  const [applyTo, setApplyTo] = useState<'all' | 'specific'>('all');
  const [linkedGrades, setLinkedGrades] = useState<string[]>([]);
  const [asNew, setAsNew] = useState(false);

  useEffect(() => {
    if (open && initialMeta) {
      setName(initialMeta.name ?? '');
      setDescription(initialMeta.description ?? '');
      setCategory(initialMeta.category ?? '');
      setSubject(initialMeta.subject ?? '');
      setKeywords(initialMeta.keywords ?? []);
      setApplyTo(initialMeta.applyTo ?? 'all');
      setLinkedGrades(initialMeta.linkedGrades ?? []);
    }
  }, [open, initialMeta]);

  const addKeyword = () => {
    const kw = kwInput.trim();
    if (kw && !keywords.includes(kw)) { setKeywords(p => [...p, kw]); setKwInput(''); }
  };

  const toggleGrade = (g: string) =>
    setLinkedGrades(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g]);

  const finalCat = category === 'أخرى' ? customCat : category;
  const finalSubject = subject === 'أخرى' ? customSubject : subject;

  const handleSave = () => {
    onSave({ name: name.trim(), description: description.trim(), category: finalCat, subject: finalSubject, keywords, applyTo, linkedGrades }, asNew);
    onClose();
  };

  const valid = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>حفظ القالب</DialogTitle></DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1">
            <Label>اسم القالب *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: ورقة أسئلة رياضيات" />
          </div>

          <div className="space-y-1">
            <Label>وصف القالب</Label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm resize-none h-20 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="وصف مختصر عن استخدام هذا القالب..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>الفئة</Label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">اختر الفئة</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {category === 'أخرى' && (
                <Input value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="اكتب الفئة..." className="mt-1" />
              )}
            </div>

            <div className="space-y-1">
              <Label>المادة الدراسية</Label>
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">اختر المادة</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {subject === 'أخرى' && (
                <Input value={customSubject} onChange={e => setCustomSubject(e.target.value)} placeholder="اكتب المادة..." className="mt-1" />
              )}
            </div>
          </div>

          {/* Keywords */}
          <div className="space-y-1">
            <Label>الكلمات المفتاحية</Label>
            <div className="flex gap-2">
              <Input value={kwInput} onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                placeholder="اكتب وضغط Enter أو زر الإضافة" className="flex-1" />
              <Button size="sm" variant="outline" onClick={addKeyword} type="button">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {keywords.map(kw => (
                  <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {kw}
                    <button onClick={() => setKeywords(p => p.filter(k => k !== kw))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Grades */}
          <div className="space-y-2">
            <Label>ربط بالصفوف الدراسية</Label>
            <div className="flex flex-wrap gap-1.5">
              {GRADES.map(g => (
                <button key={g} onClick={() => toggleGrade(g)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${linkedGrades.includes(g) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Apply to */}
          <div className="space-y-2">
            <Label>تطبيق على</Label>
            <div className="flex gap-3">
              {[{ v: 'all', l: 'جميع الصفحات' }, { v: 'specific', l: 'صفحة محددة' }].map(opt => (
                <label key={opt.v} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value={opt.v} checked={applyTo === opt.v} onChange={() => setApplyTo(opt.v as any)} className="accent-primary" />
                  {opt.l}
                </label>
              ))}
            </div>
          </div>

          {/* New version? */}
          {isSaved && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm space-y-2">
              <p className="font-medium text-amber-800">هذا القالب محفوظ مسبقاً. كيف تريد الحفظ؟</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={!asNew} onChange={() => setAsNew(false)} className="accent-primary" />
                  <span>تحديث القالب الحالي (إصدار جديد)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={asNew} onChange={() => setAsNew(true)} className="accent-primary" />
                  <span>حفظ كقالب جديد</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={!valid}>حفظ القالب</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
