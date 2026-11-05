import Dexie, { Table } from 'dexie';

import type { NumberingStyle } from './designer-types';

/** Legacy short names kept for stored projects; formatQuestionNumber understands both. */
export type ProjectNumbering = NumberingStyle | 'arabic' | 'abjad';

export interface ProjectDesign {
  numbering: ProjectNumbering;               // نوع الترقيم
  numberingSuffix?: string;                  // لاحقة الرقم (مثلًا ") " أو ". ")
  numberingStart?: number;                   // قيمة بداية الترقيم (افتراضي 1)
  separator: 'dashed' | 'solid' | 'none';    // فاصل بين الأسئلة
  bgColor?: string;                          // معرّف الخلفية (white|cream|lined|grid|dots|emoji-*|…)
  fontSize: 'sm' | 'md' | 'lg';             // حجم الخط
  showHeader: boolean;                       // إظهار الترويسة
  twoColumn: boolean;                        // عمودين
  questionsPerPage?: number;                 // عدد الأسئلة المستهدف في الصفحة (0 = تلقائي)
  watermark?: string;                        // نص العلامة المائية
  watermarkOpacity?: number;                 // تعتيم العلامة المائية (5-40)
  /** ألوان موحّدة للصفحة — تُطبَّق على كل الأسئلة ما لم يكن للسؤال تنسيق خاص */
  pageTextColor?: string;                    // لون نص الأسئلة
  pageChoiceColor?: string;                  // لون حروف الاختيارات
  pageNumberColor?: string;                  // لون رقم السؤال
}

export const DEFAULT_DESIGN: ProjectDesign = {
  numbering: 'arabic',
  numberingSuffix: '',
  numberingStart: 1,
  separator: 'dashed',
  bgColor: 'white',
  fontSize: 'md',
  showHeader: true,
  twoColumn: false,
  questionsPerPage: 0,
};

// ─── Question Layout Types ─────────────────────────────────────────────────────

/**
 * عنصر نصي منفرد داخل السؤال، مستخرج من PDF.js مع إحداثياته وتنسيقه
 */
export interface LayoutTextItem {
  str: string;
  /** x كنسبة مئوية من عرض منطقة السؤال (0-100) */
  xPct: number;
  /** y كنسبة مئوية من ارتفاع منطقة السؤال (0-100) */
  yPct: number;
  /** حجم الخط بالنقطة (pt) */
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontFamily?: string;
  color?: string;
  dir?: 'rtl' | 'ltr';
  /** عرض النص كنسبة مئوية من عرض منطقة السؤال */
  widthPct?: number;
}

/**
 * سطر منطقي (مجموعة من LayoutTextItem تقع على نفس خط y تقريباً)
 */
export interface LayoutLine {
  /** نوع السطر — تحدده خوارزمية التحليل */
  type:
    | 'question-number'  // رقم السؤال مستقل
    | 'question-stem'    // جذر السؤال (بخط عريض عادةً)
    | 'poem-verse'       // بيت شعري: شطران
    | 'poem-header'      // عنوان/نسبة قصيدة
    | 'choice'           // اختيار (أ ب ج د)
    | 'footnote'         // هامش / مصطلحات
    | 'text';            // فقرة عادية

  /** إحداثي y المرجعي للسطر (نسبة مئوية) */
  yPct: number;
  /** ارتفاع السطر (نسبة مئوية) */
  heightPct: number;
  /** حجم الخط الغالب في هذا السطر */
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontFamily?: string;

  // ── الحقول المحددة بحسب النوع ──────────────────────────────
  /** الرقم — لـ question-number */
  number?: string;
  /** صدر البيت — لـ poem-verse */
  sadr?: string;
  /** عجز البيت — لـ poem-verse */
  ajuz?: string;
  /** حرف الاختيار — لـ choice */
  letter?: string;
  /** النص الكامل للسطر */
  text?: string;

  /** العناصر الخام (للاستخدام المتقدم) */
  rawItems?: LayoutTextItem[];
}

/**
 * التخطيط الكامل للسؤال — يُخزَّن بدلاً من النص الخام
 */
export interface QuestionLayout {
  version: 1;
  lines: LayoutLine[];
  /** نسبة العرض إلى الارتفاع للمنطقة الأصلية */
  aspectRatio: number;
  /** اتجاه الكتابة */
  direction: 'rtl' | 'ltr';
  /** حجم الخط الأساسي (الأكثر تكراراً) بالنقطة */
  baseFontSize: number;
  /** الخط الأساسي */
  baseFont?: string;
  /** عرض المنطقة الأصلية بالبكسل (عند التقاط) */
  originalPixelWidth: number;
  /** ارتفاع المنطقة الأصلية بالبكسل (عند الالتقاط) */
  originalPixelHeight: number;
}

/**
 * خصائص تنسيق السؤال القابلة للتخصيص من قِبَل المستخدم
 */
export interface QuestionStyle {
  /** وضع العرض */
  mode: 'layout' | 'editable';
  /** مضاعف حجم الخط (1 = بدون تغيير) */
  fontScale?: number;
  /** لون النص الرئيسي */
  textColor?: string;
  /** لون رقم السؤال */
  numberColor?: string;
  /** لون الاختيارات */
  choiceColor?: string;
  /** لون الخلفية */
  bgColor?: string;
  /** لون الحدود */
  borderColor?: string;
  /** نصف قطر الزوايا */
  borderRadius?: number;
  /** حجم الحدود */
  borderWidth?: number;
  /** الهوامش الداخلية */
  padding?: number;
  /** ظل */
  shadow?: boolean;
  /** تباعد الأسطر */
  lineSpacing?: number;
  /** إظهار رقم السؤال */
  showNumber?: boolean;
}

export const DEFAULT_QUESTION_STYLE: QuestionStyle = {
  mode: 'layout',
  fontScale: 1,
  showNumber: true,
};

// ─── Database Tables ───────────────────────────────────────────────────────────

export interface LocalDocument {
  id?: number;
  name: string;
  size: number;
  pageCount: number;
  fileData: ArrayBuffer;
  subject?: string;
  /** الفئة الدراسية (مثال: الصف الثالث الثانوي) */
  category?: string;
  createdAt: number;
  /** Local-only document intelligence fingerprint (phases 8–10). */
  analysisProfile?: {
    version: 1;
    analyzedAt: number;
    medianFontSize?: number;
    medianQuestionHeightPct?: number;
    medianGapPct?: number;
    numberingPattern?: string;
    columns?: number;
    detectedQuestionCount?: number;
    confidence?: number;
  };
  training?: {
    questionHeightPct: number;
    questionGapPct: number;
    /** xPct/wPct: موضع وعرض المربع المُدرَّب ليُستخدم في الكشف التلقائي */
    samples: Array<{ yPct: number; hPct: number; xPct?: number; wPct?: number }>;
  };
}

export interface LocalProject {
  id?: number;
  title: string;
  subject?: string;
  /** الفئة الدراسية (مثال: الصف الثالث الثانوي) */
  category?: string;
  teacherName?: string;
  academyName?: string;
  coverColor?: string;
  pageCount?: number;
  design?: ProjectDesign;
  /** المستندات المحددة مسبقًا لهذا المشروع */
  allowedDocIds?: number[];
  /** قالب تصميم الصفحات المطبّق على هذا المشروع */
  pageTemplateId?: number;
  /** نطاق الصفحات التي يُطبَّق عليها القالب */
  pageTemplateRange?: 'all' | { from: number; to: number };
  createdAt: number;
  updatedAt: number;
}

export interface LocalQuestion {
  id?: number;
  contentType?: 'image' | 'text' | 'rich-layout';
  /** صورة JPEG مجمدة (للـ image mode) */
  imageData?: string;
  /** نص مسطح (للـ text mode — القديم) */
  textContent?: string;
  /** التخطيط المنظم (للـ rich-layout mode) */
  layoutData?: QuestionLayout;
  sourceDocId: number;
  sourceDocName: string;
  sourcePage: number;
  regionX: number;
  regionY: number;
  regionW: number;
  regionH: number;
  createdAt: number;
  /** هل أرسل المستخدم هذا السؤال إلى بنك الأسئلة؟ (افتراضياً لا) */
  inBank?: boolean;
  /** علامة "مرفوض" — يظهر بالأحمر في قائمة الالتقاطات ويمكن إعادته */
  rejected?: boolean;
}

export interface LocalProjectItem {
  id?: number;
  projectId: number;
  pageIndex: number;
  sortOrder: number;
  questionId?: number;
  contentType?: 'image' | 'text' | 'custom-text' | 'uploaded-image' | 'rich-layout';
  imageData?: string;
  textContent?: string;
  /** بيانات التخطيط الغنية */
  layoutData?: QuestionLayout;
  /** خصائص تنسيق السؤال المخصصة لهذا العنصر */
  questionStyle?: QuestionStyle;
  createdAt: number;
}

/** قالب مخزَّن للسؤال — يحفظ المستخدم تنسيق أي سؤال كقالب */
export interface LocalTemplate {
  id?: number;
  name: string;
  style: QuestionStyle;
  createdAt: number;
}

/** إعداد عام للتطبيق (مفتاح→قيمة JSON) */
export interface LocalSetting {
  key: string;
  value: string;
}

import type { DesignerTemplate, DesignerComponent, DesignerSticker, DesignerStyle } from './designer-types';

/** إطار زخرفي مستخرج من PDF/صورة ومخزَّن محلياً لإعادة الاستخدام */
export interface DesignerFrame {
  id?: number;
  name: string;
  imageSrc: string;         // PNG data URL بخلفية شفافة
  aspectRatio: number;      // width / height
  subject?: string;
  tags?: string[];
  createdAt: number;
}

class AppDatabase extends Dexie {
  documents!: Table<LocalDocument>;
  projects!: Table<LocalProject>;
  questions!: Table<LocalQuestion>;
  projectItems!: Table<LocalProjectItem>;
  templates!: Table<LocalTemplate>;
  settings!: Table<LocalSetting>;
  // ─── Page Designer Studio ──────────────────────────────
  designerTemplates!: Table<DesignerTemplate>;
  designerComponents!: Table<DesignerComponent>;
  designerStickers!: Table<DesignerSticker>;
  designerStyles!: Table<DesignerStyle>;
  designerFrames!: Table<DesignerFrame>;

  constructor() {
    super('pdf-builder-ar-db');
    this.version(1).stores({
      documents: '++id, name, createdAt',
      projects: '++id, title, updatedAt',
      questions: '++id, sourceDocId, createdAt',
      projectItems: '++id, projectId, pageIndex, sortOrder',
    });
    this.version(2).stores({
      documents: '++id, name, createdAt',
      projects: '++id, title, updatedAt',
      questions: '++id, sourceDocId, createdAt',
      projectItems: '++id, projectId, pageIndex, sortOrder',
    });
    this.version(3).stores({
      documents: '++id, name, createdAt',
      projects: '++id, title, updatedAt',
      questions: '++id, sourceDocId, createdAt',
      projectItems: '++id, projectId, pageIndex, sortOrder',
      templates: '++id, name, createdAt',
    });
    this.version(4).stores({
      documents: '++id, name, category, createdAt',
      projects: '++id, title, category, updatedAt',
      questions: '++id, sourceDocId, createdAt',
      projectItems: '++id, projectId, pageIndex, sortOrder',
      templates: '++id, name, createdAt',
      settings: 'key',
    });
    // النسخة 5: Page Designer Studio — قوالب، مكونات، ملصقات، أنماط
    this.version(5).stores({
      documents: '++id, name, category, createdAt',
      projects: '++id, title, category, updatedAt',
      questions: '++id, sourceDocId, createdAt',
      projectItems: '++id, projectId, pageIndex, sortOrder',
      templates: '++id, name, createdAt',
      settings: 'key',
      designerTemplates: '++id, name, category, subject, createdAt, updatedAt',
      designerComponents:  '++id, name, category, componentType, createdAt',
      designerStickers:    '++id, name, category, createdAt',
      designerStyles:      '++id, name, type, createdAt',
    });
    // النسخة 6: إضافة جدول الإطارات المستخرجة من PDF/صور
    this.version(6).stores({
      documents: '++id, name, category, createdAt',
      projects: '++id, title, category, updatedAt',
      questions: '++id, sourceDocId, createdAt',
      projectItems: '++id, projectId, pageIndex, sortOrder',
      templates: '++id, name, createdAt',
      settings: 'key',
      designerTemplates: '++id, name, category, subject, createdAt, updatedAt',
      designerComponents:  '++id, name, category, componentType, createdAt',
      designerStickers:    '++id, name, category, createdAt',
      designerStyles:      '++id, name, type, createdAt',
      designerFrames:      '++id, name, subject, createdAt',
    });
  }
}

export const db = new AppDatabase();
