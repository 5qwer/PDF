// ─── Page Designer Studio — كل الأنواع ───────────────────────────────────────

export type PageSize = 'A4' | 'A5' | 'B5' | 'Letter' | 'Legal' | 'Executive' | 'custom';
export type PageOrientation = 'portrait' | 'landscape';
export type PageUnit = 'mm' | 'cm' | 'inch' | 'px';
export type PageBackgroundType = 'blank' | 'lined' | 'grid' | 'dots' | 'geometric' | 'music' | 'drawing' | 'custom';

export interface PageMargins {
  top: number; bottom: number; left: number; right: number; linked: boolean;
}

export interface PageSettings {
  size: PageSize;
  customWidth?: number;
  customHeight?: number;
  unit: PageUnit;
  orientation: PageOrientation;
  margins: PageMargins;
  backgroundType: PageBackgroundType;
}

export const PAGE_SIZE_DIMS: Record<string, { w: number; h: number }> = {
  A4:        { w: 210, h: 297 },
  A5:        { w: 148, h: 210 },
  B5:        { w: 176, h: 250 },
  Letter:    { w: 216, h: 279 },
  Legal:     { w: 216, h: 356 },
  Executive: { w: 184, h: 267 },
};

// ─── Element types ─────────────────────────────────────────────────────────────

export type ElementType =
  | 'text' | 'heading' | 'subheading'
  | 'rect' | 'circle' | 'triangle' | 'star'
  | 'line' | 'arrow'
  | 'pen'
  | 'image'
  | 'table'
  | 'sticker' | 'frame' | 'stamp'
  | 'dynamic-field'
  | 'smart-zone'
  | 'deco-frame';

export interface BaseElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;       // % of page width
  y: number;       // % of page height
  width: number;   // % of page width
  height: number;  // % of page height
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  printable: boolean;
  zIndex: number;
  groupId?: string;
  version: number;
}

export interface TextElement extends BaseElement {
  type: 'text' | 'heading' | 'subheading';
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'right' | 'left' | 'center';
  color: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  lineHeight?: number;
  direction: 'rtl' | 'ltr';
  shadow?: boolean;
}

export interface ShapeElement extends BaseElement {
  type: 'rect' | 'circle' | 'triangle' | 'star';
  fill: string;
  stroke: string;
  strokeWidth: number;
  borderRadius?: number;
  shadow?: boolean;
  gradient?: { type: 'linear' | 'radial'; color1: string; color2: string; angle?: number };
}

export interface LineElement extends BaseElement {
  type: 'line' | 'arrow';
  stroke: string;
  strokeWidth: number;
  strokeDash?: boolean;
  arrowStart?: boolean;
  arrowEnd?: boolean;
}

export interface PenElement extends BaseElement {
  type: 'pen';
  points: Array<{ x: number; y: number }>;
  stroke: string;
  strokeWidth: number;
  smooth?: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  objectFit: 'cover' | 'contain' | 'fill';
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  borderRadius?: number;
  shadow?: boolean;
  removeBackground?: boolean;
}

export interface TableCell { content: string; bold?: boolean; align?: 'right' | 'left' | 'center'; bg?: string; color?: string; }

export interface TableElement extends BaseElement {
  type: 'table';
  rows: number;
  cols: number;
  hasHeader: boolean;
  cells: TableCell[][];
  headerBg: string;
  cellBg: string;
  borderColor: string;
  headerTextColor: string;
  cellTextColor: string;
  fontSize: number;
  direction: 'rtl' | 'ltr';
}

export interface StickerElement extends BaseElement {
  type: 'sticker' | 'frame' | 'stamp';
  stickerId: string;
  color: string;
  secondaryColor?: string;
  shadow?: boolean;
  glow?: boolean;
  glowColor?: string;
  text?: string;
  textColor?: string;
}

export interface DynamicFieldElement extends BaseElement {
  type: 'dynamic-field';
  fieldKey: string;
  fieldLabel: string;
  defaultValue: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  color: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  textAlign: 'right' | 'left' | 'center';
  direction: 'rtl' | 'ltr';
  padding?: number;
}

export type SmartZonePurpose = 'questions' | 'explanation' | 'images' | 'examples' | 'solution' | 'notes';

/** أنواع محتوى الحقول المسماة (روابط الحقل بمصدر بيانات المشروع) */
export type FieldFillType =
  // ── محتوى المشروع ─────────────────────────
  | 'questions'          // كل أسئلة المشروع بالتتابع
  | 'question-stem'      // نص/صورة السؤال رقم (fillSequence)
  | 'question-choices'   // اختيارات السؤال رقم (fillSequence)
  | 'question-answer'    // إجابة السؤال رقم (fillSequence)
  | 'question-number'    // رقم السؤال رقم (fillSequence)
  | 'exercise-title'     // عنوان تمارين/حل تدريبات
  // ── بيانات مشروع ──────────────────────────
  | 'main-title'         // العنوان الرئيسي للصفحة
  | 'subject'            // اسم المادة
  | 'unit'               // اسم الوحدة
  | 'lesson'             // اسم الدرس
  | 'chapter'            // اسم الباب
  | 'grade'              // الصف / المرحلة
  | 'student-name'       // اسم الطالب
  | 'teacher-name'       // اسم المدرس
  | 'score'              // الدرجة / الدرجات
  | 'date'               // التاريخ
  | 'page-number'        // رقم الصفحة
  | 'page-total'         // إجمالي الصفحات
  | 'notes'              // ملاحظات حرة
  | 'logo'               // شعار المؤسسة
  | 'custom';            // مخصص

/** خيارات ربط الحقول — للعرض في لوحة الخصائص */
export const FIELD_FILL_OPTIONS: Array<{ value: FieldFillType; label: string; category: string; needsSequence?: boolean }> = [
  { value: 'questions',        label: 'كل الأسئلة (تتابع)', category: 'أسئلة' },
  { value: 'question-stem',    label: 'نص السؤال رقم…',      category: 'أسئلة', needsSequence: true },
  { value: 'question-choices', label: 'اختيارات السؤال رقم…', category: 'أسئلة', needsSequence: true },
  { value: 'question-answer',  label: 'إجابة السؤال رقم…',    category: 'أسئلة', needsSequence: true },
  { value: 'question-number',  label: 'رقم السؤال رقم…',      category: 'أسئلة', needsSequence: true },
  { value: 'exercise-title',   label: 'عنوان التمارين (حل تدريبات)', category: 'عناوين' },
  { value: 'main-title',       label: 'العنوان الرئيسي',      category: 'عناوين' },
  { value: 'subject',          label: 'اسم المادة',           category: 'مشروع' },
  { value: 'unit',             label: 'اسم الوحدة',           category: 'مشروع' },
  { value: 'lesson',           label: 'اسم الدرس',            category: 'مشروع' },
  { value: 'chapter',          label: 'اسم الباب',            category: 'مشروع' },
  { value: 'grade',            label: 'الصف الدراسي',         category: 'مشروع' },
  { value: 'student-name',     label: 'اسم الطالب',           category: 'أشخاص' },
  { value: 'teacher-name',     label: 'اسم المدرس',           category: 'أشخاص' },
  { value: 'score',            label: 'الدرجة',                category: 'مشروع' },
  { value: 'date',             label: 'التاريخ',              category: 'صفحة' },
  { value: 'page-number',      label: 'رقم الصفحة',           category: 'صفحة' },
  { value: 'page-total',       label: 'إجمالي الصفحات',       category: 'صفحة' },
  { value: 'notes',            label: 'ملاحظات',              category: 'أخرى' },
  { value: 'logo',             label: 'شعار المؤسسة',         category: 'مؤسسة' },
  { value: 'custom',           label: 'مخصص',                 category: 'أخرى' },
];

/** زخرفة الحواف */
export type ZoneOrnament =
  | 'none'
  | 'corner-dots'      // نقاط زاوية
  | 'corner-brackets'  // أقواس زاوية
  | 'double-border'    // حد مزدوج
  | 'dashed-inner'     // حد داخلي منقط
  | 'islamic-corners'  // زخرفة إسلامية
  | 'leaf-corners'     // أوراق زاوية
  | 'star-corners';    // نجوم زاوية

/** نمط التعبئة الداخلية */
export interface ZonePattern {
  type: 'lines' | 'dots' | 'grid' | 'zigzag' | 'cross' | 'diagonal';
  color: string;
  opacity: number;   // 0-100
  size: number;      // 4-40
}

/** ترقيم تلقائي للأسئلة داخل المنطقة */
export type NumberingStyle =
  | 'none'          // بدون ترقيم
  | 'decimal'       // 1, 2, 3
  | 'arabic-indic'  // ١، ٢، ٣
  | 'arabic-letters'// أ، ب، ج
  | 'latin-lower'   // a, b, c
  | 'latin-upper'   // A, B, C
  | 'roman-lower'   // i, ii, iii
  | 'roman-upper';  // I, II, III

export interface SmartZoneElement extends BaseElement {
  type: 'smart-zone';
  purpose: SmartZonePurpose;
  allowedTypes: ElementType[];
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none';
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  label?: string;
  autoFill?: boolean;
  /** نمط ترقيم الأسئلة المُسقطة داخل هذه المنطقة */
  numberingStyle?: NumberingStyle;
  /** لاحقة بعد الرقم مثل ") " أو ". " */
  numberingSuffix?: string;
  /** قيمة بداية الترقيم */
  numberingStart?: number;

  // ── الخصائص المُطوَّرة للحقول المسماة ──────────────────────────────────
  /** اسم مخصص يُعطيه المستخدم للحقل */
  customName?: string;
  /** نوع المحتوى الذي يملأ هذا الحقل تلقائياً */
  fillContent?: FieldFillType;
  /** ترتيب الحقل عند ربطه بسؤال بعينه (1 = السؤال الأول) */
  fillSequence?: number;
  /** نص القيمة الافتراضية للحقل */
  fillDefault?: string;
  /** زوايا مدوّرة */
  borderRadius?: number;
  /** ظل */
  shadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  /** تدرج لوني للخلفية */
  gradient?: {
    enabled: boolean;
    color1: string;
    color2: string;
    angle: number;
    type: 'linear' | 'radial';
  };
  /** زخرفة الحواف */
  ornament?: ZoneOrnament;
  ornamentColor?: string;
  ornamentSize?: number;    // حجم الزخرفة (px)
  /** نمط داخلي */
  pattern?: ZonePattern;
  /** هل يظهر الحقل في جميع الصفحات أم الأولى فقط؟ */
  showOn?: 'all' | 'first' | 'last' | 'odd' | 'even';
}

// ─── Decorative Frame Element ──────────────────────────────────────────────────

export interface DecoFrameElement extends BaseElement {
  type: 'deco-frame';
  frameId: string;        // معرّف القالب، أو 'custom-image' للصور المرفوعة
  subject?: string;       // المادة الدراسية (تؤثر على الألوان الافتراضية)
  primaryColor: string;   // اللون الرئيسي
  secondaryColor: string; // اللون الثانوي
  accentColor: string;    // لون التمييز
  labelText?: string;     // نص داخل اللافتات
  imageSrc?: string;      // صورة مرفوعة كإطار مخصص (بدون خلفية)
}

export type DesignerElement =
  | TextElement | ShapeElement | LineElement | PenElement
  | ImageElement | TableElement | StickerElement
  | DynamicFieldElement | SmartZoneElement | DecoFrameElement;

// ─── Background ────────────────────────────────────────────────────────────────

export interface PageBackground {
  type: 'color' | 'gradient' | 'image' | 'pattern' | 'texture';
  color: string;
  gradient?: { color1: string; color2: string; angle: number; type: 'linear' | 'radial' };
  imageData?: string;
  patternType?: 'lines' | 'grid' | 'dots' | 'triangles' | 'hexagons' | 'music' | 'drawing';
  patternColor?: string;
  patternSize?: number;
  patternLineWidth?: number;
  opacity: number;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  applyToAll: boolean;
  repeat?: boolean;
  scale?: number;
}

export const DEFAULT_BACKGROUND: PageBackground = {
  type: 'color', color: '#ffffff',
  opacity: 100, brightness: 100, contrast: 100, saturation: 100, blur: 0, applyToAll: false,
};

// ─── Designer Page ─────────────────────────────────────────────────────────────

export interface DesignerPage {
  id: string;
  settings: PageSettings;
  elements: DesignerElement[];
  background: PageBackground;
}

// ─── Designer Template ─────────────────────────────────────────────────────────

export interface TemplateVersion {
  version: number;
  pages: DesignerPage[];
  savedAt: number;
}

export interface DesignerTemplate {
  id?: number;
  name: string;
  description: string;
  category: string;
  subject: string;
  keywords: string[];
  thumbnail?: string;
  pages: DesignerPage[];
  applyTo: 'all' | 'specific';
  linkedGrades?: string[];
  createdAt: number;
  updatedAt: number;
  currentVersion: number;
  versions: TemplateVersion[];
}

// ─── Designer Component ────────────────────────────────────────────────────────

export interface ComponentVersion {
  version: number;
  element: DesignerElement;
  savedAt: number;
}

export interface DesignerComponent {
  id?: number;
  name: string;
  description: string;
  category: string;
  componentType: string;
  element: DesignerElement;
  thumbnail?: string;
  usageCount: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  currentVersion: number;
  versions: ComponentVersion[];
}

// ─── Custom Sticker ────────────────────────────────────────────────────────────

export interface DesignerSticker {
  id?: number;
  name: string;
  svgData: string;
  category: string;
  defaultColor: string;
  tags: string[];
  createdAt: number;
}

// ─── Named Style ───────────────────────────────────────────────────────────────

export type StyleType = 'heading' | 'question' | 'notes' | 'table' | 'image' | 'custom';

export interface DesignerStyle {
  id?: number;
  name: string;
  type: StyleType;
  properties: Partial<DesignerElement>;
  linkedElements: string[];
  createdAt: number;
  updatedAt: number;
}

// ─── Tool types ────────────────────────────────────────────────────────────────

export type ToolType =
  | 'select' | 'move' | 'zoom' | 'crop'
  | 'text' | 'heading' | 'subheading'
  | 'line' | 'arrow'
  | 'rect' | 'circle' | 'triangle' | 'star'
  | 'pen' | 'curve'
  | 'table' | 'image' | 'icon' | 'sticker' | 'frame' | 'stamp'
  | 'dynamic-field' | 'smart-zone';

// ─── Dynamic fields ────────────────────────────────────────────────────────────

export const DYNAMIC_FIELDS = [
  { key: 'project.name',     label: 'اسم المشروع',       category: 'مشروع' },
  { key: 'project.subject',  label: 'اسم المادة',        category: 'مشروع' },
  { key: 'project.unit',     label: 'اسم الوحدة',        category: 'مشروع' },
  { key: 'project.lesson',   label: 'اسم الدرس',         category: 'مشروع' },
  { key: 'project.chapter',  label: 'عنوان الباب',       category: 'مشروع' },
  { key: 'project.teacher',  label: 'اسم المدرس',        category: 'أشخاص' },
  { key: 'project.student',  label: 'اسم الطالب',        category: 'أشخاص' },
  { key: 'project.grade',    label: 'الصف الدراسي',      category: 'مشروع' },
  { key: 'project.year',     label: 'العام الدراسي',     category: 'مشروع' },
  { key: 'project.semester', label: 'الفصل الدراسي',     category: 'مشروع' },
  { key: 'question.title',   label: 'عنوان السؤال',      category: 'سؤال' },
  { key: 'question.source',  label: 'مصدر السؤال',       category: 'سؤال' },
  { key: 'question.number',  label: 'رقم السؤال',        category: 'سؤال' },
  { key: 'question.score',   label: 'درجة السؤال',       category: 'سؤال' },
  { key: 'project.time',     label: 'الزمن',             category: 'مشروع' },
  { key: 'page.date',        label: 'التاريخ',           category: 'صفحة' },
  { key: 'page.number',      label: 'رقم الصفحة',        category: 'صفحة' },
  { key: 'page.total',       label: 'إجمالي الصفحات',    category: 'صفحة' },
  { key: 'school.logo',      label: 'شعار المؤسسة',      category: 'مؤسسة' },
] as const;

// ─── Smart zone purposes ───────────────────────────────────────────────────────

export const SMART_ZONE_DEFS: Record<SmartZonePurpose, { label: string; color: string; icon: string }> = {
  questions:   { label: 'منطقة الأسئلة',  color: '#dbeafe', icon: '❓' },
  explanation: { label: 'منطقة الشرح',    color: '#dcfce7', icon: '📖' },
  images:      { label: 'منطقة الصور',    color: '#fef9c3', icon: '🖼️' },
  examples:    { label: 'منطقة الأمثلة',  color: '#fce7f3', icon: '✏️' },
  solution:    { label: 'منطقة الحل',     color: '#f3e8ff', icon: '💡' },
  notes:       { label: 'منطقة الملاحظات', color: '#ffedd5', icon: '📝' },
};

// ─── Numbering helpers ─────────────────────────────────────────────────────────

const AR_INDIC = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
const AR_LETTERS = ['أ','ب','ج','د','هـ','و','ز','ح','ط','ي','ك','ل','م','ن','س','ع','ف','ص','ق','ر','ش','ت','ث','خ','ذ','ض','ظ','غ'];

function toArabicIndic(n: number): string {
  return String(n).split('').map(d => AR_INDIC[+d] ?? d).join('');
}
function toRoman(n: number): string {
  const map: Array<[number,string]> = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let out = '';
  for (const [v,s] of map) { while (n >= v) { out += s; n -= v; } }
  return out;
}

export function formatQuestionNumber(index: number, style: NumberingStyle | undefined, start = 1): string {
  const n = index + start;
  switch (style) {
    case 'none': return '';
    case 'arabic-indic': return toArabicIndic(n);
    case 'arabic-letters': return AR_LETTERS[(n - 1) % AR_LETTERS.length] ?? String(n);
    case 'latin-lower': return String.fromCharCode(97 + ((n - 1) % 26));
    case 'latin-upper': return String.fromCharCode(65 + ((n - 1) % 26));
    case 'roman-lower': return toRoman(n).toLowerCase();
    case 'roman-upper': return toRoman(n);
    case 'decimal':
    default: return String(n);
  }
}

// ─── Predefined stickers ───────────────────────────────────────────────────────

export interface StickerDef {
  id: string;
  label: string;
  category: string;
  svg: string;
  defaultColor: string;
}

export const PREDEFINED_STICKERS: StickerDef[] = [
  { id: 'important', label: 'مهم', category: 'تعليمية', defaultColor: '#ef4444',
    svg: `<svg viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="currentColor"/></svg>` },
  { id: 'attention', label: 'انتبه', category: 'تعليمية', defaultColor: '#f59e0b',
    svg: `<svg viewBox="0 0 100 100"><polygon points="50,5 95,90 5,90" fill="currentColor"/><text x="50" y="72" text-anchor="middle" font-size="40" fill="white" font-weight="bold">!</text></svg>` },
  { id: 'idea', label: 'فكرة', category: 'تعليمية', defaultColor: '#eab308',
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="35" r="28" fill="currentColor"/><rect x="38" y="62" width="24" height="6" rx="3" fill="currentColor"/><rect x="40" y="72" width="20" height="6" rx="3" fill="currentColor"/><rect x="42" y="82" width="16" height="6" rx="3" fill="currentColor"/></svg>` },
  { id: 'remember', label: 'تذكر', category: 'تعليمية', defaultColor: '#8b5cf6',
    svg: `<svg viewBox="0 0 100 100"><path d="M50,5 L60,30 H90 L67,48 L76,75 L50,58 L24,75 L33,48 L10,30 H40 Z" fill="currentColor"/></svg>` },
  { id: 'practice', label: 'تدريب', category: 'تعليمية', defaultColor: '#10b981',
    svg: `<svg viewBox="0 0 100 100"><rect x="5" y="42" width="35" height="16" rx="8" fill="currentColor"/><rect x="60" y="42" width="35" height="16" rx="8" fill="currentColor"/><rect x="37" y="38" width="26" height="24" rx="4" fill="currentColor"/></svg>` },
  { id: 'homework', label: 'واجب', category: 'تعليمية', defaultColor: '#3b82f6',
    svg: `<svg viewBox="0 0 100 100"><rect x="20" y="10" width="60" height="80" rx="5" fill="currentColor"/><line x1="30" y1="30" x2="70" y2="30" stroke="white" stroke-width="4"/><line x1="30" y1="45" x2="70" y2="45" stroke="white" stroke-width="4"/><line x1="30" y1="60" x2="55" y2="60" stroke="white" stroke-width="4"/></svg>` },
  { id: 'expected', label: 'سؤال متوقع', category: 'تعليمية', defaultColor: '#ec4899',
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="currentColor"/><text x="50" y="65" text-anchor="middle" font-size="50" fill="white" font-weight="bold">?</text></svg>` },
  { id: 'exam', label: 'امتحان', category: 'تعليمية', defaultColor: '#6366f1',
    svg: `<svg viewBox="0 0 100 100"><rect x="15" y="5" width="70" height="90" rx="5" fill="currentColor"/><rect x="25" y="20" width="50" height="8" rx="2" fill="white"/><rect x="25" y="35" width="50" height="8" rx="2" fill="white"/><rect x="25" y="50" width="30" height="8" rx="2" fill="white"/><circle cx="70" cy="70" r="15" fill="white"/><text x="70" y="75" text-anchor="middle" font-size="16" fill="currentColor" font-weight="bold">✓</text></svg>` },
  { id: 'pointer', label: 'يد تشير', category: 'أشكال', defaultColor: '#f59e0b',
    svg: `<svg viewBox="0 0 100 100"><path d="M30,80 C30,80 20,75 20,60 L20,40 C20,36 23,33 27,33 C31,33 34,36 34,40 L34,50 C34,50 36,48 40,48 C44,48 46,51 46,51 C46,51 48,49 52,49 C56,49 58,52 58,52 C58,52 60,50 64,50 C68,50 70,53 70,57 L70,67 C70,75 65,80 58,82 Z" fill="currentColor"/></svg>` },
  { id: 'arrow-right', label: 'سهم يمين', category: 'أسهم', defaultColor: '#64748b',
    svg: `<svg viewBox="0 0 100 100"><path d="M10,45 H70 L55,25 L75,50 L55,75 L70,55 H10 Z" fill="currentColor"/></svg>` },
  { id: 'star-5', label: 'نجمة', category: 'نجوم', defaultColor: '#fbbf24',
    svg: `<svg viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="currentColor"/></svg>` },
  { id: 'circle-badge', label: 'دائرة', category: 'دوائر', defaultColor: '#06b6d4',
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="currentColor"/></svg>` },
  { id: 'ribbon', label: 'شريط', category: 'تعليمية', defaultColor: '#a855f7',
    svg: `<svg viewBox="0 0 100 100"><path d="M10,10 H90 V60 L50,85 L10,60 Z" fill="currentColor"/></svg>` },
  { id: 'seal', label: 'ختم', category: 'أختام', defaultColor: '#dc2626',
    svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" stroke-width="3"/><text x="50" y="55" text-anchor="middle" font-size="14" fill="currentColor" font-weight="bold">ختم</text></svg>` },
];

// ─── Component type definitions ────────────────────────────────────────────────

export const COMPONENT_TYPES = [
  { id: 'main-heading',    label: 'عنوان رئيسي',     category: 'نصوص' },
  { id: 'sub-heading',     label: 'عنوان فرعي',       category: 'نصوص' },
  { id: 'question-box',    label: 'صندوق سؤال',       category: 'محتوى' },
  { id: 'explanation-box', label: 'صندوق شرح',        category: 'محتوى' },
  { id: 'notes-box',       label: 'صندوق ملاحظات',    category: 'محتوى' },
  { id: 'homework-box',    label: 'صندوق واجب',       category: 'محتوى' },
  { id: 'practice-box',    label: 'صندوق تدريب',      category: 'محتوى' },
  { id: 'image-frame',     label: 'إطار للصور',       category: 'إطارات' },
  { id: 'table-frame',     label: 'إطار للجداول',     category: 'إطارات' },
  { id: 'top-bar',         label: 'شريط علوي',        category: 'بنية' },
  { id: 'bottom-bar',      label: 'شريط سفلي',        category: 'بنية' },
  { id: 'page-header',     label: 'رأس الصفحة',       category: 'بنية' },
  { id: 'page-footer',     label: 'تذييل الصفحة',     category: 'بنية' },
  { id: 'logo',            label: 'شعار',             category: 'هوية' },
  { id: 'stamp',           label: 'ختم',              category: 'هوية' },
  { id: 'data-card',       label: 'بطاقة بيانات',     category: 'محتوى' },
  { id: 'signature-box',   label: 'مربع توقيع',       category: 'محتوى' },
  { id: 'custom',          label: 'مخصص',             category: 'أخرى' },
] as const;

// ─── Designer State ────────────────────────────────────────────────────────────

export interface DesignerState {
  pages: DesignerPage[];
  currentPageIndex: number;
  selectedIds: string[];
  activeTool: ToolType;
  zoom: number;
  panX: number;
  panY: number;
  showLayers: boolean;
  showProperties: boolean;
  showToolbar: boolean;
  showRulers: boolean;
  clipboard: DesignerElement[];
  history: DesignerPage[][];
  historyIndex: number;
  isDirty: boolean;
  savedTemplateId?: number;
  templateMeta: {
    name: string;
    description: string;
    category: string;
    subject: string;
    keywords: string[];
    applyTo: 'all' | 'specific';
    linkedGrades: string[];
  };
}

export type DesignerAction =
  | { type: 'SET_TOOL'; tool: ToolType }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAN'; x: number; y: number }
  | { type: 'SELECT'; ids: string[] }
  | { type: 'ADD_ELEMENT'; element: DesignerElement }
  | { type: 'UPDATE_ELEMENT'; id: string; changes: Partial<DesignerElement> }
  | { type: 'DELETE_ELEMENTS'; ids: string[] }
  | { type: 'REORDER_ELEMENT'; id: string; direction: 'up' | 'down' | 'top' | 'bottom' }
  | { type: 'GROUP_ELEMENTS'; ids: string[]; groupId: string }
  | { type: 'UNGROUP'; groupId: string }
  | { type: 'SET_BACKGROUND'; bg: Partial<PageBackground> }
  | { type: 'SET_PAGE_SETTINGS'; settings: Partial<PageSettings> }
  | { type: 'ADD_PAGE'; page: DesignerPage }
  | { type: 'DELETE_PAGE'; index: number }
  | { type: 'GO_TO_PAGE'; index: number }
  | { type: 'DUPLICATE_PAGE'; index: number }
  | { type: 'REORDER_PAGES'; from: number; to: number }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'PUSH_HISTORY' }
  | { type: 'COPY' }
  | { type: 'PASTE' }
  | { type: 'DUPLICATE_ELEMENTS'; ids: string[] }
  | { type: 'TOGGLE_LOCK'; ids: string[] }
  | { type: 'TOGGLE_VISIBLE'; ids: string[] }
  | { type: 'SET_META'; meta: Partial<DesignerState['templateMeta']> }
  | { type: 'TOGGLE_PANEL'; panel: 'layers' | 'properties' | 'toolbar' | 'rulers' }
  | { type: 'MARK_SAVED'; id: number }
  | { type: 'LOAD_TEMPLATE'; pages: DesignerPage[]; meta: Partial<DesignerState['templateMeta']>; id?: number }
  | { type: 'CLEAR'; settings: PageSettings };
