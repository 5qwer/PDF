import React, { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Search, HelpCircle, Trash2, FileText, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

async function getCategories(): Promise<string[]> {
  const s = await db.settings.get('categories');
  if (!s) return [];
  try { return JSON.parse(s.value) as string[]; } catch { return []; }
}

export default function Questions() {
  const { toast } = useToast();
  const questions = useLiveQuery(
    () => db.questions.orderBy("createdAt").reverse().filter(q => q.inBank === true).toArray(),
    []
  );
  const documents = useLiveQuery(() => db.documents.toArray(), []);
  const categories = useLiveQuery(() => getCategories(), []) ?? [];

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا السؤال؟")) return;
    await db.questions.delete(id);
    toast({ title: "تم حذف السؤال" });
  };

  // Map docId → category
  const docCatMap = useMemo(() => {
    const m = new Map<number, string | undefined>();
    (documents ?? []).forEach(d => m.set(d.id!, d.category));
    return m;
  }, [documents]);

  const filteredQuestions = (questions ?? []).filter(q => {
    const matchSearch = q.sourceDocName.toLowerCase().includes(searchTerm.toLowerCase());
    const cat = docCatMap.get(q.sourceDocId);
    const matchCat = filterCat === 'all' || cat === filterCat ||
      (filterCat === '__none__' && !cat);
    return matchSearch && matchCat;
  });

  // Categories that actually appear in questions
  const usedCats = [...new Set(
    (questions ?? []).map(q => docCatMap.get(q.sourceDocId)).filter(Boolean)
  )] as string[];
  const allCats = [...new Set([...categories, ...usedCats])];

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">بنك الأسئلة</h1>
          <p className="text-muted-foreground mt-1">الأسئلة المُلتقطة من مستنداتك يمكن إعادة استخدامها في أي مشروع.</p>
        </div>
      </div>

      <div className="relative w-full sm:w-96">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث باسم المستند..."
          className="pr-9 bg-background"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Category filter dropdown */}
      {allCats.length > 0 && (
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            dir="rtl"
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:ring-2 ring-primary/30 outline-none"
          >
            <option value="all">الكل</option>
            {allCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            {usedCats.some(c => !c) && <option value="__none__">غير مصنف</option>}
          </select>
        </div>
      )}

      {questions === undefined ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filteredQuestions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuestions.map(question => {
            const cat = docCatMap.get(question.sourceDocId);
            return (
              <Card key={question.id} className="hover:border-primary/30 transition-colors flex flex-col overflow-hidden">
                <CardHeader className="py-2 px-4 border-b bg-muted/10 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                    <FileText className="w-3 h-3 shrink-0" />
                    <span className="truncate">{question.sourceDocName}</span>
                    <span className="shrink-0">— ص{question.sourcePage}</span>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => handleDelete(question.id!)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  {question.imageData ? (
                    <img
                      src={question.imageData}
                      alt="سؤال ملتقط"
                      className="w-full object-contain bg-white"
                      style={{ maxHeight: 200, objectPosition: 'top' }}
                    />
                  ) : (
                    <div className="p-3 text-xs text-gray-700 leading-relaxed line-clamp-5 text-right" dir="rtl">
                      {question.textContent || question.layoutData?.lines.map(l => l.text ?? l.sadr ?? l.number ?? '').join(' ')}
                    </div>
                  )}
                </CardContent>
                <div className="px-3 py-1.5 text-xs text-muted-foreground border-t bg-muted/5 flex items-center justify-between gap-2">
                  <span>{new Date(question.createdAt).toLocaleDateString('ar-EG')}</span>
                  {cat && (
                    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium text-[10px]">
                      <Tag className="w-2 h-2" />{cat}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center flex flex-col items-center border rounded-xl border-dashed bg-muted/5">
          <HelpCircle className="w-16 h-16 text-muted-foreground opacity-20 mb-4" />
          <h3 className="text-xl font-medium">لا توجد أسئلة بعد</h3>
          <p className="text-muted-foreground mt-2 max-w-md">
            {searchTerm || filterCat !== 'all'
              ? "جرّب تعديل كلمات البحث أو تغيير الفئة."
              : "التقط الأسئلة من مستنداتك في المحرر لحفظها هنا."}
          </p>
        </div>
      )}
    </div>
  );
}
