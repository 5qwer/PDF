/**
 * Types for the Advanced Document Understanding Engine
 * Phase 1: Geometric Model  |  Phase 2: Element Analysis
 */

export interface BoundingBox {
  x: number;      // in PDF point units (page coord system, top-left origin)
  y: number;
  width: number;
  height: number;
}

export type ElementType =
  | 'text'         // text span / line
  | 'text-block'   // clustered text region (paragraph, question stem, etc.)
  | 'image'        // raster image
  | 'drawing'      // vector path / shape
  | 'line'         // horizontal/vertical rule
  | 'frame'        // rectangular border
  | 'table-cell';  // reserved

export interface FontInfo {
  fontName?: string;
  fontFamily?: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  italic: boolean;
  color?: string;         // hex
  direction: 'rtl' | 'ltr';
}

export interface PageElement {
  id: string;
  type: ElementType;
  bbox: BoundingBox;
  rotation: number;       // degrees
  scale: number;
  baseline?: number;      // y-baseline for text
  text?: string;
  font?: FontInfo;
  /** children element ids for text-block / frame */
  childIds?: string[];
  /** parent element id */
  parentId?: string;
  /** source: 'pdf' extracted, 'ocr' recognized */
  source: 'pdf' | 'ocr' | 'derived';
  /** raw pdf.js item index or path info */
  raw?: unknown;
}

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface WhitespaceGap {
  /** 'h' = horizontal band (row of whitespace), 'v' = vertical column of whitespace */
  axis: 'h' | 'v';
  start: number;
  end: number;
  size: number;
}

export interface ColumnInfo {
  index: number;
  x: number;
  width: number;
  /** ids of elements assigned to this column */
  elementIds: string[];
}

export interface PageGeometry {
  pageNumber: number;
  width: number;               // pt
  height: number;              // pt
  rotation: number;            // 0/90/180/270
  orientation: 'portrait' | 'landscape';
  margins: PageMargins;
  columnCount: number;
  columns: ColumnInfo[];
  /** Whitespace gaps larger than a threshold — used for logical segmentation */
  whitespace: WhitespaceGap[];
  /** IDs of elements that look like page-header / footer / page-number / watermark */
  headerIds: string[];
  footerIds: string[];
  pageNumberIds: string[];
  watermarkIds: string[];
  /** whether the page contained no extractable text (candidate for OCR) */
  isScanned: boolean;
}

export interface PageAnalysis {
  geometry: PageGeometry;
  elements: PageElement[];
  /** Root ids in reading order */
  rootIds: string[];
  /** Rendering DPR used to convert canvas <-> pt */
  scale: number;
}

export interface DocumentAnalysis {
  docId: number;
  fileName: string;
  totalPages: number;
  pages: PageAnalysis[];
  createdAt: number;
}
