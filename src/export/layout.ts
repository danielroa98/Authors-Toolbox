import { WIDTHS } from "./widths";
import { labels, roundedWords } from "./manuscript";
import type { ExportOptions, Manuscript, Run } from "./manuscript";

/* ======================================================================
   PAGE LAYOUT — wraps the manuscript into pages and lines using the metrics of the
   PDF standard fonts. The PDF writer prints this layout; the preview draws it.
   Units are PDF points (1/72 in), origin at the top-left of the page.
   ====================================================================== */

export type FontKey = "r" | "b" | "i" | "bi";

export interface Segment { text: string; font: FontKey; x: number; width: number }
export interface Line { y: number; segments: Segment[]; /** extra points added to each space (justified lines) */ wordSpace: number }
export interface Page { lines: Line[] }
export interface PageLayout {
  width: number; height: number; size: number;
  fonts: Record<FontKey, string>;
  pages: Page[];
}

export const PAGE_PT = { letter: { w: 612, h: 792 }, a4: { w: 595.28, h: 841.89 } } as const;
const MARGIN = 72, INDENT = 36, SIZE = 12;

export const FONT_FAMILY: Record<ExportOptions["font"], Record<FontKey, string>> = {
  times: { r: "Times-Roman", b: "Times-Bold", i: "Times-Italic", bi: "Times-BoldItalic" },
  arial: { r: "Helvetica", b: "Helvetica-Bold", i: "Helvetica-Oblique", bi: "Helvetica-BoldOblique" },
  courier: { r: "Courier", b: "Courier-Bold", i: "Courier-Oblique", bi: "Courier-BoldOblique" },
};

/** Unicode characters of Windows-1252 (WinAnsiEncoding) in the 0x80–0x9F range. */
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
/** Common characters outside WinAnsi, replaced by close equivalents. */
const FALLBACK: Record<string, string> = { "―": "—", "‒": "–", "‑": "-", " ": " ", " ": " ", " ": " ", "′": "'", "″": "\"", "−": "-" };

/** Text as WinAnsi byte codes (characters outside it become "?"). */
export function winAnsi(s: string): number[] {
  const out: number[] = [];
  for (const ch0 of s) {
    const ch = FALLBACK[ch0] ?? ch0;
    const c = ch.codePointAt(0) ?? 63;
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) out.push(c);
    else out.push(CP1252[c] ?? 63);
  }
  return out;
}

export function textWidth(s: string, fontName: string, size: number): number {
  const w = WIDTHS[fontName];
  let total = 0;
  for (const code of winAnsi(s)) total += w ? (code >= 32 ? w[code - 32] || 0 : 0) : 600;
  return (total * size) / 1000;
}

const fontKey = (r: Run): FontKey => (r.b && r.i ? "bi" : r.b ? "b" : r.i ? "i" : "r");

interface Word { pieces: { text: string; font: FontKey }[]; width: number; spaceAfter: boolean }

/** Break runs into words; a word may mix styles ("*pre*fix"). */
function toWords(runs: Run[], fonts: Record<FontKey, string>): Word[] {
  const out: Word[] = [];
  let cur: Word | null = null;
  for (const r of runs) {
    const f = fontKey(r);
    for (const tok of r.text.split(/( +)/)) {
      if (!tok) continue;
      if (/^ +$/.test(tok)) { if (cur) { cur.spaceAfter = true; cur = null; } continue; }
      if (!cur) { cur = { pieces: [], width: 0, spaceAfter: false }; out.push(cur); }
      cur.pieces.push({ text: tok, font: f });
      cur.width += textWidth(tok, fonts[f], SIZE);
    }
  }
  return out;
}

export function layoutManuscript(ms: Manuscript, o: ExportOptions): PageLayout {
  const L = labels(o.lang);
  const { w: W, h: H } = PAGE_PT[o.page];
  const fonts = FONT_FAMILY[o.font];
  const lineH = SIZE * 1.15 * o.spacing, singleH = SIZE * 1.15;
  const textW = W - 2 * MARGIN, bottom = H - MARGIN;
  const contest = o.layout === "contest";
  const pages: Page[] = [{ lines: [] }];
  let y = MARGIN;   // top of the next line
  const page = () => pages[pages.length - 1];
  const newPage = () => { pages.push({ lines: [] }); y = MARGIN; };
  const spaceW = (f: FontKey) => textWidth(" ", fonts[f], SIZE);

  /** Lay out one paragraph. Returns nothing; advances y. */
  const paragraph = (runs: Run[], opt: { align: "left" | "center" | "right" | "justify"; indent?: number; left?: number; height?: number; keepWithNext?: boolean }) => {
    const h = opt.height ?? lineH;
    const left = MARGIN + (opt.left ?? 0);
    const width = textW - (opt.left ?? 0);
    const ws = toWords(runs, fonts);
    if (!ws.length) { y += h; return; }
    const lines: Word[][] = [];
    let cur: Word[] = [], curW = 0, first = true;
    for (const w of ws) {
      const avail = width - (first ? opt.indent ?? 0 : 0);
      const add = (cur.length ? spaceW(cur[cur.length - 1].pieces[cur[cur.length - 1].pieces.length - 1].font) : 0) + w.width;
      if (cur.length && curW + add > avail) { lines.push(cur); cur = []; curW = 0; first = false; }
      curW += cur.length ? add : w.width;
      cur.push(w);
    }
    if (cur.length) lines.push(cur);
    // keep a heading on the same page as the line after it
    if (opt.keepWithNext && y + h * (lines.length + 1) > bottom && page().lines.length) newPage();
    lines.forEach((lw, k) => {
      if (y + h > bottom + 0.01 && page().lines.length) newPage();
      const indent = k === 0 ? opt.indent ?? 0 : 0;
      const avail = width - indent;
      const natural = lw.reduce((t, w, j) => t + w.width + (j < lw.length - 1 ? spaceW(w.pieces[w.pieces.length - 1].font) : 0), 0);
      const gaps = lw.length - 1;
      const last = k === lines.length - 1;
      let x = left + indent, wordSpace = 0;
      if (opt.align === "center") x = left + (width - natural) / 2;
      else if (opt.align === "right") x = left + width - natural;
      else if (opt.align === "justify" && !last && gaps > 0) wordSpace = (avail - natural) / gaps;
      const segs: Segment[] = [];
      lw.forEach((w, j) => {
        for (const p of w.pieces) {
          const pw = textWidth(p.text, fonts[p.font], SIZE);
          const prev = segs[segs.length - 1];
          if (prev && prev.font === p.font && prev.x + prev.width === x) { prev.text += p.text; prev.width += pw; }
          else segs.push({ text: p.text, font: p.font, x, width: pw });
          x += pw;
        }
        if (j < lw.length - 1) {
          const f = w.pieces[w.pieces.length - 1].font;
          const sw = spaceW(f) + wordSpace;
          const prev = segs[segs.length - 1];
          prev.text += " "; prev.width += sw; x += sw;
        }
      });
      page().lines.push({ y, segments: segs, wordSpace });
      y += h;
    });
  };
  const plain = (s: string): Run[] => [{ text: s }];

  // ---- first page ----
  if (contest) {
    paragraph(plain(ms.title), { align: "center", keepWithNext: true });
    if (ms.subtitle) paragraph(ms.subtitle, { align: "center" });
    if (o.pseudonym.trim()) paragraph(plain(`${L.pseudonym}: ${o.pseudonym.trim()}`), { align: "center" });
    y += lineH;
  } else {
    const count = `${L.about} ${roundedWords(ms.words).toLocaleString(o.lang === "es" ? "es-MX" : "en-US")} ${L.words}`;
    const cw = textWidth(count, fonts.r, SIZE);
    page().lines.push({ y, wordSpace: 0, segments: [
      ...(o.author.trim() ? [{ text: o.author.trim(), font: "r" as FontKey, x: MARGIN, width: textWidth(o.author.trim(), fonts.r, SIZE) }] : []),
      { text: count, font: "r", x: W - MARGIN - cw, width: cw },
    ] });
    y += singleH;
    for (const line of o.contact.split("\n").map((x) => x.trim()).filter(Boolean)) paragraph(plain(line), { align: "left", height: singleH });
    y = Math.max(y + lineH, H / 3);
    paragraph(plain(ms.title), { align: "center", keepWithNext: true });
    if (ms.subtitle) paragraph(ms.subtitle, { align: "center" });
    if (o.author.trim()) paragraph(plain(`${L.by} ${o.author.trim()}`), { align: "center" });
    y += lineH;
  }

  // ---- story ----
  const levels = ms.blocks.flatMap((b) => (b.kind === "heading" ? [b.level] : []));
  const topLevel = levels.length ? Math.min(...levels) : 9;
  let started = false;
  for (const b of ms.blocks) {
    if (b.kind === "break") { paragraph(plain("#"), { align: "center" }); continue; }
    if (b.kind === "heading") {
      if (o.chapterBreaks && b.level === topLevel && started && page().lines.length) newPage();
      paragraph(b.runs.map((r) => ({ ...r, b: true })), { align: b.align === "justify" ? "center" : b.align, keepWithNext: true });
      started = true;
      continue;
    }
    const align = b.align === "justify" ? (contest ? "justify" : "left") : b.align;
    if (b.quote) paragraph(b.runs, { align, left: INDENT });
    else paragraph(b.runs, { align, indent: align === "center" || align === "right" ? 0 : INDENT });
    started = true;
  }
  paragraph(plain(L.end), { align: "center" });

  return { width: W, height: H, size: SIZE, fonts, pages };
}

/** Running header (standard manuscript, page 2 on) or page-number footer (contest). */
export function pageMarks(o: ExportOptions, title: string, pageNo: number, layout: PageLayout): { text: string; x: number; y: number } | null {
  if (o.layout === "contest") {
    const t = String(pageNo);
    return { text: t, x: (layout.width - textWidth(t, layout.fonts.r, SIZE)) / 2, y: layout.height - MARGIN / 2 - SIZE };
  }
  if (pageNo === 1) return null;
  const surname = o.author.trim().split(/\s+/).pop() || "";
  const t = [surname, title, String(pageNo)].filter(Boolean).join(" / ");
  return { text: t, x: layout.width - MARGIN - textWidth(t, layout.fonts.r, SIZE), y: MARGIN / 2 };
}
