/**
 * pageBgStyle — دالة مستقلة لأنماط خلفية صفحة A4
 * تُعرَّف خارج ملفات المكوّنات لضمان توافق Fast Refresh
 */
import type React from 'react';

function makeEmojiSvg(emoji: string, bg: string): React.CSSProperties {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><text y="58" font-size="46" opacity="0.08">${emoji}</text></svg>`;
  return {
    background: bg,
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: '80px 80px',
  };
}

export function getPageBgStyle(preset?: string): React.CSSProperties {
  switch (preset) {
    // ── ألوان فاتحة ──
    case 'cream':         return { background: '#fefce8' };
    case 'blue-light':    return { background: '#eff6ff' };
    case 'green-light':   return { background: '#f0fdf4' };
    case 'pink-light':    return { background: '#fdf2f8' };
    case 'purple-light':  return { background: '#faf5ff' };
    case 'gray-light':    return { background: '#f9fafb' };
    case 'peach':         return { background: '#fff7ed' };
    case 'mint':          return { background: '#f0fdfa' };
    case 'rose':          return { background: '#fff1f2' };
    case 'sky':           return { background: '#e0f2fe' };
    case 'amber':         return { background: '#fffbeb' };
    case 'sand':          return { background: '#fdf8f0' };
    case 'lavender':      return { background: '#f3f0ff' };
    case 'teal-light':    return { background: '#f0fffe' };
    case 'orange-light':  return { background: '#fff8f0' };
    // ── ألوان داكنة ──
    case 'dark-navy':     return { background: '#0f172a', color: '#f1f5f9' };
    case 'dark-slate':    return { background: '#1e293b', color: '#f1f5f9' };
    case 'dark-green':    return { background: '#052e16', color: '#dcfce7' };
    case 'dark-purple':   return { background: '#1e1b4b', color: '#ede9fe' };
    case 'dark-red':      return { background: '#1c0606', color: '#fee2e2' };
    case 'dark-teal':     return { background: '#042f2e', color: '#ccfbf1' };
    case 'dark-brown':    return { background: '#1c0a00', color: '#fed7aa' };
    case 'dark-gray':     return { background: '#111827', color: '#f9fafb' };
    case 'dark-blue':     return { background: '#0c1a42', color: '#dbeafe' };
    case 'dark-rose':     return { background: '#1a0010', color: '#fce7f3' };
    // ── سطور ──
    case 'lined':         return { background: '#fff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 29px,#cccccc 29px,#cccccc 30px)' };
    case 'lined-blue':    return { background: '#f8faff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 29px,#bfdbfe 29px,#bfdbfe 30px)' };
    case 'lined-green':   return { background: '#f0fdf4', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 29px,#bbf7d0 29px,#bbf7d0 30px)' };
    case 'lined-rose':    return { background: '#fff1f2', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 29px,#fecdd3 29px,#fecdd3 30px)' };
    case 'lined-purple':  return { background: '#faf5ff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 29px,#e9d5ff 29px,#e9d5ff 30px)' };
    case 'lined-amber':   return { background: '#fffbeb', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 29px,#fde68a 29px,#fde68a 30px)' };
    case 'lined-teal':    return { background: '#f0fdfa', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 29px,#99f6e4 29px,#99f6e4 30px)' };
    case 'lined-dark':    return { background: '#1e293b', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 29px,#334155 29px,#334155 30px)', color: '#f1f5f9' };
    // ── مشطرة (Grid) ──
    case 'grid':          return { background: '#fff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 24px,#e5e7eb 24px,#e5e7eb 25px),repeating-linear-gradient(to right,transparent 0,transparent 24px,#e5e7eb 24px,#e5e7eb 25px)' };
    case 'grid-blue':     return { background: '#f8faff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 24px,#dbeafe 24px,#dbeafe 25px),repeating-linear-gradient(to right,transparent 0,transparent 24px,#dbeafe 24px,#dbeafe 25px)' };
    case 'grid-green':    return { background: '#f0fdf4', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 24px,#bbf7d0 24px,#bbf7d0 25px),repeating-linear-gradient(to right,transparent 0,transparent 24px,#bbf7d0 24px,#bbf7d0 25px)' };
    case 'grid-rose':     return { background: '#fff1f2', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 24px,#fecdd3 24px,#fecdd3 25px),repeating-linear-gradient(to right,transparent 0,transparent 24px,#fecdd3 24px,#fecdd3 25px)' };
    case 'grid-purple':   return { background: '#faf5ff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 24px,#e9d5ff 24px,#e9d5ff 25px),repeating-linear-gradient(to right,transparent 0,transparent 24px,#e9d5ff 24px,#e9d5ff 25px)' };
    case 'grid-dark':     return { background: '#1e293b', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 24px,#334155 24px,#334155 25px),repeating-linear-gradient(to right,transparent 0,transparent 24px,#334155 24px,#334155 25px)', color: '#f1f5f9' };
    // ── نقاط ──
    case 'dots':          return { background: '#fff', backgroundImage: 'radial-gradient(circle,#d1d5db 1.5px,transparent 1.5px)', backgroundSize: '20px 20px' };
    case 'dots-blue':     return { background: '#f8faff', backgroundImage: 'radial-gradient(circle,#93c5fd 1.5px,transparent 1.5px)', backgroundSize: '20px 20px' };
    case 'dots-green':    return { background: '#f0fdf4', backgroundImage: 'radial-gradient(circle,#86efac 1.5px,transparent 1.5px)', backgroundSize: '20px 20px' };
    case 'dots-rose':     return { background: '#fff1f2', backgroundImage: 'radial-gradient(circle,#fda4af 1.5px,transparent 1.5px)', backgroundSize: '20px 20px' };
    case 'dots-purple':   return { background: '#faf5ff', backgroundImage: 'radial-gradient(circle,#d8b4fe 1.5px,transparent 1.5px)', backgroundSize: '20px 20px' };
    case 'dots-amber':    return { background: '#fffbeb', backgroundImage: 'radial-gradient(circle,#fcd34d 1.5px,transparent 1.5px)', backgroundSize: '20px 20px' };
    case 'dots-dark':     return { background: '#1e293b', backgroundImage: 'radial-gradient(circle,#475569 1.5px,transparent 1.5px)', backgroundSize: '20px 20px', color: '#f1f5f9' };
    // ── تدرجات ──
    case 'grad-sky':      return { background: 'linear-gradient(135deg,#dbeafe,#e0f2fe,#f0fdf4)' };
    case 'grad-sunset':   return { background: 'linear-gradient(135deg,#fef9c3,#fde68a,#fecaca)' };
    case 'grad-lavender': return { background: 'linear-gradient(135deg,#f5f3ff,#ede9fe,#fdf4ff)' };
    case 'grad-mint':     return { background: 'linear-gradient(135deg,#d1fae5,#f0fdfa,#ecfdf5)' };
    case 'grad-rose':     return { background: 'linear-gradient(135deg,#ffe4e6,#fef2f2,#fdf2f8)' };
    case 'grad-ocean':    return { background: 'linear-gradient(135deg,#1e3a5f,#1e4d7b,#1a6b9a)', color: '#e0f2fe' };
    case 'grad-forest':   return { background: 'linear-gradient(135deg,#1a3a2a,#15532e,#166534)', color: '#dcfce7' };
    case 'grad-dusk':     return { background: 'linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)', color: '#ede9fe' };
    case 'grad-peach':    return { background: 'linear-gradient(135deg,#fff7ed,#fed7aa,#fde68a)' };
    case 'grad-cotton':   return { background: 'linear-gradient(135deg,#fdf2f8,#fce7f3,#fdf4ff)' };
    case 'grad-aurora':   return { background: 'linear-gradient(135deg,#d1fae5,#a5f3fc,#c7d2fe)' };
    case 'grad-gold':     return { background: 'linear-gradient(135deg,#fffbeb,#fef3c7,#fde68a)' };
    // ── إيموجي ──
    case 'emoji-star':    return makeEmojiSvg('⭐', '#fffbf0');
    case 'emoji-book':    return makeEmojiSvg('📚', '#f0f9ff');
    case 'emoji-pen':     return makeEmojiSvg('✏️', '#f9fafb');
    case 'emoji-math':    return makeEmojiSvg('➕', '#f0fdf4');
    case 'emoji-heart':   return makeEmojiSvg('❤️', '#fff1f2');
    case 'emoji-brain':   return makeEmojiSvg('🧠', '#faf5ff');
    case 'emoji-atom':    return makeEmojiSvg('⚛️', '#e0f2fe');
    case 'emoji-trophy':  return makeEmojiSvg('🏆', '#fffbeb');
    case 'emoji-moon':    return makeEmojiSvg('🌙', '#0f172a');
    case 'emoji-sun':     return makeEmojiSvg('☀️', '#fffbeb');
    case 'emoji-flower':  return makeEmojiSvg('🌸', '#fdf2f8');
    case 'emoji-rocket':  return makeEmojiSvg('🚀', '#0c1a42');
    case 'emoji-soccer':  return makeEmojiSvg('⚽', '#f0fdf4');
    case 'emoji-music':   return makeEmojiSvg('🎵', '#faf5ff');
    case 'emoji-globe':   return makeEmojiSvg('🌍', '#eff6ff');
    case 'emoji-diamond': return makeEmojiSvg('💎', '#f0fffe');
    default:              return { background: '#ffffff' };
  }
}
