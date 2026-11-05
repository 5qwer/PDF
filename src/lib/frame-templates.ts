// ─── مكتبة إطارات الصفحات التعليمية ─────────────────────────────────────────
// كل إطار: دالة تأخذ الألوان وتُعيد نص SVG جاهز للعرض

export interface FrameColors {
  primary: string;    // اللون الرئيسي
  secondary: string;  // اللون الثانوي
  accent: string;     // لون التمييز
}

export interface FrameTemplate {
  id: string;
  name: string;
  nameAr: string;
  category: 'side-column' | 'full-border' | 'banner' | 'content-box';
  subjects: string[];  // 'all' | 'math' | 'science' | 'arabic' | 'english' | 'history' | 'computer' | 'religion'
  defaultColors: FrameColors;
  aspectRatio?: number;  // w/h للعنصر الافتراضي (banner = عريض، column = طويل)
  render: (colors: FrameColors, text?: string) => string;
}

// ─── الثيمات حسب المادة ────────────────────────────────────────────────────────

export const SUBJECT_THEMES: Record<string, { label: string; icon: string; colors: FrameColors }> = {
  all:      { label: 'كل المواد', icon: '📚', colors: { primary: '#1e3a5f', secondary: '#c9a84c', accent: '#e8d5a3' } },
  math:     { label: 'رياضيات',   icon: '📐', colors: { primary: '#1d4e7a', secondary: '#3b82f6', accent: '#bfdbfe' } },
  science:  { label: 'علوم',      icon: '🔬', colors: { primary: '#14532d', secondary: '#16a34a', accent: '#bbf7d0' } },
  physics:  { label: 'فيزياء',   icon: '⚛️', colors: { primary: '#1e1b4b', secondary: '#4f46e5', accent: '#c7d2fe' } },
  chemistry:{ label: 'كيمياء',   icon: '⚗️', colors: { primary: '#431407', secondary: '#ea580c', accent: '#fed7aa' } },
  arabic:   { label: 'عربي',      icon: '✒️', colors: { primary: '#6b3a0f', secondary: '#b45309', accent: '#fef3c7' } },
  religion: { label: 'دين',      icon: '☪️', colors: { primary: '#14532d', secondary: '#b45309', accent: '#fef3c7' } },
  english:  { label: 'إنجليزي',  icon: '🌍', colors: { primary: '#1e3a5f', secondary: '#0369a1', accent: '#e0f2fe' } },
  history:  { label: 'تاريخ',    icon: '🏛️', colors: { primary: '#450a0a', secondary: '#991b1b', accent: '#fecaca' } },
  geography:{ label: 'جغرافيا',  icon: '🗺️', colors: { primary: '#064e3b', secondary: '#059669', accent: '#d1fae5' } },
  computer: { label: 'حاسب',     icon: '💻', colors: { primary: '#111827', secondary: '#374151', accent: '#6ee7b7' } },
};

// ─── مساعدات SVG ──────────────────────────────────────────────────────────────

const hex2rgba = (hex: string, alpha = 1): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// ─── تعريف الإطارات ────────────────────────────────────────────────────────────

export const FRAME_TEMPLATES: FrameTemplate[] = [

  // ════════════════════════════════════
  // فئة: إطارات جانبية (Side Columns)
  // ════════════════════════════════════

  {
    id: 'math-chalkboard',
    name: 'Math Chalkboard',
    nameAr: 'سبورة الرياضيات',
    category: 'side-column',
    subjects: ['math'],
    aspectRatio: 400 / 560,
    defaultColors: SUBJECT_THEMES.math.colors,
    render: ({ primary, secondary }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" preserveAspectRatio="none">
  <defs>
    <linearGradient id="chalkL" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${primary}"/>
      <stop offset="100%" stop-color="${primary}dd"/>
    </linearGradient>
    <linearGradient id="chalkR" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${primary}dd"/>
      <stop offset="100%" stop-color="${primary}"/>
    </linearGradient>
  </defs>
  <!-- عمود أيسر -->
  <path d="M0,0 L72,0 Q62,40 70,80 Q78,120 64,160 Q52,200 68,240 Q76,280 62,320 Q50,360 66,400 Q74,440 60,480 Q50,520 68,560 L0,560 Z" fill="url(#chalkL)"/>
  <!-- رموز رياضيات - يسار -->
  <text x="8"  y="44"  fill="${secondary}55" font-family="serif" font-size="15" transform="rotate(-5,8,44)">∑</text>
  <text x="32" y="88"  fill="${secondary}40" font-family="serif" font-size="11">∫</text>
  <text x="10" y="132" fill="${secondary}45" font-family="serif" font-size="12">√x</text>
  <text x="30" y="178" fill="${secondary}35" font-family="serif" font-size="13">π</text>
  <text x="8"  y="224" fill="${secondary}40" font-family="serif" font-size="11">f(x)</text>
  <text x="28" y="268" fill="${secondary}35" font-family="serif" font-size="14">∞</text>
  <text x="10" y="314" fill="${secondary}40" font-family="serif" font-size="10">α+β</text>
  <text x="32" y="358" fill="${secondary}35" font-family="serif" font-size="11">∂</text>
  <text x="8"  y="402" fill="${secondary}40" font-family="serif" font-size="13">Δ</text>
  <text x="28" y="448" fill="${secondary}35" font-family="serif" font-size="11">x²</text>
  <text x="10" y="494" fill="${secondary}40" font-family="serif" font-size="12">∇</text>
  <text x="30" y="538" fill="${secondary}35" font-family="serif" font-size="10">θ</text>
  <!-- خطوط طباشير أفقية خفيفة - يسار -->
  <line x1="5"  y1="100" x2="55" y2="102" stroke="${secondary}20" stroke-width="1"/>
  <line x1="8"  y1="200" x2="52" y2="198" stroke="${secondary}20" stroke-width="1"/>
  <line x1="5"  y1="300" x2="58" y2="302" stroke="${secondary}15" stroke-width="1"/>
  <line x1="8"  y1="400" x2="52" y2="399" stroke="${secondary}20" stroke-width="1"/>
  <line x1="5"  y1="500" x2="56" y2="501" stroke="${secondary}15" stroke-width="1"/>
  <!-- عمود أيمن -->
  <path d="M400,0 L328,0 Q338,40 330,80 Q322,120 336,160 Q348,200 332,240 Q324,280 338,320 Q350,360 334,400 Q326,440 340,480 Q350,520 332,560 L400,560 Z" fill="url(#chalkR)"/>
  <!-- رموز رياضيات - يمين -->
  <text x="348" y="44"  fill="${secondary}55" font-family="serif" font-size="15">∑</text>
  <text x="360" y="90"  fill="${secondary}40" font-family="serif" font-size="11">∫</text>
  <text x="340" y="135" fill="${secondary}40" font-family="serif" font-size="10">dy/dx</text>
  <text x="360" y="180" fill="${secondary}35" font-family="serif" font-size="12">θ</text>
  <text x="345" y="225" fill="${secondary}40" font-family="serif" font-size="11">x²</text>
  <text x="358" y="270" fill="${secondary}35" font-family="serif" font-size="12">≤</text>
  <text x="344" y="316" fill="${secondary}40" font-family="serif" font-size="11">∈</text>
  <text x="360" y="360" fill="${secondary}35" font-family="serif" font-size="11">σ</text>
  <text x="342" y="405" fill="${secondary}40" font-family="serif" font-size="13">∓</text>
  <text x="358" y="450" fill="${secondary}35" font-family="serif" font-size="10">λ</text>
  <text x="344" y="495" fill="${secondary}40" font-family="serif" font-size="12">μ</text>
  <text x="360" y="538" fill="${secondary}35" font-family="serif" font-size="10">γ</text>
  <!-- خطوط طباشير - يمين -->
  <line x1="345" y1="100" x2="395" y2="98"  stroke="${secondary}20" stroke-width="1"/>
  <line x1="342" y1="200" x2="392" y2="202" stroke="${secondary}15" stroke-width="1"/>
  <line x1="345" y1="300" x2="392" y2="298" stroke="${secondary}20" stroke-width="1"/>
  <line x1="342" y1="400" x2="395" y2="401" stroke="${secondary}15" stroke-width="1"/>
  <line x1="345" y1="500" x2="392" y2="499" stroke="${secondary}20" stroke-width="1"/>
</svg>`,
  },

  {
    id: 'science-lab',
    name: 'Science Lab',
    nameAr: 'مختبر العلوم',
    category: 'side-column',
    subjects: ['science', 'physics', 'chemistry'],
    aspectRatio: 400 / 560,
    defaultColors: SUBJECT_THEMES.science.colors,
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" preserveAspectRatio="none">
  <defs>
    <linearGradient id="sciL" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${primary}"/>
      <stop offset="85%" stop-color="${primary}ee"/>
      <stop offset="100%" stop-color="${primary}88"/>
    </linearGradient>
    <linearGradient id="sciR" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${primary}88"/>
      <stop offset="15%" stop-color="${primary}ee"/>
      <stop offset="100%" stop-color="${primary}"/>
    </linearGradient>
  </defs>
  <!-- عمود أيسر -->
  <path d="M0,0 L70,0 Q68,70 70,140 Q68,210 70,280 Q68,350 70,420 Q68,490 70,560 L0,560 Z" fill="url(#sciL)"/>
  <!-- أنبوب اختبار - يسار -->
  <g transform="translate(12,30)">
    <rect x="15" y="0" width="20" height="40" rx="0" ry="0" fill="none" stroke="${secondary}80" stroke-width="1.5"/>
    <path d="M15,40 Q15,55 25,58 Q35,55 35,40" fill="${secondary}60" stroke="${secondary}80" stroke-width="1.5"/>
    <ellipse cx="25" cy="0" rx="10" ry="3" fill="none" stroke="${secondary}80" stroke-width="1.5"/>
    <rect x="10" y="-5" width="30" height="5" rx="2" fill="${secondary}60"/>
    <!-- سائل -->
    <path d="M16,38 Q16,52 25,55 Q34,52 34,38 Z" fill="${secondary}70"/>
    <!-- فقاعات -->
    <circle cx="22" cy="45" r="1.5" fill="${accent}90"/>
    <circle cx="28" cy="50" r="1"   fill="${accent}90"/>
  </g>
  <!-- ذرة -->
  <g transform="translate(8,110)">
    <circle cx="28" cy="28" r="5" fill="${secondary}80"/>
    <ellipse cx="28" cy="28" rx="24" ry="10" fill="none" stroke="${secondary}60" stroke-width="1.2"/>
    <ellipse cx="28" cy="28" rx="24" ry="10" fill="none" stroke="${secondary}60" stroke-width="1.2" transform="rotate(60,28,28)"/>
    <ellipse cx="28" cy="28" rx="24" ry="10" fill="none" stroke="${secondary}60" stroke-width="1.2" transform="rotate(120,28,28)"/>
    <circle cx="50" cy="20" r="3" fill="${accent}90"/>
    <circle cx="6"  cy="36" r="3" fill="${accent}90"/>
  </g>
  <!-- مجهر -->
  <g transform="translate(14,210)" opacity="0.5">
    <rect x="18" y="0"  width="8"  height="25" rx="1" fill="${secondary}"/>
    <rect x="10" y="22" width="24" height="6"  rx="2" fill="${secondary}"/>
    <ellipse cx="22" cy="8" rx="12" ry="8" fill="none" stroke="${secondary}" stroke-width="1.5"/>
    <rect x="8"  y="42" width="28" height="4" rx="1" fill="${secondary}"/>
    <rect x="14" y="46" width="16" height="20" rx="2" fill="${secondary}90"/>
  </g>
  <!-- رموز علمية -->
  <text x="8"  y="330" fill="${secondary}50" font-family="serif" font-size="18">⚗</text>
  <text x="18" y="380" fill="${secondary}40" font-family="serif" font-size="13">DNA</text>
  <text x="10" y="430" fill="${secondary}45" font-family="serif" font-size="16">☢</text>
  <text x="20" y="480" fill="${secondary}40" font-family="serif" font-size="12">H₂O</text>
  <text x="10" y="525" fill="${secondary}35" font-family="serif" font-size="13">E=mc²</text>
  <!-- عمود أيمن (معكوس) -->
  <path d="M400,0 L330,0 Q332,70 330,140 Q332,210 330,280 Q332,350 330,420 Q332,490 330,560 L400,560 Z" fill="url(#sciR)"/>
  <g transform="translate(345,30)">
    <rect x="15" y="0" width="20" height="40" rx="0" fill="none" stroke="${secondary}80" stroke-width="1.5"/>
    <path d="M15,40 Q15,55 25,58 Q35,55 35,40" fill="${secondary}60" stroke="${secondary}80" stroke-width="1.5"/>
    <ellipse cx="25" cy="0" rx="10" ry="3" fill="none" stroke="${secondary}80" stroke-width="1.5"/>
    <rect x="10" y="-5" width="30" height="5" rx="2" fill="${secondary}60"/>
    <path d="M16,38 Q16,52 25,55 Q34,52 34,38 Z" fill="${secondary}70"/>
    <circle cx="22" cy="45" r="1.5" fill="${accent}90"/>
    <circle cx="28" cy="50" r="1"   fill="${accent}90"/>
  </g>
  <g transform="translate(338,110)">
    <circle cx="28" cy="28" r="5" fill="${secondary}80"/>
    <ellipse cx="28" cy="28" rx="24" ry="10" fill="none" stroke="${secondary}60" stroke-width="1.2"/>
    <ellipse cx="28" cy="28" rx="24" ry="10" fill="none" stroke="${secondary}60" stroke-width="1.2" transform="rotate(60,28,28)"/>
    <ellipse cx="28" cy="28" rx="24" ry="10" fill="none" stroke="${secondary}60" stroke-width="1.2" transform="rotate(120,28,28)"/>
    <circle cx="50" cy="20" r="3" fill="${accent}90"/>
    <circle cx="6"  cy="36" r="3" fill="${accent}90"/>
  </g>
  <text x="338" y="330" fill="${secondary}50" font-family="serif" font-size="18">⚗</text>
  <text x="340" y="380" fill="${secondary}40" font-family="serif" font-size="12">DNA</text>
  <text x="340" y="430" fill="${secondary}45" font-family="serif" font-size="16">☢</text>
  <text x="342" y="480" fill="${secondary}40" font-family="serif" font-size="11">H₂O</text>
  <text x="335" y="525" fill="${secondary}35" font-family="serif" font-size="10">E=mc²</text>
</svg>`,
  },

  {
    id: 'arabic-arabesque',
    name: 'Arabic Arabesque',
    nameAr: 'زخرفة عربية إسلامية',
    category: 'side-column',
    subjects: ['arabic', 'religion'],
    aspectRatio: 400 / 560,
    defaultColors: SUBJECT_THEMES.arabic.colors,
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" preserveAspectRatio="none">
  <defs>
    <linearGradient id="arbG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${primary}"/>
      <stop offset="50%"  stop-color="${primary}dd"/>
      <stop offset="100%" stop-color="${primary}"/>
    </linearGradient>
    <!-- نمط هندسي للزخرفة -->
    <pattern id="arabPat" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <polygon points="10,1 12,8 19,8 13,13 15,20 10,15 5,20 7,13 1,8 8,8" fill="${secondary}25" stroke="${secondary}35" stroke-width="0.3"/>
    </pattern>
  </defs>
  <!-- عمود أيسر -->
  <path d="M0,0 L68,0 Q62,70 66,140 Q70,210 64,280 Q62,350 66,420 Q70,490 64,560 L0,560 Z" fill="url(#arbG)"/>
  <path d="M0,0 L68,0 Q62,70 66,140 Q70,210 64,280 Q62,350 66,420 Q70,490 64,560 L0,560 Z" fill="url(#arabPat)" opacity="0.6"/>
  <!-- زخارف نجمية - يسار -->
  ${[0,80,160,240,320,440].map((y, i) => `
  <polygon points="34,${y+20} 38,${y+30} 48,${y+30} 40,${y+36} 43,${y+46} 34,${y+40} 25,${y+46} 28,${y+36} 20,${y+30} 30,${y+30}"
    fill="${secondary}60" stroke="${secondary}80" stroke-width="0.5"/>
  `).join('')}
  <!-- خط ذهبي على الحافة -->
  <line x1="68" y1="0" x2="68" y2="560" stroke="${secondary}" stroke-width="1.5"/>
  <line x1="62" y1="0" x2="62" y2="560" stroke="${secondary}50" stroke-width="0.5"/>
  <!-- نقاط زخرفية -->
  ${[28,84,140,196,252,308,364,420,476,532].map(y => `<circle cx="10" cy="${y}" r="2" fill="${secondary}50"/>`).join('')}
  <!-- عمود أيمن -->
  <path d="M400,0 L332,0 Q338,70 334,140 Q330,210 336,280 Q338,350 334,420 Q330,490 336,560 L400,560 Z" fill="url(#arbG)"/>
  <path d="M400,0 L332,0 Q338,70 334,140 Q330,210 336,280 Q338,350 334,420 Q330,490 336,560 L400,560 Z" fill="url(#arabPat)" opacity="0.6"/>
  ${[0,80,160,240,320,440].map((y) => `
  <polygon points="366,${y+20} 370,${y+30} 380,${y+30} 372,${y+36} 375,${y+46} 366,${y+40} 357,${y+46} 360,${y+36} 352,${y+30} 362,${y+30}"
    fill="${secondary}60" stroke="${secondary}80" stroke-width="0.5"/>
  `).join('')}
  <line x1="332" y1="0" x2="332" y2="560" stroke="${secondary}" stroke-width="1.5"/>
  <line x1="338" y1="0" x2="338" y2="560" stroke="${secondary}50" stroke-width="0.5"/>
  ${[28,84,140,196,252,308,364,420,476,532].map(y => `<circle cx="390" cy="${y}" r="2" fill="${secondary}50"/>`).join('')}
</svg>`,
  },

  {
    id: 'computer-tech',
    name: 'Computer Tech',
    nameAr: 'تقنية الحاسب',
    category: 'side-column',
    subjects: ['computer'],
    aspectRatio: 400 / 560,
    defaultColors: SUBJECT_THEMES.computer.colors,
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" preserveAspectRatio="none">
  <!-- خلفية العمود الأيسر -->
  <rect x="0" y="0" width="70" height="560" fill="${primary}"/>
  <!-- نمط دوائر الكترونية -->
  ${[30,90,150,210,270,330,390,450,510].map((y,i) => `
    <line x1="${10+i%3*15}" y1="${y}" x2="${50}" y2="${y}" stroke="${accent}30" stroke-width="1"/>
    <circle cx="${10+i%3*15}" cy="${y}" r="3" fill="none" stroke="${accent}50" stroke-width="1"/>
    <circle cx="50" cy="${y}" r="4" fill="${accent}30" stroke="${accent}60" stroke-width="1"/>
  `).join('')}
  <!-- خطوط عمودية -->
  ${[20,35,50].map(x => `<line x1="${x}" y1="0" x2="${x}" y2="560" stroke="${accent}15" stroke-width="0.5" stroke-dasharray="4,8"/>`).join('')}
  <!-- نصوص كود -->
  <text x="5"  y="30"  fill="${accent}40" font-family="monospace" font-size="7">01100</text>
  <text x="10" y="100" fill="${accent}35" font-family="monospace" font-size="6">10011</text>
  <text x="5"  y="170" fill="${accent}40" font-family="monospace" font-size="7">11010</text>
  <text x="8"  y="250" fill="${accent}35" font-family="monospace" font-size="6">01101</text>
  <text x="5"  y="320" fill="${accent}40" font-family="monospace" font-size="7">10110</text>
  <text x="10" y="400" fill="${accent}35" font-family="monospace" font-size="6">00111</text>
  <text x="5"  y="470" fill="${accent}40" font-family="monospace" font-size="7">11001</text>
  <text x="8"  y="540" fill="${accent}35" font-family="monospace" font-size="6">01010</text>
  <!-- حد مضيء -->
  <line x1="69" y1="0" x2="69" y2="560" stroke="${accent}" stroke-width="1.5" opacity="0.7"/>
  <line x1="70" y1="0" x2="70" y2="560" stroke="${accent}30" stroke-width="2"/>
  <!-- نفس الشيء للعمود الأيمن -->
  <rect x="330" y="0" width="70" height="560" fill="${primary}"/>
  ${[30,90,150,210,270,330,390,450,510].map((y,i) => `
    <line x1="${350}" y1="${y}" x2="${375+i%3*15}" y2="${y}" stroke="${accent}30" stroke-width="1"/>
    <circle cx="${350}" cy="${y}" r="4" fill="${accent}30" stroke="${accent}60" stroke-width="1"/>
    <circle cx="${375+i%3*15}" cy="${y}" r="3" fill="none" stroke="${accent}50" stroke-width="1"/>
  `).join('')}
  ${[350,365,380].map(x => `<line x1="${x}" y1="0" x2="${x}" y2="560" stroke="${accent}15" stroke-width="0.5" stroke-dasharray="4,8"/>`).join('')}
  <text x="335" y="30"  fill="${accent}40" font-family="monospace" font-size="7">01100</text>
  <text x="340" y="100" fill="${accent}35" font-family="monospace" font-size="6">10011</text>
  <text x="335" y="170" fill="${accent}40" font-family="monospace" font-size="7">11010</text>
  <text x="338" y="250" fill="${accent}35" font-family="monospace" font-size="6">01101</text>
  <text x="335" y="320" fill="${accent}40" font-family="monospace" font-size="7">10110</text>
  <text x="340" y="400" fill="${accent}35" font-family="monospace" font-size="6">00111</text>
  <text x="335" y="470" fill="${accent}40" font-family="monospace" font-size="7">11001</text>
  <text x="338" y="540" fill="${accent}35" font-family="monospace" font-size="6">01010</text>
  <line x1="330" y1="0" x2="330" y2="560" stroke="${accent}30" stroke-width="2"/>
  <line x1="331" y1="0" x2="331" y2="560" stroke="${accent}" stroke-width="1.5" opacity="0.7"/>
</svg>`,
  },

  // ════════════════════════════════════
  // فئة: إطارات الحدود الكاملة (Full Borders)
  // ════════════════════════════════════

  {
    id: 'golden-classic',
    name: 'Golden Classic',
    nameAr: 'إطار ذهبي كلاسيكي',
    category: 'full-border',
    subjects: ['all', 'arabic', 'history'],
    aspectRatio: 400 / 560,
    defaultColors: { primary: '#b8860b', secondary: '#d4af37', accent: '#f5e6a3' },
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560">
  <defs>
    <linearGradient id="goldG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="${secondary}"/>
      <stop offset="50%"  stop-color="${primary}"/>
      <stop offset="100%" stop-color="${secondary}"/>
    </linearGradient>
  </defs>
  <!-- حد خارجي -->
  <rect x="4" y="4" width="392" height="552" fill="none" stroke="url(#goldG)" stroke-width="2.5" rx="2"/>
  <!-- حد داخلي -->
  <rect x="12" y="12" width="376" height="536" fill="none" stroke="url(#goldG)" stroke-width="1.5" rx="1"/>
  <!-- حد ثالث -->
  <rect x="18" y="18" width="364" height="524" fill="none" stroke="${primary}60" stroke-width="0.5"/>
  <!-- زوايا - شمال غرب -->
  <g fill="url(#goldG)">
    <!-- نجمة الزاوية العلوية اليسرى -->
    <polygon points="22,22 28,32 22,42 32,36 42,42 36,32 42,22 32,28" fill="${secondary}"/>
    <circle cx="32" cy="32" r="4" fill="${primary}"/>
    <!-- خطوط الزاوية -->
    <rect x="12" y="22" width="20" height="1.5" fill="${secondary}"/>
    <rect x="22" y="12" width="1.5" height="20" fill="${secondary}"/>
    <!-- زاوية شمال شرق -->
    <polygon points="378,22 372,32 378,42 368,36 358,42 364,32 358,22 368,28" fill="${secondary}"/>
    <circle cx="368" cy="32" r="4" fill="${primary}"/>
    <rect x="368" y="22" width="20" height="1.5" fill="${secondary}"/>
    <rect x="386.5" y="12" width="1.5" height="20" fill="${secondary}"/>
    <!-- زاوية جنوب غرب -->
    <polygon points="22,538 28,528 22,518 32,524 42,518 36,528 42,538 32,532" fill="${secondary}"/>
    <circle cx="32" cy="528" r="4" fill="${primary}"/>
    <rect x="12" y="536.5" width="20" height="1.5" fill="${secondary}"/>
    <rect x="22" y="528" width="1.5" height="20" fill="${secondary}"/>
    <!-- زاوية جنوب شرق -->
    <polygon points="378,538 372,528 378,518 368,524 358,518 364,528 358,538 368,532" fill="${secondary}"/>
    <circle cx="368" cy="528" r="4" fill="${primary}"/>
    <rect x="368" y="536.5" width="20" height="1.5" fill="${secondary}"/>
    <rect x="386.5" y="528" width="1.5" height="20" fill="${secondary}"/>
  </g>
  <!-- زخارف وسط الأضلاع -->
  <!-- أعلى وسط -->
  <ellipse cx="200" cy="8" rx="20" ry="6" fill="${secondary}80" stroke="${primary}" stroke-width="0.8"/>
  <polygon points="200,3 203,8 208,8 204,11 206,16 200,13 194,16 196,11 192,8 197,8" fill="${primary}"/>
  <!-- أسفل وسط -->
  <ellipse cx="200" cy="552" rx="20" ry="6" fill="${secondary}80" stroke="${primary}" stroke-width="0.8"/>
  <polygon points="200,547 203,552 208,552 204,555 206,560 200,557 194,560 196,555 192,552 197,552" fill="${primary}"/>
  <!-- يسار وسط -->
  <ellipse cx="8" cy="280" rx="6" ry="20" fill="${secondary}80" stroke="${primary}" stroke-width="0.8"/>
  <polygon points="3,280 8,277 8,272 11,276 16,274 13,280 16,286 11,284 8,288 8,283" fill="${primary}"/>
  <!-- يمين وسط -->
  <ellipse cx="392" cy="280" rx="6" ry="20" fill="${secondary}80" stroke="${primary}" stroke-width="0.8"/>
  <polygon points="397,280 392,277 392,272 389,276 384,274 387,280 384,286 389,284 392,288 392,283" fill="${primary}"/>
</svg>`,
  },

  {
    id: 'double-border-elegant',
    name: 'Double Border',
    nameAr: 'إطار مزدوج أنيق',
    category: 'full-border',
    subjects: ['all'],
    aspectRatio: 400 / 560,
    defaultColors: { primary: '#1e3a5f', secondary: '#3b82f6', accent: '#bfdbfe' },
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560">
  <!-- حد خارجي سميك -->
  <rect x="3"  y="3"  width="394" height="554" fill="none" stroke="${primary}" stroke-width="4" rx="4"/>
  <!-- مسافة -->
  <rect x="10" y="10" width="380" height="540" fill="none" stroke="${secondary}30" stroke-width="1"/>
  <!-- حد داخلي -->
  <rect x="14" y="14" width="372" height="532" fill="none" stroke="${secondary}" stroke-width="1.5" rx="2"/>
  <!-- زوايا مزخرفة -->
  <rect x="3"   y="3"   width="40" height="4" fill="${secondary}"/>
  <rect x="3"   y="3"   width="4" height="40" fill="${secondary}"/>
  <rect x="357" y="3"   width="40" height="4" fill="${secondary}"/>
  <rect x="393" y="3"   width="4" height="40" fill="${secondary}"/>
  <rect x="3"   y="553" width="40" height="4" fill="${secondary}"/>
  <rect x="3"   y="517" width="4" height="40" fill="${secondary}"/>
  <rect x="357" y="553" width="40" height="4" fill="${secondary}"/>
  <rect x="393" y="517" width="4" height="40" fill="${secondary}"/>
  <!-- دوائر الزوايا -->
  <circle cx="3"   cy="3"   r="5" fill="${secondary}"/>
  <circle cx="397" cy="3"   r="5" fill="${secondary}"/>
  <circle cx="3"   cy="557" r="5" fill="${secondary}"/>
  <circle cx="397" cy="557" r="5" fill="${secondary}"/>
  <!-- نقاط الزوايا الداخلية -->
  <circle cx="14"  cy="14"  r="4" fill="${secondary}60"/>
  <circle cx="386" cy="14"  r="4" fill="${secondary}60"/>
  <circle cx="14"  cy="546" r="4" fill="${secondary}60"/>
  <circle cx="386" cy="546" r="4" fill="${secondary}60"/>
  <!-- خطوط تزيينية علوية وسفلية -->
  <line x1="60" y1="5" x2="340" y2="5" stroke="${secondary}40" stroke-width="1" stroke-dasharray="3,6"/>
  <line x1="60" y1="555" x2="340" y2="555" stroke="${secondary}40" stroke-width="1" stroke-dasharray="3,6"/>
  <line x1="5" y1="60" x2="5" y2="500" stroke="${secondary}40" stroke-width="1" stroke-dasharray="3,6"/>
  <line x1="395" y1="60" x2="395" y2="500" stroke="${secondary}40" stroke-width="1" stroke-dasharray="3,6"/>
</svg>`,
  },

  {
    id: 'islamic-star-border',
    name: 'Islamic Star Border',
    nameAr: 'حدود إسلامية هندسية',
    category: 'full-border',
    subjects: ['all', 'arabic', 'religion'],
    aspectRatio: 400 / 560,
    defaultColors: { primary: '#14532d', secondary: '#d4af37', accent: '#fef3c7' },
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560">
  <!-- إطار رئيسي -->
  <rect x="5" y="5" width="390" height="550" fill="none" stroke="${secondary}" stroke-width="2"/>
  <rect x="10" y="10" width="380" height="540" fill="none" stroke="${primary}80" stroke-width="0.8"/>
  <!-- نجوم ثمانية في الزوايا -->
  <!-- زاوية شمال غرب -->
  <polygon points="30,5 33,15 43,15 35,21 38,31 30,25 22,31 25,21 17,15 27,15" fill="${secondary}" transform="scale(0.9) translate(3,3)"/>
  <polygon points="30,5 33,15 43,15 35,21 38,31 30,25 22,31 25,21 17,15 27,15" fill="none" stroke="${primary}" stroke-width="0.5" transform="scale(0.9) translate(3,3) rotate(22.5,30,18)"/>
  <!-- زاوية شمال شرق -->
  <polygon points="370,5 373,15 383,15 375,21 378,31 370,25 362,31 365,21 357,15 367,15" fill="${secondary}" transform="translate(0,0)"/>
  <!-- زاوية جنوب غرب -->
  <polygon points="30,529 33,539 43,539 35,545 38,555 30,549 22,555 25,545 17,539 27,539" fill="${secondary}"/>
  <!-- زاوية جنوب شرق -->
  <polygon points="370,529 373,539 383,539 375,545 378,555 370,549 362,555 365,545 357,539 367,539" fill="${secondary}"/>
  <!-- نجوم على الأضلاع - شمال -->
  ${[100,160,220,280].map(x => `<polygon points="${x},6 ${x+2},11 ${x+7},11 ${x+3},14 ${x+4.5},19 ${x},16 ${x-4.5},19 ${x-3},14 ${x-7},11 ${x-2},11" fill="${secondary}70"/>`).join('')}
  <!-- نجوم على الأضلاع - جنوب -->
  ${[100,160,220,280].map(x => `<polygon points="${x},554 ${x+2},549 ${x+7},549 ${x+3},546 ${x+4.5},541 ${x},544 ${x-4.5},541 ${x-3},546 ${x-7},549 ${x-2},549" fill="${secondary}70"/>`).join('')}
  <!-- نجوم على الأضلاع - يسار -->
  ${[100,180,260,360].map(y => `<polygon points="6,${y} 11,${y+2} 11,${y+7} 14,${y+3} 19,${y+4.5} 16,${y} 19,${y-4.5} 14,${y-3} 11,${y-7} 11,${y-2}" fill="${secondary}70"/>`).join('')}
  <!-- نجوم على الأضلاع - يمين -->
  ${[100,180,260,360].map(y => `<polygon points="394,${y} 389,${y+2} 389,${y+7} 386,${y+3} 381,${y+4.5} 384,${y} 381,${y-4.5} 386,${y-3} 389,${y-7} 389,${y-2}" fill="${secondary}70"/>`).join('')}
</svg>`,
  },

  // ════════════════════════════════════
  // فئة: لافتات العناوين (Banners)
  // ════════════════════════════════════

  {
    id: 'quote-box-yellow',
    name: 'Quote Box',
    nameAr: 'صندوق اقتباس أصفر',
    category: 'banner',
    subjects: ['all'],
    aspectRatio: 300 / 180,
    defaultColors: { primary: '#f59e0b', secondary: '#1f2937', accent: '#fef3c7' },
    render: ({ primary, secondary, accent }, text = 'اكتب النص هنا') => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 180">
  <!-- ظل -->
  <rect x="24" y="8" width="266" height="152" rx="8" ry="8" fill="${secondary}25"/>
  <!-- الصندوق الأصفر (الظل الأمامي) -->
  <rect x="18" y="5" width="266" height="152" rx="8" ry="8" fill="${primary}"/>
  <!-- الصندوق الأبيض/الفاتح (الجسم الرئيسي) -->
  <rect x="8"  y="0" width="266" height="148" rx="8" ry="8" fill="${accent}"/>
  <!-- حد أسود -->
  <rect x="8"  y="0" width="266" height="148" rx="8" ry="8" fill="none" stroke="${secondary}" stroke-width="1.5"/>
  <!-- خطوط تزيينية -->
  <line x1="20" y1="130" x2="262" y2="130" stroke="${secondary}25" stroke-width="1"/>
  <line x1="20" y1="136" x2="262" y2="136" stroke="${secondary}25" stroke-width="1"/>
  <!-- ذيل الفقاعة -->
  <path d="M50,148 L30,168 L75,148" fill="${accent}" stroke="${secondary}" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- علامة اقتباس 66 - يمين -->
  <text x="18" y="36" font-family="serif" font-size="36" font-weight="bold" fill="${primary}" opacity="0.7">"</text>
  <!-- علامة اقتباس 99 - يسار -->
  <text x="244" y="130" font-family="serif" font-size="36" font-weight="bold" fill="${primary}" opacity="0.7">"</text>
  <!-- خطوط متقطعة للزخرفة -->
  <line x1="260" y1="14" x2="272" y2="14" stroke="${secondary}40" stroke-width="1.5"/>
  <line x1="260" y1="20" x2="278" y2="20" stroke="${secondary}30" stroke-width="1"/>
</svg>`,
  },

  {
    id: 'wooden-sign',
    name: 'Wooden Hanging Sign',
    nameAr: 'لافتة خشبية معلقة',
    category: 'banner',
    subjects: ['all'],
    aspectRatio: 280 / 200,
    defaultColors: { primary: '#92400e', secondary: '#78350f', accent: '#fef3c7' },
    render: ({ primary, secondary, accent }, text = 'عنوان الدرس') => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200">
  <!-- حبل يمين -->
  <line x1="220" y1="0"  x2="195" y2="55" stroke="#6b4226" stroke-width="3" stroke-linecap="round"/>
  <line x1="218" y1="0"  x2="193" y2="55" stroke="#92400e" stroke-width="1.5"/>
  <!-- حبل يسار -->
  <line x1="60"  y1="0"  x2="85"  y2="55" stroke="#6b4226" stroke-width="3" stroke-linecap="round"/>
  <line x1="62"  y1="0"  x2="87"  y2="55" stroke="#92400e" stroke-width="1.5"/>
  <!-- خشب اللوح - ظل -->
  <rect x="22" y="57" width="238" height="118" rx="4" fill="${secondary}aa"/>
  <!-- خشب اللوح - أساس -->
  <rect x="18" y="52" width="238" height="118" rx="4" fill="${primary}"/>
  <!-- خطوط الخشب -->
  <line x1="18" y1="70"  x2="256" y2="70"  stroke="${secondary}60" stroke-width="1.2"/>
  <line x1="18" y1="88"  x2="256" y2="88"  stroke="${secondary}50" stroke-width="0.8"/>
  <line x1="18" y1="105" x2="256" y2="105" stroke="${secondary}60" stroke-width="1.2"/>
  <line x1="18" y1="122" x2="256" y2="122" stroke="${secondary}50" stroke-width="0.8"/>
  <line x1="18" y1="139" x2="256" y2="139" stroke="${secondary}60" stroke-width="1.2"/>
  <line x1="18" y1="155" x2="256" y2="155" stroke="${secondary}50" stroke-width="0.8"/>
  <!-- حافة خشبية علوية وسفلية -->
  <rect x="18" y="52"  width="238" height="10" rx="4" fill="${primary}cc"/>
  <rect x="18" y="160" width="238" height="10" rx="4" fill="${secondary}88"/>
  <!-- حد اللوح -->
  <rect x="18" y="52" width="238" height="118" rx="4" fill="none" stroke="${secondary}" stroke-width="2"/>
  <!-- عُقد المسامير -->
  <circle cx="35"  cy="65"  r="4" fill="${secondary}cc"/>
  <circle cx="243" cy="65"  r="4" fill="${secondary}cc"/>
  <circle cx="35"  cy="158" r="4" fill="${secondary}cc"/>
  <circle cx="243" cy="158" r="4" fill="${secondary}cc"/>
  <!-- إضاءة علوية للوحة -->
  <rect x="20" y="54" width="234" height="6" rx="2" fill="rgba(255,255,255,0.12)"/>
</svg>`,
  },

  {
    id: 'ribbon-banner',
    name: 'Ribbon Banner',
    nameAr: 'شريط لافتة ملون',
    category: 'banner',
    subjects: ['all'],
    aspectRatio: 360 / 80,
    defaultColors: { primary: '#1d4e7a', secondary: '#ffffff', accent: '#3b82f6' },
    render: ({ primary, secondary, accent }, text = 'عنوان القسم') => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 80">
  <!-- ظل -->
  <path d="M4,4 L340,4 L355,40 L340,76 L4,76 L18,40 Z" fill="${primary}44"/>
  <!-- الجسم الرئيسي -->
  <path d="M0,0 L336,0 L351,40 L336,80 L0,80 L14,40 Z" fill="${primary}"/>
  <!-- لمعة -->
  <path d="M0,0 L336,0 L351,40 L0,40 Z" fill="rgba(255,255,255,0.08)"/>
  <!-- خط علوي فاتح -->
  <path d="M0,3 L336,3" stroke="${secondary}30" stroke-width="1"/>
  <!-- حد -->
  <path d="M0,0 L336,0 L351,40 L336,80 L0,80 L14,40 Z" fill="none" stroke="${accent}" stroke-width="1.5"/>
  <!-- الجانب الخلفي (طيات) -->
  <path d="M336,0 L348,0 L360,40 L348,80 L336,80 L351,40 Z" fill="${primary}66"/>
  <!-- خطوط الزخرفة -->
  <line x1="20" y1="18" x2="330" y2="18" stroke="${secondary}20" stroke-width="0.8"/>
  <line x1="20" y1="62" x2="330" y2="62" stroke="${secondary}20" stroke-width="0.8"/>
</svg>`,
  },

  {
    id: 'arrow-banner',
    name: 'Arrow Banner',
    nameAr: 'لافتة سهمية',
    category: 'banner',
    subjects: ['all'],
    aspectRatio: 300 / 70,
    defaultColors: { primary: '#7c3aed', secondary: '#ffffff', accent: '#c4b5fd' },
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 70">
  <!-- اللافتة السهمية -->
  <path d="M0,5 L260,5 L295,35 L260,65 L0,65 Z" fill="${primary}"/>
  <path d="M0,5 L260,5 L295,35 L260,65 L0,65 Z" fill="none" stroke="${accent}" stroke-width="1.5"/>
  <!-- خطوط داخلية -->
  <path d="M10,14 L252,14 L282,35 L252,56 L10,56 Z" fill="none" stroke="${secondary}20" stroke-width="0.8"/>
  <!-- طيات يسار -->
  <path d="M0,5 L0,65 L8,60 L8,10 Z" fill="${primary}88"/>
  <!-- لمعة -->
  <path d="M0,5 L260,5 L275,20 L0,20 Z" fill="rgba(255,255,255,0.1)"/>
</svg>`,
  },

  // ════════════════════════════════════
  // فئة: صناديق المحتوى (Content Boxes)
  // ════════════════════════════════════

  {
    id: 'tip-box',
    name: 'Tip Box',
    nameAr: 'صندوق تلميح',
    category: 'content-box',
    subjects: ['all'],
    aspectRatio: 350 / 120,
    defaultColors: { primary: '#0369a1', secondary: '#e0f2fe', accent: '#7dd3fc' },
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 120">
  <!-- خلفية -->
  <rect x="0" y="0" width="350" height="120" rx="8" fill="${secondary}"/>
  <!-- حد يمين ملون سميك -->
  <rect x="0" y="0" width="8" height="120" rx="4" fill="${primary}"/>
  <!-- حد خارجي -->
  <rect x="0" y="0" width="350" height="120" rx="8" fill="none" stroke="${primary}40" stroke-width="1.5"/>
  <!-- أيقونة المصباح -->
  <g transform="translate(22,28)">
    <circle cx="16" cy="12" r="10" fill="${primary}" opacity="0.9"/>
    <line x1="16" y1="0"  x2="16" y2="-5" stroke="${primary}" stroke-width="2" stroke-linecap="round"/>
    <line x1="28" y1="4"  x2="32" y2="0"  stroke="${primary}" stroke-width="2" stroke-linecap="round"/>
    <line x1="0"  y1="4"  x2="-4" y2="0"  stroke="${primary}" stroke-width="2" stroke-linecap="round"/>
    <text x="12" y="17" font-size="14" fill="white" font-family="serif">💡</text>
    <rect x="10" y="22" width="12" height="4" rx="1" fill="${primary}80"/>
    <rect x="11" y="27" width="10" height="3" rx="1" fill="${primary}60"/>
  </g>
  <!-- حد سفلي للأيقونة -->
  <line x1="14" y1="60" x2="14" y2="108" stroke="${primary}30" stroke-width="1" stroke-dasharray="3,3"/>
  <!-- نص تلميح -->
  <text x="60" y="30" font-family="serif" font-size="11" fill="${primary}" font-weight="bold" direction="rtl">تلميح:</text>
  <line x1="60" y1="65" x2="340" y2="65" stroke="${primary}20" stroke-width="1"/>
</svg>`,
  },

  {
    id: 'warning-box',
    name: 'Warning Box',
    nameAr: 'صندوق تنبيه',
    category: 'content-box',
    subjects: ['all'],
    aspectRatio: 350 / 100,
    defaultColors: { primary: '#d97706', secondary: '#fffbeb', accent: '#fcd34d' },
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 100">
  <rect x="0" y="0" width="350" height="100" rx="6" fill="${secondary}"/>
  <rect x="0" y="0" width="6" height="100" rx="3" fill="${primary}"/>
  <rect x="0" y="0" width="350" height="100" rx="6" fill="none" stroke="${primary}60" stroke-width="1.5"/>
  <!-- مثلث التنبيه -->
  <polygon points="22,15 40,80 4,80" fill="${primary}" opacity="0.9"/>
  <text x="13" y="60" font-size="18" fill="white" font-weight="bold" font-family="sans-serif">!</text>
  <line x1="55" y1="10" x2="55" y2="90" stroke="${primary}25" stroke-width="1"/>
  <text x="65" y="28" font-family="serif" font-size="11" fill="${primary}" font-weight="bold" direction="rtl">تنبيه مهم:</text>
</svg>`,
  },

  {
    id: 'definition-box',
    name: 'Definition Box',
    nameAr: 'صندوق تعريف',
    category: 'content-box',
    subjects: ['all'],
    aspectRatio: 350 / 110,
    defaultColors: { primary: '#1e3a5f', secondary: '#f8fafc', accent: '#3b82f6' },
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 110">
  <rect x="0" y="0" width="350" height="110" rx="6" fill="${secondary}"/>
  <rect x="0" y="0" width="350" height="110" rx="6" fill="none" stroke="${primary}" stroke-width="1.5"/>
  <!-- شريط العنوان -->
  <rect x="0" y="0" width="350" height="32" rx="6" fill="${primary}"/>
  <rect x="0" y="26" width="350" height="6" fill="${primary}"/>
  <!-- نص التعريف -->
  <text x="175" y="22" font-family="serif" font-size="13" fill="white" text-anchor="middle" font-weight="bold" direction="rtl">تعريف</text>
  <!-- خط أسفل شريط العنوان -->
  <line x1="12" y1="45" x2="338" y2="45" stroke="${accent}30" stroke-width="0.8"/>
</svg>`,
  },

  {
    id: 'example-box',
    name: 'Example Box',
    nameAr: 'صندوق مثال',
    category: 'content-box',
    subjects: ['all', 'math', 'science'],
    aspectRatio: 350 / 110,
    defaultColors: { primary: '#14532d', secondary: '#f0fdf4', accent: '#16a34a' },
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 110">
  <rect x="0" y="0" width="350" height="110" rx="6" fill="${secondary}"/>
  <rect x="0" y="0" width="350" height="110" rx="6" fill="none" stroke="${accent}" stroke-width="2"/>
  <!-- شريط يمين ملون -->
  <rect x="0" y="0" width="10" height="110" rx="3" fill="${accent}"/>
  <!-- رقم المثال -->
  <text x="24" y="38" font-family="serif" font-size="20" fill="${primary}" font-weight="bold" direction="rtl">مثال</text>
  <text x="24" y="58" font-family="serif" font-size="13" fill="${accent}">1</text>
  <line x1="20" y1="68" x2="340" y2="68" stroke="${accent}30" stroke-width="1"/>
</svg>`,
  },

  {
    id: 'math-grid-frame',
    name: 'Math Grid Frame',
    nameAr: 'إطار ورقة الرياضيات',
    category: 'full-border',
    subjects: ['math', 'science'],
    aspectRatio: 400 / 560,
    defaultColors: SUBJECT_THEMES.math.colors,
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560">
  <defs>
    <pattern id="gridPat" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${secondary}25" stroke-width="0.5"/>
    </pattern>
    <pattern id="gridBig" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="${secondary}50" stroke-width="1"/>
    </pattern>
  </defs>
  <!-- حد خارجي بشريط رياضيات -->
  <!-- أعلى -->
  <rect x="0" y="0" width="400" height="45" fill="${primary}"/>
  <rect x="0" y="0" width="400" height="45" fill="url(#gridPat)"/>
  <!-- أسفل -->
  <rect x="0" y="515" width="400" height="45" fill="${primary}"/>
  <rect x="0" y="515" width="400" height="45" fill="url(#gridPat)"/>
  <!-- يسار -->
  <rect x="0" y="45" width="45" height="470" fill="${primary}ee"/>
  <rect x="0" y="45" width="45" height="470" fill="url(#gridPat)"/>
  <!-- يمين -->
  <rect x="355" y="45" width="45" height="470" fill="${primary}ee"/>
  <rect x="355" y="45" width="45" height="470" fill="url(#gridPat)"/>
  <!-- خطوط تدريج على الشريط العلوي -->
  ${Array.from({length:19},(_, i) => `<line x1="${(i+1)*20}" y1="35" x2="${(i+1)*20}" y2="45" stroke="${secondary}60" stroke-width="${i%5===4?1.5:.8}"/>`).join('')}
  ${Array.from({length:27},(_, i) => `<line x1="${(i+1)*20}" y1="515" x2="${(i+1)*20}" y2="525" stroke="${secondary}60" stroke-width="${i%5===4?1.5:.8}"/>`).join('')}
  <!-- أرقام شريط التدريج -->
  ${Array.from({length:5},(_, i) => `<text x="${(i+1)*80-2}" y="42" font-size="8" fill="${secondary}80" font-family="monospace">${(i+1)*2}cm</text>`).join('')}
  <!-- حد داخلي الإطار -->
  <rect x="45" y="45" width="310" height="470" fill="none" stroke="${secondary}40" stroke-width="1"/>
  <!-- رموز رياضية في الزوايا -->
  <text x="8"  y="22"  fill="${secondary}60" font-family="serif" font-size="11">x²+y²</text>
  <text x="285" y="22" fill="${secondary}60" font-family="serif" font-size="11">∑f(x)dx</text>
  <text x="8"  y="540" fill="${secondary}60" font-family="serif" font-size="11">π≈3.14</text>
  <text x="300" y="540" fill="${secondary}60" font-family="serif" font-size="11">∞</text>
</svg>`,
  },

  {
    id: 'history-classical',
    name: 'History Classical',
    nameAr: 'إطار التاريخ الكلاسيكي',
    category: 'side-column',
    subjects: ['history', 'geography'],
    aspectRatio: 400 / 560,
    defaultColors: SUBJECT_THEMES.history.colors,
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" preserveAspectRatio="none">
  <defs>
    <linearGradient id="histG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${primary}"/>
      <stop offset="100%" stop-color="${primary}cc"/>
    </linearGradient>
  </defs>
  <!-- عمود يسار -->
  <rect x="0" y="0" width="68" height="560" fill="url(#histG)"/>
  <!-- تعريجات العمود اليساري (كلاسيكي) -->
  <path d="M68,0 Q60,30 65,60 Q70,90 63,120 Q58,150 65,180 Q70,210 63,240 Q58,270 65,300 Q70,330 63,360 Q58,390 65,420 Q70,450 63,480 Q58,510 65,540 Q68,550 68,560" fill="none" stroke="${secondary}40" stroke-width="1.5"/>
  <!-- عناصر عمودية كلاسيكية -->
  ${[40,120,200,280,360,440,520].map(y => `
    <rect x="5"  y="${y-8}" width="30" height="16" rx="1" fill="${secondary}20"/>
    <line x1="5" y1="${y}"  x2="35" y2="${y}" stroke="${secondary}40" stroke-width="1"/>
  `).join('')}
  <!-- نقوش زخرفية -->
  <text x="8"  y="30"  fill="${secondary}30" font-size="18">⚔</text>
  <text x="8"  y="110" fill="${secondary}25" font-size="15">🏛</text>
  <text x="10" y="200" fill="${secondary}30" font-size="14">📜</text>
  <text x="8"  y="290" fill="${secondary}25" font-size="14">🗿</text>
  <text x="10" y="380" fill="${secondary}30" font-size="15">⚜</text>
  <text x="8"  y="460" fill="${secondary}25" font-size="14">🔱</text>
  <text x="10" y="540" fill="${secondary}30" font-size="14">⚔</text>
  <!-- حد الحافة -->
  <line x1="67" y1="0" x2="67" y2="560" stroke="${secondary}50" stroke-width="1.5"/>
  <line x1="63" y1="0" x2="63" y2="560" stroke="${secondary}25" stroke-width="0.5"/>
  <!-- عمود يمين (معكوس) -->
  <rect x="332" y="0" width="68" height="560" fill="url(#histG)"/>
  <path d="M332,0 Q340,30 335,60 Q330,90 337,120 Q342,150 335,180 Q330,210 337,240 Q342,270 335,300 Q330,330 337,360 Q342,390 335,420 Q330,450 337,480 Q342,510 335,540 Q332,550 332,560" fill="none" stroke="${secondary}40" stroke-width="1.5"/>
  ${[40,120,200,280,360,440,520].map(y => `
    <rect x="365" y="${y-8}" width="30" height="16" rx="1" fill="${secondary}20"/>
    <line x1="365" y1="${y}" x2="395" y2="${y}" stroke="${secondary}40" stroke-width="1"/>
  `).join('')}
  <text x="355" y="30"  fill="${secondary}30" font-size="18">⚔</text>
  <text x="355" y="110" fill="${secondary}25" font-size="15">🏛</text>
  <text x="355" y="200" fill="${secondary}30" font-size="14">📜</text>
  <text x="355" y="290" fill="${secondary}25" font-size="14">🗿</text>
  <text x="355" y="380" fill="${secondary}30" font-size="15">⚜</text>
  <text x="355" y="460" fill="${secondary}25" font-size="14">🔱</text>
  <text x="355" y="540" fill="${secondary}30" font-size="14">⚔</text>
  <line x1="332" y1="0" x2="332" y2="560" stroke="${secondary}50" stroke-width="1.5"/>
  <line x1="336" y1="0" x2="336" y2="560" stroke="${secondary}25" stroke-width="0.5"/>
</svg>`,
  },

  {
    id: 'colorful-multi-banner',
    name: 'Colorful Multi Banner',
    nameAr: 'شريط عنوان ملوّن متعدد',
    category: 'banner',
    subjects: ['all'],
    aspectRatio: 350 / 70,
    defaultColors: { primary: '#1d4e7a', secondary: '#dc2626', accent: '#ffffff' },
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 70">
  <!-- الشريط الخلفي (لون ثانوي) -->
  <rect x="4" y="8" width="342" height="58" rx="4" fill="${secondary}"/>
  <!-- الشريط الأمامي (لون رئيسي) -->
  <rect x="0" y="0" width="342" height="55" rx="4" fill="${primary}"/>
  <!-- خط أبيض فاصل -->
  <rect x="0" y="8" width="342" height="2" fill="${accent}20"/>
  <!-- لمعة -->
  <rect x="2" y="2" width="338" height="25" rx="3" fill="rgba(255,255,255,0.08)"/>
  <!-- حد أبيض رفيع -->
  <rect x="0" y="0" width="342" height="55" rx="4" fill="none" stroke="${accent}30" stroke-width="1"/>
  <!-- زوايا مستديرة للشريط الثانوي -->
  <rect x="338" y="0" width="12" height="63" rx="2" fill="${secondary}cc"/>
</svg>`,
  },

  {
    id: 'notebook-frame',
    name: 'Notebook Frame',
    nameAr: 'إطار دفتر مدرسي',
    category: 'full-border',
    subjects: ['all', 'arabic', 'english'],
    aspectRatio: 400 / 560,
    defaultColors: { primary: '#1d4e7a', secondary: '#93c5fd', accent: '#dbeafe' },
    render: ({ primary, secondary, accent }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560">
  <!-- خلفية الصفحة -->
  <rect x="40" y="0" width="360" height="560" fill="white"/>
  <!-- شريط التجليد (يسار / فهرس) -->
  <rect x="0" y="0" width="45" height="560" fill="${accent}"/>
  <!-- خطوط الأولى في التجليد -->
  ${Array.from({length:20},(_, i) => `<circle cx="${10+i%3*12}" cy="${i*30+15}" r="5" fill="none" stroke="${secondary}80" stroke-width="1.5"/>`).join('')}
  <!-- خط الهامش الأحمر -->
  <line x1="50" y1="0" x2="50" y2="560" stroke="#ef4444" stroke-width="1.5"/>
  <!-- خطوط السطور -->
  ${Array.from({length:22},(_, i) => `<line x1="50" y1="${i*25+25}" x2="400" y2="${i*25+25}" stroke="${secondary}50" stroke-width="0.8"/>`).join('')}
  <!-- حلقات التجليد -->
  ${Array.from({length:10},(_, i) => `
    <path d="M18,${i*58+10} Q32,${i*58+10} 32,${i*58+24} Q32,${i*58+38} 18,${i*58+38}" fill="none" stroke="${primary}80" stroke-width="2.5"/>
    <path d="M18,${i*58+10} Q4,${i*58+10} 4,${i*58+24} Q4,${i*58+38} 18,${i*58+38}" fill="none" stroke="${primary}50" stroke-width="1.5"/>
  `).join('')}
  <!-- حد الصفحة -->
  <rect x="40" y="0" width="360" height="560" fill="none" stroke="${secondary}60" stroke-width="1"/>
</svg>`,
  },

];

// ─── الحصول على إطارات مصفّاة حسب المادة ────────────────────────────────────

export function getFramesBySubject(subject: string): FrameTemplate[] {
  if (subject === 'all') return FRAME_TEMPLATES;
  return FRAME_TEMPLATES.filter(t => t.subjects.includes(subject) || t.subjects.includes('all'));
}

export function getFrameById(id: string): FrameTemplate | undefined {
  return FRAME_TEMPLATES.find(t => t.id === id);
}

export function renderFrameSvg(frameId: string, colors: FrameColors, text?: string): string {
  const tpl = getFrameById(frameId);
  if (!tpl) return '';
  try {
    return tpl.render(colors, text);
  } catch {
    return '';
  }
}
