import React, { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { analyzeDocument } from "@/lib/auto-analyzer";
import { UploadCloud, FileText, Trash2, Search, Loader2, Calendar, FileBox, Brain, Image as ImageIcon, X, Tag, ScanSearch } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// نقبل جميع الملفات بلا استثناء — المستخدم يعرف ما يرفعه
const ACCEPTED_EXT = "*";

const IMAGE_EXTS = new Set(["jpg","jpeg","png","webp","gif","tiff","tif","bmp","svg","avif","heic","heif"]);
const PDF_EXTS   = new Set(["pdf"]);

function detectFileType(file: File): "pdf" | "image" | "other" {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (file.type.startsWith("image/") || IMAGE_EXTS.has(ext)) return "image";
  if (file.type === "application/pdf" || PDF_EXTS.has(ext)) return "pdf";
  // بعض الأنظمة ترسل PDF بنوع application/octet-stream — نعتمد على الامتداد
  return "pdf"; // نفترض PDF لأي ملف غير معروف
}

async function getCategories(): Promise<string[]> {
  const s = await db.settings.get('categories');
  if (!s) return [];
  try { return JSON.parse(s.value) as string[]; } catch { return []; }
}

export default function Documents() {
  const { toast } = useToast();
  const documents = useLiveQuery(() => db.documents.orderBy("createdAt").reverse().toArray(), []);
  const categories = useLiveQuery(() => getCategories(), []) ?? [];

  const [searchTerm, setSearchTerm]       = useState("");
  const [filterCat, setFilterCat]         = useState<string>("all");
  const [isDragging, setIsDragging]       = useState(false);
  const [isUploading, setIsUploading]     = useState(false);
  const [analyzingIds, setAnalyzingIds]   = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // تحليل تلقائي للمستندات القديمة التي لم تُحلَّل بعد
  React.useEffect(() => {
    if (!documents) return;
    const unanalyzed = documents.filter(
      d => d.analysisProfile?.version !== 1 && (d as any).fileType !== "image" && d.id
    );
    if (unanalyzed.length === 0) return;

    setAnalyzingIds(prev => {
      const next = new Set(prev);
      unanalyzed.forEach(d => next.add(d.id!));
      return next;
    });

    unanalyzed.forEach(doc => {
      analyzeDocument(doc.id!)
        .then(ok => {
          setAnalyzingIds(prev => {
            const next = new Set(prev);
            next.delete(doc.id!);
            return next;
          });
          if (ok) toast({ title: `🧠 تحليل "${doc.name}"`, description: "جاهز للكشف التلقائي." });
        })
        .catch(() => {
          setAnalyzingIds(prev => { const n = new Set(prev); n.delete(doc.id!); return n; });
        });
    });
  // نريد التشغيل مرة واحدة فقط عند تحميل المستندات لأول مرة
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents?.length]);

  // Upload dialog state
  const [dialogFile, setDialogFile]       = useState<File | null>(null);
  const [dialogName, setDialogName]       = useState("");
  const [dialogCategory, setDialogCategory] = useState("");

  const estimatePageCount = (byteSize: number) => Math.max(1, Math.round(byteSize / 51200));

  const openDialog = (file: File) => {
    setDialogFile(file);
    setDialogName(file.name.replace(/\.[^.]+$/, ""));
    setDialogCategory(categories[0] ?? "");
  };

  const commitUpload = async () => {
    if (!dialogFile) return;
    const file = dialogFile;
    setDialogFile(null);
    setIsUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const detectedType = detectFileType(file);
      const isImg = detectedType === "image";
      const fileType: "pdf" | "image" = isImg ? "image" : "pdf";
      const pageCount = isImg ? 1 : estimatePageCount(file.size);
      const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
      const baseName = dialogName.trim() || file.name.replace(/\.[^.]+$/, "");
      const finalName = baseName + ext;

      const newId = await (db.documents as any).add({
        name: finalName,
        size: file.size,
        pageCount,
        fileData: arrayBuffer,
        fileType,
        category: dialogCategory || undefined,
        subject: "غير مصنف",
        createdAt: Date.now(),
      });
      toast({ title: "تم الرفع بنجاح", description: `تم إضافة "${finalName}" إلى مكتبتك.` });

      // تحليل تلقائي في الخلفية — يفهم بنية PDF ويحفظ التدريب فوراً
      if (!isImg && typeof newId === 'number') {
        analyzeDocument(newId)
          .then(ok => {
            if (ok) toast({ title: "🧠 تحليل تلقائي اكتمل", description: `"${finalName}" جاهز للكشف التلقائي عن الأسئلة.` });
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error(err);
      toast({ title: "فشل الرفع", description: "حدث خطأ أثناء رفع الملف.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // نقبل الملف مباشرةً دون أي تحقق — جميع الصيغ مقبولة
  const processFile = (file: File) => openDialog(file);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(f => processFile(f));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(f => processFile(f));
    e.target.value = "";
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا المستند؟")) return;
    await db.documents.delete(id);
    await db.questions.where("sourceDocId").equals(id).delete();
    toast({ title: "تم حذف المستند" });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  const filteredDocs = (documents ?? []).filter(d => {
    const matchSearch =
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = filterCat === "all" || d.category === filterCat ||
      (filterCat === "__none__" && !d.category);
    return matchSearch && matchCat;
  });

  const allDocCats = [...new Set((documents ?? []).map(d => d.category).filter(Boolean))] as string[];

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">المستندات المصدر</h1>
        <p className="text-muted-foreground mt-1">
          ارفع ملفات PDF أو صور لاستخراج الأسئلة منها. <strong>جميع الصيغ مدعومة.</strong>
        </p>
      </div>

      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
      >
        {/* قبول جميع الملفات */}
        <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
        <div className="flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            {isUploading
              ? <Loader2 className="w-8 h-8 text-primary animate-spin" />
              : <UploadCloud className="w-8 h-8 text-primary" />}
          </div>
          <h3 className="text-xl font-medium mb-1">
            {isUploading ? "جاري رفع الملف..." : "اسحب وأفلت أي ملف هنا"}
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-2">
            يدعم <strong>PDF</strong> والصور وجميع الصيغ الأخرى.
          </p>
          <p className="text-muted-foreground text-xs mb-6">حفظ محلي — لا حدود للحجم</p>
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-8 shadow-sm">
            اختر ملفات
          </Button>
        </div>
      </div>

      {/* Library */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-semibold">مكتبتك</h2>
          <div className="relative w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث في المستندات..." className="pr-9 h-9 text-sm"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* Category filter pills */}
        {(categories.length > 0 || allDocCats.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
            {["all", ...[...new Set([...categories, ...allDocCats])], "__none__"].map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filterCat === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}>
                {cat === "all" ? "الكل" : cat === "__none__" ? "غير مصنف" : cat}
              </button>
            ))}
          </div>
        )}

        {documents === undefined ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : filteredDocs.length > 0 ? (
          <div className="space-y-3">
            {filteredDocs.map(doc => {
              const isImg = (doc as any).fileType === "image";
              const isAnalyzing = doc.id ? analyzingIds.has(doc.id) : false;
              return (
                    <Card key={doc.id} className={`transition-all ${
                      (doc.training || doc.analysisProfile)
                        ? "hover:border-green-400/50 border-green-200/60 dark:border-green-800/40 bg-green-50/30 dark:bg-green-950/10"
                        : isAnalyzing
                          ? "border-amber-200/60 dark:border-amber-800/40 bg-amber-50/20 dark:bg-amber-950/10"
                          : "hover:border-primary/30"
                    }`}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* أيقونة المستند مع شارة التحليل */}
                          <div className="relative shrink-0">
                            <div className={`w-12 h-12 rounded flex items-center justify-center ${
                              isImg
                                ? "bg-purple-100 dark:bg-purple-900/20"
                                 : (doc.training || doc.analysisProfile)
                                  ? "bg-green-100 dark:bg-green-900/20"
                                  : "bg-red-100 dark:bg-red-900/20"
                            }`}>
                              {isImg
                                ? <ImageIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                : <FileBox className={`w-6 h-6 ${(doc.training || doc.analysisProfile) ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} />
                              }
                            </div>

                            {/* شارة المخ الخضراء — تدريب مكتمل */}
                            {(doc.training || doc.analysisProfile) && (
                              <div
                                title="تم التحليل الذكي — جاهز للكشف التلقائي عن الأسئلة"
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-md ring-2 ring-background animate-none"
                              >
                                <Brain className="w-3 h-3 text-white" />
                              </div>
                            )}

                            {/* مؤشر تحليل جارٍ */}
                            {isAnalyzing && !doc.training && !doc.analysisProfile && (
                              <div
                                title="جارٍ التحليل الذكي..."
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow-md ring-2 ring-background"
                              >
                                <Loader2 className="w-3 h-3 text-white animate-spin" />
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium text-[15px]">{doc.name}</h4>
                              {(doc.training || doc.analysisProfile) && (
                                <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full font-semibold">
                                  <Brain className="w-3 h-3" /> مُحلَّل تلقائياً
                                </span>
                              )}
                              {isAnalyzing && !doc.training && !doc.analysisProfile && (
                                <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs px-2 py-0.5 rounded-full font-medium">
                                  <Loader2 className="w-3 h-3 animate-spin" /> جارٍ التحليل...
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" /> {doc.pageCount} صفحة{isImg ? "" : " (تقديرية)"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {new Date(doc.createdAt).toLocaleDateString("ar-EG")}
                              </span>
                              <span>{formatFileSize(doc.size)}</span>
                              {doc.category && (
                                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                  <Tag className="w-2.5 h-2.5" />{doc.category}
                                </span>
                              )}
                              {doc.training && (
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  ارتفاع السؤال ≈ {doc.training.questionHeightPct.toFixed(1)}٪
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!isImg && (
                            <Link href={`/analyzer/${doc.id}`}>
                              <Button variant="ghost" size="icon"
                                className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                                title="افتح المحلل الهندسي">
                                <ScanSearch className="w-4 h-4" />
                              </Button>
                            </Link>
                          )}
                          <Button variant="ghost" size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(doc.id!)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center border rounded-xl bg-muted/10 border-dashed">
            <p className="text-muted-foreground">
              {searchTerm || filterCat !== "all"
                ? "لا توجد مستندات تطابق بحثك."
                : "مكتبتك فارغة. ارفع ملف PDF أو صورة للبدء."}
            </p>
          </div>
        )}
      </div>

      {/* Upload dialog */}
      <Dialog open={!!dialogFile} onOpenChange={open => { if (!open) setDialogFile(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تفاصيل المستند</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="doc-name">اسم المستند</Label>
              <Input id="doc-name" dir="rtl" value={dialogName} onChange={e => setDialogName(e.target.value)}
                placeholder="اسم المستند..." autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-cat">الفئة الدراسية</Label>
              {categories.length > 0 ? (
                <select id="doc-cat" dir="rtl" value={dialogCategory} onChange={e => setDialogCategory(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:ring-2 ring-primary/30 outline-none">
                  <option value="">— بدون تصنيف —</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <div className="text-xs text-muted-foreground p-3 border rounded-md bg-muted/20">
                  لا توجد فئات محددة. أضف فئات في صفحة <strong>الإعدادات</strong> أولاً.
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFile(null)}>إلغاء</Button>
            <Button onClick={commitUpload}>رفع المستند</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
