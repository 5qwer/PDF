import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Plus, Trash2, GraduationCap, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

async function getCategories(): Promise<string[]> {
  const s = await db.settings.get('categories');
  if (!s) return [];
  try { return JSON.parse(s.value) as string[]; } catch { return []; }
}

async function saveCategories(list: string[]) {
  await db.settings.put({ key: 'categories', value: JSON.stringify(list) });
}

export default function Settings() {
  const { toast } = useToast();
  const categories = useLiveQuery(() => getCategories(), []) ?? [];
  const [newCat, setNewCat] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  const handleAdd = async () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      toast({ title: 'الفئة موجودة بالفعل', variant: 'destructive' });
      return;
    }
    await saveCategories([...categories, trimmed]);
    setNewCat('');
    toast({ title: `✅ تمت إضافة "${trimmed}"` });
  };

  const handleDelete = async (cat: string) => {
    if (!confirm(`حذف الفئة "${cat}"؟`)) return;
    await saveCategories(categories.filter(c => c !== cat));
    toast({ title: 'تم حذف الفئة' });
  };

  const handleEdit = async (idx: number) => {
    const trimmed = editVal.trim();
    if (!trimmed) return;
    const updated = [...categories];
    updated[idx] = trimmed;
    await saveCategories(updated);
    setEditIdx(null);
    setEditVal('');
    toast({ title: '✅ تم تعديل الفئة' });
  };

  const handleMoveUp = async (idx: number) => {
    if (idx === 0) return;
    const updated = [...categories];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    await saveCategories(updated);
  };

  const handleMoveDown = async (idx: number) => {
    if (idx === categories.length - 1) return;
    const updated = [...categories];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    await saveCategories(updated);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto w-full space-y-8" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">الإعدادات</h1>
        <p className="text-muted-foreground mt-1">ضبط إعدادات التطبيق وإدارة الفئات الدراسية.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            الفئات الدراسية
          </CardTitle>
          <CardDescription>
            أضف الصفوف أو الفئات التي تستخدمها لتصنيف المستندات والمشاريع
            (مثال: الصف الثالث الثانوي، الصف الأول الإعدادي).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new category */}
          <div className="flex gap-2">
            <Input
              dir="rtl"
              placeholder="اكتب اسم الفئة…"
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              className="flex-1"
            />
            <Button onClick={handleAdd} className="gap-1.5 shrink-0">
              <Plus className="w-4 h-4" />
              إضافة
            </Button>
          </div>

          {/* Categories list */}
          {categories.length === 0 ? (
            <div className="py-10 text-center border rounded-xl border-dashed bg-muted/10">
              <GraduationCap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">لا توجد فئات بعد. أضف أول فئة أعلاه.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:border-primary/30 transition-colors group"
                >
                  {editIdx === idx ? (
                    <>
                      <Input
                        dir="rtl"
                        autoFocus
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleEdit(idx);
                          if (e.key === 'Escape') { setEditIdx(null); setEditVal(''); }
                        }}
                        className="flex-1 h-8 text-sm"
                      />
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleEdit(idx)}>
                        <Save className="w-3 h-3" />حفظ
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => { setEditIdx(null); setEditVal(''); }}>
                        إلغاء
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{cat}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          className="w-6 h-6 rounded text-muted-foreground hover:text-primary hover:bg-muted disabled:opacity-30 flex items-center justify-center text-xs"
                          title="تحريك للأعلى"
                        >↑</button>
                        <button
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === categories.length - 1}
                          className="w-6 h-6 rounded text-muted-foreground hover:text-primary hover:bg-muted disabled:opacity-30 flex items-center justify-center text-xs"
                          title="تحريك للأسفل"
                        >↓</button>
                        <button
                          onClick={() => { setEditIdx(idx); setEditVal(cat); }}
                          className="w-6 h-6 rounded text-muted-foreground hover:text-primary hover:bg-muted flex items-center justify-center text-xs"
                          title="تعديل"
                        >✎</button>
                        <button
                          onClick={() => handleDelete(cat)}
                          className="w-6 h-6 rounded text-destructive hover:bg-destructive/10 flex items-center justify-center"
                          title="حذف"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
