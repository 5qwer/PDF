import React, { useRef, useState, useCallback, CSSProperties } from 'react';
import type {
  DesignerState, DesignerAction, DesignerElement, ToolType,
  TextElement, ShapeElement, LineElement, ImageElement, TableElement,
  StickerElement, DynamicFieldElement, SmartZoneElement, PageBackground,
  PageSettings, DecoFrameElement,
} from '@/lib/designer-types';
import { renderFrameSvg } from '@/lib/frame-templates';
import {
  PAGE_SIZE_DIMS, DYNAMIC_FIELDS, SMART_ZONE_DEFS, PREDEFINED_STICKERS,
  DEFAULT_BACKGROUND, formatQuestionNumber,
} from '@/lib/designer-types';

const MM_TO_PX = 3.7795;

function getPageBasePx(settings: PageSettings): { w: number; h: number } {
  let w: number, h: number;
  if (settings.size !== 'custom') {
    const d = PAGE_SIZE_DIMS[settings.size];
    w = d.w * MM_TO_PX; h = d.h * MM_TO_PX;
  } else {
    const scale = { mm: MM_TO_PX, cm: MM_TO_PX * 10, inch: 96, px: 1 }[settings.unit] ?? MM_TO_PX;
    w = (settings.customWidth ?? 210) * scale;
    h = (settings.customHeight ?? 297) * scale;
  }
  return settings.orientation === 'landscape' ? { w: h, h: w } : { w, h };
}

function getBgStyles(bg: PageBackground): CSSProperties {
  const filter = [
    bg.brightness !== 100 ? `brightness(${bg.brightness}%)` : '',
    bg.contrast !== 100 ? `contrast(${bg.contrast}%)` : '',
    bg.saturation !== 100 ? `saturate(${bg.saturation}%)` : '',
    bg.blur > 0 ? `blur(${bg.blur}px)` : '',
  ].filter(Boolean).join(' ');
  const baseOpacity = bg.opacity / 100;

  switch (bg.type) {
    case 'color':
      return { backgroundColor: bg.color, opacity: baseOpacity, filter: filter || undefined };
    case 'gradient': {
      const g = bg.gradient ?? { type: 'linear', color1: '#ffffff', color2: '#e2e8f0', angle: 180 };
      const grad = g.type === 'linear'
        ? `linear-gradient(${g.angle ?? 0}deg, ${g.color1}, ${g.color2})`
        : `radial-gradient(circle, ${g.color1}, ${g.color2})`;
      return { background: grad, opacity: baseOpacity, filter: filter || undefined };
    }
    case 'image':
      return {
        backgroundImage: bg.imageData ? `url(${bg.imageData})` : undefined,
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: baseOpacity, filter: filter || undefined,
      };
    case 'pattern':
    case 'texture': {
      const pc = bg.patternColor ?? '#94a3b8';
      const ps = bg.patternSize ?? 25;
      let bgImage = '';
      switch (bg.patternType) {
        case 'lines':
          bgImage = `repeating-linear-gradient(to bottom, transparent, transparent ${ps - 1}px, ${pc} ${ps - 1}px, ${pc} ${ps}px)`;
          break;
        case 'grid':
          bgImage = `repeating-linear-gradient(${pc} 0 1px, transparent 1px 100%), repeating-linear-gradient(90deg, ${pc} 0 1px, transparent 1px 100%)`;
          break;
        case 'dots':
          bgImage = `radial-gradient(circle, ${pc} 1.5px, transparent 1.5px)`;
          break;
        case 'triangles':
          bgImage = `repeating-linear-gradient(60deg, ${pc} 0, ${pc} 1px, transparent 0, transparent 50%), repeating-linear-gradient(-60deg, ${pc} 0, ${pc} 1px, transparent 0, transparent 50%)`;
          break;
        case 'music':
          bgImage = `repeating-linear-gradient(to bottom, ${pc} 0, ${pc} 1px, transparent 1px, transparent 8px, ${pc} 8px, ${pc} 9px, transparent 9px, transparent 17px, ${pc} 17px, ${pc} 18px, transparent 18px, transparent 26px, ${pc} 26px, ${pc} 27px, transparent 27px, transparent 35px, ${pc} 35px, ${pc} 36px, transparent 36px, transparent ${ps}px)`;
          break;
        case 'drawing':
          bgImage = `repeating-linear-gradient(${pc}40 0 1px, transparent 1px 100%), repeating-linear-gradient(90deg, ${pc}40 0 1px, transparent 1px 100%), repeating-linear-gradient(${pc} 0 1px, transparent 1px 100%), repeating-linear-gradient(90deg, ${pc} 0 1px, transparent 1px 100%)`;
          break;
        default:
          bgImage = '';
      }
      return {
        backgroundImage: bgImage || undefined,
        backgroundSize: bg.patternType === 'drawing' ? `${ps / 5}px ${ps / 5}px, ${ps / 5}px ${ps / 5}px, ${ps}px ${ps}px, ${ps}px ${ps}px` : `${ps}px ${ps}px`,
        backgroundColor: bg.color,
        opacity: baseOpacity, filter: filter || undefined,
      };
    }
    default:
      return { backgroundColor: '#ffffff' };
  }
}

function getPageTypeBg(bgType: string): CSSProperties {
  switch (bgType) {
    case 'lined':
      return { backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 24px, #93c5fd50 24px, #93c5fd50 25px)', backgroundSize: '100% 25px' };
    case 'grid':
      return { backgroundImage: 'repeating-linear-gradient(#93c5fd30 0 1px, transparent 1px 100%), repeating-linear-gradient(90deg, #93c5fd30 0 1px, transparent 1px 100%)', backgroundSize: '25px 25px' };
    case 'dots':
      return { backgroundImage: 'radial-gradient(circle, #93c5fd60 1px, transparent 1px)', backgroundSize: '25px 25px' };
    case 'geometric':
      return { backgroundImage: 'repeating-linear-gradient(60deg, #94a3b820 0, #94a3b820 1px, transparent 0, transparent 50%), repeating-linear-gradient(-60deg, #94a3b820 0, #94a3b820 1px, transparent 0, transparent 50%)', backgroundSize: '30px 52px' };
    case 'music':
      return { backgroundImage: 'repeating-linear-gradient(to bottom, #94a3b8 0, #94a3b8 1px, transparent 1px, transparent 8px, #94a3b8 8px, #94a3b8 9px, transparent 9px, transparent 17px, #94a3b8 17px, #94a3b8 18px, transparent 18px, transparent 26px, #94a3b8 26px, #94a3b8 27px, transparent 27px, transparent 35px, #94a3b8 35px, #94a3b8 36px, transparent 36px, transparent 55px)' };
    case 'drawing':
      return { backgroundImage: 'repeating-linear-gradient(#e2e8f0 0 1px, transparent 1px 100%), repeating-linear-gradient(90deg, #e2e8f0 0 1px, transparent 1px 100%), repeating-linear-gradient(#94a3b8 0 1px, transparent 1px 100%), repeating-linear-gradient(90deg, #94a3b8 0 1px, transparent 1px 100%)', backgroundSize: '5px 5px, 5px 5px, 25px 25px, 25px 25px' };
    default:
      return {};
  }
}

function getStickerSvg(stickerId: string, color: string): string {
  if (stickerId.startsWith('custom:')) return '';
  const def = PREDEFINED_STICKERS.find(s => s.id === stickerId);
  if (!def) return '';
  return def.svg.replace(/currentColor/g, color);
}

function getFieldLabel(fieldKey: string): string {
  const def = DYNAMIC_FIELDS.find(f => f.key === fieldKey);
  return def ? `[${def.label}]` : `[${fieldKey}]`;
}

// ─── Element Renderer ─────────────────────────────────────────────────────────

interface ERProps {
  el: DesignerElement;
  selected: boolean;
  multiSelected: boolean;
  editing: boolean;
  zoom: number;
  onMouseDown: (e: React.MouseEvent, el: DesignerElement) => void;
  onDoubleClick: (el: DesignerElement) => void;
  onContentChange: (id: string, content: string) => void;
}

function ElementRenderer({ el, selected, multiSelected, editing, zoom, onMouseDown, onDoubleClick, onContentChange }: ERProps) {
  const isHidden = !el.visible;
  if (isHidden) return null;

  const base: CSSProperties = {
    position: 'absolute',
    left: `${el.x}%`, top: `${el.y}%`,
    width: `${el.width}%`, height: `${el.height}%`,
    transform: `rotate(${el.rotation}deg)`,
    transformOrigin: 'center center',
    opacity: el.opacity / 100,
    zIndex: el.zIndex,
    cursor: el.locked ? 'not-allowed' : 'move',
    userSelect: 'none',
    outline: selected ? '2px solid #3b82f6' : multiSelected ? '1px dashed #3b82f6' : 'none',
    outlineOffset: '1px',
    boxSizing: 'border-box',
  };

  const handleMD = (e: React.MouseEvent) => { if (!el.locked) onMouseDown(e, el); };
  const handleDC = () => { if (!el.locked) onDoubleClick(el); };

  switch (el.type) {
    case 'text':
    case 'heading':
    case 'subheading': {
      const t = el as TextElement;
      const fs = t.fontSize * (zoom / 100);
      return (
        <div style={{
          ...base,
          fontSize: fs,
          fontFamily: t.fontFamily,
          fontWeight: t.fontWeight,
          fontStyle: t.fontStyle,
          textDecoration: t.textDecoration,
          textAlign: t.textAlign,
          color: t.color,
          backgroundColor: t.backgroundColor ?? 'transparent',
          borderColor: t.borderColor ?? 'transparent',
          borderWidth: t.borderWidth ?? 0,
          borderStyle: 'solid',
          borderRadius: t.borderRadius ?? 0,
          padding: t.padding ?? 4,
          lineHeight: t.lineHeight ?? 1.5,
          direction: t.direction,
          overflow: 'hidden',
          filter: t.shadow ? 'drop-shadow(1px 2px 3px rgba(0,0,0,0.3))' : undefined,
          display: 'flex', alignItems: 'center',
        }} onMouseDown={handleMD} onDoubleClick={handleDC}>
          {editing ? (
            <textarea
              autoFocus
              defaultValue={t.content}
              style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit', fontStyle: 'inherit', textAlign: 'inherit', color: 'inherit', direction: 'inherit', padding: 0 }}
              onChange={e => onContentChange(el.id, e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span style={{ width: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{t.content}</span>
          )}
        </div>
      );
    }

    case 'rect': {
      const s = el as ShapeElement;
      const shadow = s.shadow ? '2px 4px 8px rgba(0,0,0,0.25)' : undefined;
      const bg = s.gradient
        ? (s.gradient.type === 'linear'
          ? `linear-gradient(${s.gradient.angle ?? 0}deg, ${s.gradient.color1}, ${s.gradient.color2})`
          : `radial-gradient(circle, ${s.gradient.color1}, ${s.gradient.color2})`)
        : s.fill;
      return (
        <div style={{ ...base, background: bg, border: `${s.strokeWidth}px solid ${s.stroke}`, borderRadius: s.borderRadius ?? 0, boxShadow: shadow }}
          onMouseDown={handleMD} />
      );
    }

    case 'circle': {
      const s = el as ShapeElement;
      return (
        <div style={{ ...base, background: s.fill, border: `${s.strokeWidth}px solid ${s.stroke}`, borderRadius: '50%', boxShadow: s.shadow ? '2px 4px 8px rgba(0,0,0,0.25)' : undefined }}
          onMouseDown={handleMD} />
      );
    }

    case 'triangle':
    case 'star': {
      const s = el as ShapeElement;
      const pts = el.type === 'triangle'
        ? '50,2 98,98 2,98'
        : '50,2 61,35 98,35 68,57 79,97 50,75 21,97 32,57 2,35 39,35';
      return (
        <div style={base} onMouseDown={handleMD}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible', filter: s.shadow ? 'drop-shadow(2px 4px 6px rgba(0,0,0,0.25))' : undefined }}>
            {s.gradient ? (
              <>
                <defs>
                  <linearGradient id={`g-${el.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={s.gradient.color1} />
                    <stop offset="100%" stopColor={s.gradient.color2} />
                  </linearGradient>
                </defs>
                <polygon points={pts} fill={`url(#g-${el.id})`} stroke={s.stroke} strokeWidth={s.strokeWidth} />
              </>
            ) : (
              <polygon points={pts} fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeWidth} />
            )}
          </svg>
        </div>
      );
    }

    case 'line':
    case 'arrow': {
      const l = el as LineElement;
      return (
        <div style={{ ...base, overflow: 'visible' }} onMouseDown={handleMD}>
          <svg width="100%" height="100%" overflow="visible" style={{ position: 'absolute', inset: 0 }}>
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke={l.stroke} strokeWidth={l.strokeWidth} strokeDasharray={l.strokeDash ? '8,4' : undefined} />
            {(el.type === 'arrow' || l.arrowEnd) && (
              <polygon points="100%,50% calc(100% - 10px),40% calc(100% - 10px),60%" fill={l.stroke} />
            )}
            {l.arrowStart && (
              <polygon points="0%,50% 10px,40% 10px,60%" fill={l.stroke} />
            )}
          </svg>
        </div>
      );
    }

    case 'image': {
      const img = el as ImageElement;
      const filterStr = [
        img.brightness !== undefined ? `brightness(${img.brightness}%)` : '',
        img.contrast !== undefined ? `contrast(${img.contrast}%)` : '',
        img.saturation !== undefined ? `saturate(${img.saturation}%)` : '',
        img.blur && img.blur > 0 ? `blur(${img.blur}px)` : '',
      ].filter(Boolean).join(' ');
      return (
        <div style={{ ...base, overflow: 'hidden', borderRadius: img.borderRadius ?? 0, boxShadow: img.shadow ? '2px 4px 8px rgba(0,0,0,0.3)' : undefined }}
          onMouseDown={handleMD}>
          {img.src ? (
            <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: img.objectFit, filter: filterStr || undefined }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
              صورة
            </div>
          )}
        </div>
      );
    }

    case 'table': {
      const tbl = el as TableElement;
      const cellW = tbl.width / tbl.cols;
      return (
        <div style={{ ...base, overflow: 'hidden', direction: tbl.direction }} onMouseDown={handleMD}>
          <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: tbl.fontSize * (zoom / 100) }}>
            <tbody>
              {Array.from({ length: tbl.rows }, (_, ri) => (
                <tr key={ri}>
                  {Array.from({ length: tbl.cols }, (_, ci) => {
                    const cell = tbl.cells?.[ri]?.[ci] ?? { content: '' };
                    const isHeader = tbl.hasHeader && ri === 0;
                    return (
                      <td key={ci} style={{
                        border: `1px solid ${tbl.borderColor}`,
                        background: isHeader ? tbl.headerBg : (cell.bg ?? tbl.cellBg),
                        color: isHeader ? tbl.headerTextColor : (cell.color ?? tbl.cellTextColor),
                        fontWeight: isHeader ? 'bold' : (cell.bold ? 'bold' : 'normal'),
                        textAlign: cell.align ?? (tbl.direction === 'rtl' ? 'right' : 'left'),
                        padding: '2px 4px',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}>
                        {cell.content}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'sticker':
    case 'frame':
    case 'stamp': {
      const stk = el as StickerElement;
      const svgHtml = getStickerSvg(stk.stickerId, stk.color);
      return (
        <div style={{
          ...base, display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: stk.shadow ? 'drop-shadow(2px 4px 6px rgba(0,0,0,0.4))' : stk.glow ? `drop-shadow(0 0 6px ${stk.color})` : undefined,
        }} onMouseDown={handleMD}>
          {svgHtml
            ? <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svgHtml }} />
            : <div style={{ width: '100%', height: '100%', background: stk.color, borderRadius: '4px', opacity: 0.7 }} />}
          {stk.text && (
            <span style={{ position: 'absolute', fontSize: `${8 * zoom / 100}px`, color: stk.textColor ?? '#fff', fontWeight: 'bold', textAlign: 'center', direction: 'rtl' }}>
              {stk.text}
            </span>
          )}
        </div>
      );
    }

    case 'dynamic-field': {
      const df = el as DynamicFieldElement;
      return (
        <div style={{
          ...base,
          fontSize: df.fontSize * (zoom / 100),
          fontFamily: df.fontFamily,
          fontWeight: df.fontWeight,
          color: df.color,
          backgroundColor: df.backgroundColor ?? '#f0f9ff',
          borderColor: df.borderColor ?? '#3b82f6',
          borderWidth: df.borderWidth ?? 1,
          borderStyle: 'dashed',
          borderRadius: df.borderRadius ?? 4,
          padding: df.padding ?? 4,
          textAlign: df.textAlign,
          direction: df.direction,
          display: 'flex', alignItems: 'center',
        }} onMouseDown={handleMD}>
          <span style={{ width: '100%', opacity: 0.7 }}>{getFieldLabel(df.fieldKey)}</span>
        </div>
      );
    }

    case 'smart-zone': {
      const zone = el as SmartZoneElement;
      const zoneDef = SMART_ZONE_DEFS[zone.purpose] ?? SMART_ZONE_DEFS.questions;
      return (
        <div style={{
          ...base,
          backgroundColor: zone.backgroundColor || zoneDef.color + '30',
          borderColor: zone.borderColor,
          borderWidth: zone.borderWidth ?? 1,
          borderStyle: zone.borderStyle === 'none' ? undefined : zone.borderStyle,
          borderRadius: 6,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        }} onMouseDown={handleMD}>
          <span style={{ fontSize: 18 * zoom / 100 }}>{zoneDef.icon}</span>
          <span style={{ fontSize: 9 * zoom / 100, color: zone.borderColor, fontWeight: 600, direction: 'rtl' }}>
            {zone.label || zoneDef.label}
          </span>
          {zone.numberingStyle && zone.numberingStyle !== 'none' && (
            <span style={{ fontSize: 8 * zoom / 100, color: zone.borderColor, opacity: 0.7, direction: 'rtl' }}>
              ترقيم: {formatQuestionNumber(0, zone.numberingStyle, zone.numberingStart ?? 1)}{zone.numberingSuffix ?? ') '}…
            </span>
          )}
        </div>
      );
    }

    case 'deco-frame': {
      const df = el as DecoFrameElement;
      if (df.imageSrc) {
        // إطار مخصص من صورة مرفوعة
        return (
          <div style={{ ...base, overflow: 'hidden' }} onMouseDown={handleMD}>
            <img src={df.imageSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }} />
          </div>
        );
      }
      const svgStr = renderFrameSvg(df.frameId, {
        primary: df.primaryColor,
        secondary: df.secondaryColor,
        accent: df.accentColor,
      }, df.labelText);
      return (
        <div style={{ ...base, overflow: 'visible' }} onMouseDown={handleMD}>
          {svgStr
            ? <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svgStr }} />
            : <div style={{ width: '100%', height: '100%', background: df.primaryColor + '30', border: `2px dashed ${df.primaryColor}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: df.primaryColor }}>إطار زخرفي</div>
          }
        </div>
      );
    }

    default: return null;
  }
}

// ─── Selection Handles ────────────────────────────────────────────────────────

function SelectionHandles({ el, onHandleMouseDown }: {
  el: DesignerElement;
  onHandleMouseDown: (e: React.MouseEvent, handle: string) => void;
}) {
  const handles = [
    { id: 'nw', x: 0, y: 0 }, { id: 'n', x: 50, y: 0 }, { id: 'ne', x: 100, y: 0 },
    { id: 'e', x: 100, y: 50 }, { id: 'se', x: 100, y: 100 }, { id: 's', x: 50, y: 100 },
    { id: 'sw', x: 0, y: 100 }, { id: 'w', x: 0, y: 50 },
  ];

  const cursors: Record<string, string> = {
    nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize',
    se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize',
  };

  return (
    <div style={{
      position: 'absolute', left: `${el.x}%`, top: `${el.y}%`,
      width: `${el.width}%`, height: `${el.height}%`,
      transform: `rotate(${el.rotation}deg)`, transformOrigin: 'center center',
      pointerEvents: 'none', zIndex: 9999,
    }}>
      {/* Rotate handle */}
      <div
        style={{
          position: 'absolute', left: '50%', top: -20, transform: 'translateX(-50%)',
          width: 10, height: 10, borderRadius: '50%',
          background: '#3b82f6', border: '2px solid white', cursor: 'grab', pointerEvents: 'all',
        }}
        onMouseDown={e => { e.stopPropagation(); onHandleMouseDown(e, 'rotate'); }}
      />
      {/* Line to rotate handle */}
      <div style={{ position: 'absolute', left: '50%', top: -14, width: 1, height: 14, background: '#3b82f6', transform: 'translateX(-50%)' }} />

      {/* Resize handles */}
      {handles.map(h => (
        <div key={h.id}
          style={{
            position: 'absolute',
            left: `${h.x}%`, top: `${h.y}%`,
            transform: 'translate(-50%, -50%)',
            width: 8, height: 8, borderRadius: 2,
            background: 'white', border: '2px solid #3b82f6',
            cursor: cursors[h.id], pointerEvents: 'all', zIndex: 9999,
          }}
          onMouseDown={e => { e.stopPropagation(); onHandleMouseDown(e, h.id); }}
        />
      ))}
    </div>
  );
}

// ─── Drawing Preview ──────────────────────────────────────────────────────────

function DrawingPreview({ tool, x, y, w, h }: { tool: ToolType; x: number; y: number; w: number; h: number }) {
  const base: CSSProperties = {
    position: 'absolute', left: `${x}%`, top: `${y}%`,
    width: `${w}%`, height: `${h}%`, pointerEvents: 'none',
    border: '2px dashed #3b82f6', zIndex: 9998,
  };
  switch (tool) {
    case 'circle': return <div style={{ ...base, borderRadius: '50%' }} />;
    case 'line': case 'arrow': return <div style={{ ...base, border: 'none', borderTop: '2px dashed #3b82f6' }} />;
    default: return <div style={base} />;
  }
}

// ─── Main DesignerCanvas ──────────────────────────────────────────────────────

interface Props {
  state: DesignerState;
  dispatch: React.Dispatch<DesignerAction>;
  onOpenImageImporter: () => void;
}

type MouseOp =
  | { kind: 'idle' }
  | { kind: 'drawing'; startX: number; startY: number; curX: number; curY: number }
  | { kind: 'moving'; startClientX: number; startClientY: number; origPositions: Array<{ id: string; x: number; y: number }> }
  | { kind: 'resizing'; startClientX: number; startClientY: number; handle: string; origEl: DesignerElement }
  | { kind: 'rotating'; startClientX: number; startClientY: number; origEl: DesignerElement; centerX: number; centerY: number };

export default function DesignerCanvas({ state, dispatch, onOpenImageImporter }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const op = useRef<MouseOp>({ kind: 'idle' });
  const [drawPrev, setDrawPrev] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const page = state.pages[state.currentPageIndex];
  if (!page) return null;
  const settings = page.settings;
  const base = getPageBasePx(settings);
  const scale = state.zoom / 100;
  const pageW = base.w * scale;
  const pageH = base.h * scale;
  const margin = page.settings.margins;

  const getPageCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    if (!pageRef.current) return { x: 0, y: 0 };
    const rect = pageRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  const makeNewElement = (tool: ToolType, x: number, y: number, w: number, h: number): DesignerElement | null => {
    if (tool === 'image') { onOpenImageImporter(); return null; }
    const id = crypto.randomUUID();
    const zIndex = (page.elements.length ?? 0);
    const base2 = { id, x, y, width: Math.max(w, 2), height: Math.max(h, 0.5), rotation: 0, opacity: 100, locked: false, visible: true, printable: true, zIndex, version: 1 };
    switch (tool) {
      case 'text':       return { ...base2, type: 'text', name: 'نص', content: 'انقر للتعديل', fontSize: 14, fontFamily: 'inherit', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', textAlign: 'right', color: '#1a1a1a', direction: 'rtl' };
      case 'heading':    return { ...base2, type: 'heading', name: 'عنوان', content: 'عنوان', fontSize: 22, fontFamily: 'inherit', fontWeight: 'bold', fontStyle: 'normal', textDecoration: 'none', textAlign: 'right', color: '#0f172a', direction: 'rtl' };
      case 'subheading': return { ...base2, type: 'subheading', name: 'عنوان فرعي', content: 'عنوان فرعي', fontSize: 16, fontFamily: 'inherit', fontWeight: 'bold', fontStyle: 'normal', textDecoration: 'none', textAlign: 'right', color: '#334155', direction: 'rtl' };
      case 'rect':       return { ...base2, type: 'rect', name: 'مستطيل', fill: '#e2e8f0', stroke: '#64748b', strokeWidth: 1 };
      case 'circle':     return { ...base2, type: 'circle', name: 'دائرة', fill: '#dbeafe', stroke: '#3b82f6', strokeWidth: 1 };
      case 'triangle':   return { ...base2, type: 'triangle', name: 'مثلث', fill: '#fef3c7', stroke: '#d97706', strokeWidth: 1 };
      case 'star':       return { ...base2, type: 'star', name: 'نجمة', fill: '#fef3c7', stroke: '#f59e0b', strokeWidth: 1 };
      case 'line':       return { ...base2, type: 'line', name: 'خط', stroke: '#334155', strokeWidth: 2, height: 0.5 };
      case 'arrow':      return { ...base2, type: 'arrow', name: 'سهم', stroke: '#334155', strokeWidth: 2, arrowEnd: true, height: 0.5 };
      case 'table': {
        const rows = 3; const cols = 3;
        return { ...base2, type: 'table', name: 'جدول', rows, cols, hasHeader: true, cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ content: '' }))), headerBg: '#1e40af', cellBg: '#ffffff', borderColor: '#334155', headerTextColor: '#ffffff', cellTextColor: '#1a1a1a', fontSize: 12, direction: 'rtl' };
      }
      case 'sticker':  return { ...base2, type: 'sticker', name: 'ملصق', stickerId: 'important', color: '#ef4444', width: 8, height: 8 };
      case 'frame':    return { ...base2, type: 'frame', name: 'إطار', stickerId: 'seal', color: '#6366f1' };
      case 'stamp':    return { ...base2, type: 'stamp', name: 'ختم', stickerId: 'seal', color: '#dc2626' };
      case 'dynamic-field': return { ...base2, type: 'dynamic-field', name: 'حقل ديناميكي', fieldKey: 'project.name', fieldLabel: 'اسم المشروع', defaultValue: '', fontSize: 12, fontFamily: 'inherit', fontWeight: 'normal', color: '#1a1a1a', textAlign: 'right', direction: 'rtl' };
      case 'smart-zone': return { ...base2, type: 'smart-zone', name: 'منطقة ذكية', purpose: 'questions', allowedTypes: [], borderStyle: 'dashed', backgroundColor: '#dbeafe20', borderColor: '#3b82f6', borderWidth: 1 };
      default: return null;
    }
  };

  const handlePageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== pageRef.current && !(e.target as HTMLElement).closest('[data-page-bg]')) {
      return; // Clicked on an element, handled elsewhere
    }
    if (e.button !== 0) return;
    dispatch({ type: 'SELECT', ids: [] });
    setEditingId(null);
    const { x, y } = getPageCoords(e.clientX, e.clientY);
    if (state.activeTool !== 'select' && state.activeTool !== 'move') {
      dispatch({ type: 'PUSH_HISTORY' });
      op.current = { kind: 'drawing', startX: x, startY: y, curX: x, curY: y };
      setDrawPrev({ x, y, w: 0, h: 0 });
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, el: DesignerElement) => {
    if (el.locked || (state.activeTool !== 'select' && state.activeTool !== 'move')) return;
    e.stopPropagation();
    if (!e.shiftKey) dispatch({ type: 'SELECT', ids: [el.id] });
    else dispatch({ type: 'SELECT', ids: state.selectedIds.includes(el.id) ? state.selectedIds.filter(x => x !== el.id) : [...state.selectedIds, el.id] });
    dispatch({ type: 'PUSH_HISTORY' });
    const origPositions = (e.shiftKey ? [...state.selectedIds, el.id] : [el.id]).map(id => {
      const found = page.elements.find(e => e.id === id)!;
      return { id, x: found?.x ?? 0, y: found?.y ?? 0 };
    });
    op.current = { kind: 'moving', startClientX: e.clientX, startClientY: e.clientY, origPositions };
  };

  const handleHandleMouseDown = (e: React.MouseEvent, handle: string) => {
    const el = page.elements.find(e => state.selectedIds.includes(e.id));
    if (!el) return;
    e.stopPropagation();
    dispatch({ type: 'PUSH_HISTORY' });
    if (handle === 'rotate') {
      const rect = pageRef.current!.getBoundingClientRect();
      const elCx = rect.left + (el.x + el.width / 2) / 100 * rect.width;
      const elCy = rect.top + (el.y + el.height / 2) / 100 * rect.height;
      op.current = { kind: 'rotating', startClientX: e.clientX, startClientY: e.clientY, origEl: { ...el }, centerX: elCx, centerY: elCy };
    } else {
      op.current = { kind: 'resizing', startClientX: e.clientX, startClientY: e.clientY, handle, origEl: { ...el } };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const o = op.current;
    if (!pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const { x, y } = getPageCoords(e.clientX, e.clientY);
    setCursorPos({ x: Math.round(x), y: Math.round(y) });

    if (o.kind === 'drawing') {
      const nx = Math.min(x, o.startX), ny = Math.min(y, o.startY);
      const nw = Math.abs(x - o.startX), nh = Math.abs(y - o.startY);
      op.current = { ...o, curX: x, curY: y };
      setDrawPrev({ x: nx, y: ny, w: nw, h: nw > 0 || nh > 0 ? nh : 0 });
    } else if (o.kind === 'moving') {
      const dxPct = ((e.clientX - o.startClientX) / rect.width) * 100;
      const dyPct = ((e.clientY - o.startClientY) / rect.height) * 100;
      o.origPositions.forEach(({ id, x: ox, y: oy }) => {
        dispatch({ type: 'UPDATE_ELEMENT', id, changes: { x: Math.max(0, Math.min(90, ox + dxPct)), y: Math.max(0, Math.min(90, oy + dyPct)) } });
      });
    } else if (o.kind === 'resizing') {
      const el = o.origEl;
      const dxPct = ((e.clientX - o.startClientX) / rect.width) * 100;
      const dyPct = ((e.clientY - o.startClientY) / rect.height) * 100;
      const h = o.handle;
      let { x: nx, y: ny, width: nw, height: nh } = el;
      if (h.includes('e')) nw = Math.max(2, el.width + dxPct);
      if (h.includes('s')) nh = Math.max(1, el.height + dyPct);
      if (h.includes('w')) { nx = el.x + dxPct; nw = Math.max(2, el.width - dxPct); }
      if (h.includes('n')) { ny = el.y + dyPct; nh = Math.max(1, el.height - dyPct); }
      dispatch({ type: 'UPDATE_ELEMENT', id: el.id, changes: { x: nx, y: ny, width: nw, height: nh } });
    } else if (o.kind === 'rotating') {
      const el = o.origEl;
      const angle = Math.atan2(e.clientY - o.centerY, e.clientX - o.centerX) * (180 / Math.PI);
      dispatch({ type: 'UPDATE_ELEMENT', id: el.id, changes: { rotation: Math.round(angle + 90) } });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const o = op.current;
    if (o.kind === 'drawing' && drawPrev) {
      const { x: dx, y: dy, w: dw, h: dh } = drawPrev;
      if (dw > 0.5 || dh > 0.5) {
        const newEl = makeNewElement(state.activeTool, dx, dy, dw, Math.max(dh, 0.5));
        if (newEl) { dispatch({ type: 'ADD_ELEMENT', element: newEl }); setEditingId(newEl.id); }
      } else if (dw < 0.5 && dh < 0.5) {
        // Single click = place at default size
        const newEl = makeNewElement(state.activeTool, o.startX - 10, o.startY - 5, 20, 10);
        if (newEl) { dispatch({ type: 'ADD_ELEMENT', element: newEl }); setEditingId(newEl.id); }
      }
      setDrawPrev(null);
    }
    op.current = { kind: 'idle' };
  };

  const handleDoubleClick = (el: DesignerElement) => {
    if (el.type === 'text' || el.type === 'heading' || el.type === 'subheading') {
      setEditingId(el.id);
    }
  };

  const handleContentChange = (id: string, content: string) => {
    dispatch({ type: 'UPDATE_ELEMENT', id, changes: { content } as any });
  };

  const selectedEl = state.selectedIds.length === 1
    ? page.elements.find(e => e.id === state.selectedIds[0])
    : null;

  const bgStyle = getBgStyles(page.background);
  const pageTypeBgStyle = getPageTypeBg(settings.backgroundType);
  const marginStyle: CSSProperties = {
    position: 'absolute',
    top: `${margin.top / (settings.orientation === 'portrait' ? (PAGE_SIZE_DIMS[settings.size]?.h ?? 297) : (PAGE_SIZE_DIMS[settings.size]?.w ?? 210)) * 100}%`,
    bottom: `${margin.bottom / (settings.orientation === 'portrait' ? (PAGE_SIZE_DIMS[settings.size]?.h ?? 297) : (PAGE_SIZE_DIMS[settings.size]?.w ?? 210)) * 100}%`,
    left: `${margin.left / (settings.orientation === 'portrait' ? (PAGE_SIZE_DIMS[settings.size]?.w ?? 210) : (PAGE_SIZE_DIMS[settings.size]?.h ?? 297)) * 100}%`,
    right: `${margin.right / (settings.orientation === 'portrait' ? (PAGE_SIZE_DIMS[settings.size]?.w ?? 210) : (PAGE_SIZE_DIMS[settings.size]?.h ?? 297)) * 100}%`,
    border: '1px dashed #94a3b840',
    pointerEvents: 'none',
  };

  return (
    <div
      ref={viewportRef}
      className="flex-1 overflow-auto bg-[#1a1a2e] flex items-start justify-center"
      style={{ padding: 48 }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Page */}
      <div
        ref={pageRef}
        data-page-bg="true"
        onMouseDown={handlePageMouseDown}
        style={{
          position: 'relative',
          width: pageW,
          height: pageH,
          background: '#ffffff',
          boxShadow: '0 4px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)',
          flexShrink: 0,
          overflow: 'hidden',
          cursor: state.activeTool === 'select' ? 'default' : 'crosshair',
          userSelect: 'none',
        }}
      >
        {/* Page type background */}
        <div style={{ position: 'absolute', inset: 0, ...pageTypeBgStyle, pointerEvents: 'none' }} />

        {/* Overlay background */}
        <div style={{ position: 'absolute', inset: 0, ...bgStyle, pointerEvents: 'none' }} />

        {/* Margin guides */}
        {state.showRulers && <div style={marginStyle} />}

        {/* Elements */}
        {page.elements.map(el => (
          <ElementRenderer
            key={el.id}
            el={el}
            selected={state.selectedIds.length === 1 && state.selectedIds[0] === el.id}
            multiSelected={state.selectedIds.length > 1 && state.selectedIds.includes(el.id)}
            editing={editingId === el.id}
            zoom={state.zoom}
            onMouseDown={handleElementMouseDown}
            onDoubleClick={handleDoubleClick}
            onContentChange={handleContentChange}
          />
        ))}

        {/* Selection handles */}
        {selectedEl && (
          <SelectionHandles el={selectedEl} onHandleMouseDown={handleHandleMouseDown} />
        )}

        {/* Drawing preview */}
        {drawPrev && drawPrev.w > 0.1 && (
          <DrawingPreview tool={state.activeTool} x={drawPrev.x} y={drawPrev.y} w={drawPrev.w} h={drawPrev.h} />
        )}
      </div>

      {/* Bottom status */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 24,
        background: '#1e1e2e', borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 16, padding: '0 12px',
        fontSize: 10, color: 'rgba(255,255,255,0.4)', direction: 'rtl',
        zIndex: 30, fontFamily: 'monospace',
      }}>
        <span>الصفحة: {state.currentPageIndex + 1} / {state.pages.length}</span>
        <span>|</span>
        <span>العناصر: {page.elements.length}</span>
        <span>|</span>
        <span>المحدد: {state.selectedIds.length}</span>
        <span>|</span>
        <span>X: {cursorPos.x}% Y: {cursorPos.y}%</span>
        <span>|</span>
        <span>التكبير: {state.zoom}%</span>
        {state.isDirty && <><span>|</span><span style={{ color: '#f59e0b' }}>● غير محفوظ</span></>}
      </div>
    </div>
  );
}
