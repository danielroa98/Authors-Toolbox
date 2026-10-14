import { HEADING_RE, LIST_RE, SCENE_RE, HR_RE, bodyStart, words } from "../text/analysis";

/* ======================================================================
   MANUSCRIPT MODEL — a story note reduced to what a submission needs:
   title, optional subtitle, headings, paragraphs (with italic/bold) and scene breaks.
   Pure functions; the Word and PDF writers both render this model.
   ====================================================================== */

export interface Run { text: string; b?: boolean; i?: boolean }
export type Align = "left" | "center" | "right" | "justify";

export type Block =
  | { kind: "para"; runs: Run[]; align: Align; quote?: boolean }
  /** `chapter`: a note's title inside a compiled project (always starts a new page). */
  | { kind: "heading"; level: number; runs: Run[]; align: Align; chapter?: boolean }
  | { kind: "break" }
  /** A line of verse; `indent` = leading spaces as written. */
  | { kind: "verse"; runs: Run[]; align: Align; indent: number }
  /** The gap between two stanzas. */
  | { kind: "stanza" };

export interface Manuscript {
  title: string;
  subtitle: Run[] | null;
  blocks: Block[];
  words: number;
}

export type Layout = "manuscript" | "contest";
export type FontChoice = "times" | "courier" | "arial";
export type PageSize = "letter" | "a4";

export interface ExportOptions {
  layout: Layout;
  font: FontChoice;
  /** 2 = double spacing, 1.5 = one and a half */
  spacing: number;
  page: PageSize;
  /** Real name (standard manuscript). */
  author: string;
  /** Address / email / phone lines (standard manuscript). */
  contact: string;
  /** Pen name used for anonymous contest entries. */
  pseudonym: string;
  /** Each top-level heading starts a new page. */
  chapterBreaks: boolean;
  /** Keep `%%justify%%` paragraphs justified in the standard layout too. */
  keepJustify: boolean;
  /** Scene-break symbol, or "blank" for an empty line. */
  sceneBreak: SceneBreak;
  /** Title page on its own; the text starts on page 2. */
  coverPage: boolean;
  lang: "es" | "en";
}

export type SceneBreak = "#" | "* * *" | "—" | "blank";

/** Text printed for a scene break ("" for a blank line). */
export const breakText = (o: ExportOptions): string => (o.sceneBreak === "blank" ? "" : o.sceneBreak);

/** Whether a paragraph marked `%%justify%%` is printed justified. */
export const justifies = (o: ExportOptions): boolean => o.layout === "contest" || o.keepJustify;

/** Labels in the story's language. */
export function labels(lang: "es" | "en") {
  return lang === "es"
    ? { by: "por", words: "palabras", about: "aprox.", pseudonym: "Seudónimo", end: "FIN" }
    : { by: "by", words: "words", about: "about", pseudonym: "Pseudonym", end: "END" };
}

/** Word count rounded the way submission guidelines expect (nearest 100; nearest 10 under 1,000). */
export function roundedWords(n: number): number {
  if (n < 100) return Math.max(10, Math.round(n / 10) * 10);
  if (n < 1000) return Math.round(n / 10) * 10;
  return Math.round(n / 100) * 100;
}

/* ---------- inline text ---------- */

const ESC = ""; // placeholder for escaped markup characters

/** Remove Obsidian/Markdown syntax that never appears in a manuscript, keeping emphasis markers. */
export function cleanInline(s: string): string {
  return s
    .replace(/\\([*_~=[\]#`\\|>-])/g, (_m: string, c: string) => ESC + c.charCodeAt(0).toString(16) + ";")
    .replace(/%%[\s\S]*?%%/g, "")                          // comments and alignment markers
    .replace(/!\[\[[^\]]*\]\]/g, "")                         // embeds
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")                    // images
    .replace(/\[\[([^\]|#]*)(#[^\]|]*)?\|([^\]]*)\]\]/g, "$3") // [[note|shown]]
    .replace(/\[\[([^\]|#]*)(#[^\]]*)?\]\]/g, "$1")           // [[note]] / [[note#heading]]
    .replace(/\[\^[^\]]*\]/g, "")                            // footnote refs
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")                 // [text](url)
    .replace(/`([^`]*)`/g, "$1")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\s\^[\w-]+\s*$/, "")                          // block ids
    .replace(/[ \t]+/g, " ");
}

function unescape(s: string): string {
  return s.replace(new RegExp(ESC + "([0-9a-f]+);", "g"), (_m: string, h: string) => String.fromCharCode(parseInt(h, 16)));
}

const EMPH = /(\*\*\*|___)(?=\S)([\s\S]*?\S)\1|(\*\*|__)(?=\S)([\s\S]*?\S)\3|(\*|_)(?=\S)([\s\S]*?\S)\5/;

/** Split text into runs with bold/italic, from *, _, **, __, *** and ___. */
export function parseInline(s: string, b = false, i = false): Run[] {
  const out: Run[] = [];
  let rest = s;
  while (rest) {
    const m = EMPH.exec(rest);
    if (!m) { out.push({ text: rest, b, i }); break; }
    // "_" inside a word (snake_case) is not emphasis
    const marker = m[1] || m[3] || m[5];
    const before = rest.slice(0, m.index), after = rest.slice(m.index + m[0].length);
    if (marker.startsWith("_") && (/\p{L}$/u.test(before) || /^\p{L}/u.test(after))) {
      out.push({ text: rest.slice(0, m.index + marker.length), b, i });
      rest = rest.slice(m.index + marker.length);
      continue;
    }
    if (before) out.push({ text: before, b, i });
    if (m[1]) out.push(...parseInline(m[2], true, true));
    else if (m[3]) out.push(...parseInline(m[4], true, i));
    else out.push(...parseInline(m[6], b, true));
    rest = after;
  }
  return mergeRuns(out.map((r) => ({ ...r, text: unescape(r.text) })).filter((r) => r.text));
}

function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && !!last.b === !!r.b && !!last.i === !!r.i) last.text += r.text;
    else out.push({ text: r.text, ...(r.b ? { b: true } : {}), ...(r.i ? { i: true } : {}) });
  }
  return out;
}

export const runsText = (runs: Run[]): string => runs.map((r) => r.text).join("");

/**
 * Which title-page lines to print. A subtitle that already names the author ("Un relato de Daniel Roa")
 * replaces the "by …" line in a standard manuscript, and is left out of anonymous contest entries.
 */
export function titleLines(ms: Manuscript, o: ExportOptions): { subtitle: Run[] | null; byline: string | null } {
  const name = norm(o.author);
  const mentionsAuthor = !!ms.subtitle && !!name && norm(runsText(ms.subtitle)).includes(name);
  if (o.layout === "contest") return { subtitle: mentionsAuthor ? null : ms.subtitle, byline: null };
  return { subtitle: ms.subtitle, byline: o.author.trim() && !mentionsAuthor ? `${labels(o.lang).by} ${o.author.trim()}` : null };
}

/* ---------- blocks ---------- */

const MARKER = /^(\s{0,3}(?:#{1,6}[ \t]+)?)%%(center|right|left|justify)%%/;

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Build the manuscript of a story note.
 * Every non-empty line is a paragraph (that's how lines read in Obsidian), headings become
 * section titles, scene-break lines (***, ---, #, ⁂…) become "#", and callouts, comments,
 * images, tables and code are left out. The first H1 is the title; a heading right under it
 * is the subtitle, unless it's just the author's name (a byline), which is dropped, or the first
 * of several sections at its level (a story that opens with "## Chapter 1").
 */
export function buildManuscript(text: string, opts: { fallbackTitle: string; fmTitle?: string; authorNames: string[]; poem?: boolean }): Manuscript {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let title = opts.fmTitle?.trim() || "";
  let subtitle: Run[] | null = null;
  let sawProse = false, titleTaken = false, subtitleSlot = false;
  let fence = false, comment = false, callout = false, blockAlign: Align = "left";
  const authors = opts.authorNames.map(norm).filter(Boolean);
  const headingsAt = new Map<number, number>();
  for (const l of lines) { const h = HEADING_RE.exec(l); if (h) headingsAt.set(h[2].length, (headingsAt.get(h[2].length) ?? 0) + 1); }

  for (let n = bodyStart(lines); n < lines.length; n++) {
    let L = lines[n];
    // multi-line %% comments
    if (comment) { const j = L.indexOf("%%"); if (j < 0) continue; comment = false; L = L.slice(j + 2); if (!L.trim()) continue; }
    const opens = (L.replace(/%%[^%\n]*%%/g, "").match(/%%/g) || []).length;
    if (opens % 2 === 1) { comment = true; L = L.slice(0, L.lastIndexOf("%%")); if (!L.trim()) continue; }
    if (/^\s*(```|~~~)/.test(L)) { fence = !fence; continue; }
    if (fence) continue;
    if (!L.trim()) {
      callout = false; blockAlign = "left";
      // in a poem a blank line separates stanzas
      if (opts.poem && blocks.length && blocks[blocks.length - 1].kind === "verse") blocks.push({ kind: "stanza" });
      continue;
    }
    if (/^\s*>\s*\[!/.test(L)) { callout = true; continue; }
    if (callout && /^\s*>/.test(L)) continue;
    callout = false;
    if (/^\s*\|/.test(L) || /^\s*\$\$/.test(L)) continue;
    if (/^\s*!\[\[[^\]]*\]\]\s*$/.test(L) || /^\s*!\[[^\]]*\]\([^)]*\)\s*$/.test(L)) continue;

    // alignment marker: applies to its whole block (until the next blank line)
    const mk = MARKER.exec(L);
    let align: Align = blockAlign;
    if (mk) { align = mk[2] as Align; blockAlign = align; L = mk[1] + L.slice(mk[0].length); }

    if (HR_RE.test(L) || SCENE_RE.test(L)) {
      if (sawProse && blocks.length && blocks[blocks.length - 1].kind !== "break") {
        if (blocks[blocks.length - 1].kind === "stanza") blocks.pop();
        blocks.push({ kind: "break" });
      }
      subtitleSlot = false;
      continue;
    }
    const h = HEADING_RE.exec(L);
    if (h) {
      const level = h[2].length;
      const runs = parseInline(cleanInline(h[3]).trim());
      const plain = runsText(runs).trim();
      if (!plain) continue;
      if (!sawProse && !titleTaken && level === 1) {
        if (!title) title = plain;
        titleTaken = true; subtitleSlot = true;
        continue;
      }
      if (!sawProse && subtitleSlot && !subtitle) {
        subtitleSlot = false;
        if (authors.includes(norm(plain))) continue;   // byline: the writer's name
        if ((headingsAt.get(level) ?? 0) < 2) { subtitle = runs; continue; }
      }
      subtitleSlot = false;
      if (blocks.length && blocks[blocks.length - 1].kind === "stanza") blocks.pop();
      blocks.push({ kind: "heading", level, runs, align: mk ? align : "center" });
      continue;
    }
    subtitleSlot = false;
    if (opts.poem) {
      // verse: keep the line as written, including its indentation (a tab counts as 4 spaces)
      const lead = /^[ \t]*/.exec(L)?.[0] ?? "";
      const indent = lead.replace(/\t/g, "    ").length;
      const runs = parseInline(cleanInline(L.slice(lead.length)).trimEnd());
      if (!runsText(runs).trim()) continue;
      blocks.push({ kind: "verse", runs, align: align === "justify" ? "left" : align, indent });
      sawProse = true;
      continue;
    }
    let quote = false;
    const q = /^\s*>+\s?/.exec(L);
    if (q) { quote = true; L = L.slice(q[0].length); }
    // list markers are dropped, except a leading hyphen: in fiction that's a dialogue dash
    const li = LIST_RE.exec(L);
    if (li && li[2] !== "-") L = L.slice(li[0].length);
    const runs = parseInline(cleanInline(L).trim());
    if (!runsText(runs).trim()) continue;
    blocks.push({ kind: "para", runs, align, ...(quote ? { quote } : {}) });
    sawProse = true;
  }
  while (blocks.length && (blocks[blocks.length - 1].kind === "break" || blocks[blocks.length - 1].kind === "stanza")) blocks.pop();
  if (!title) title = opts.fallbackTitle;
  return { title, subtitle, blocks, words: countWords(blocks) };
}

export function countWords(blocks: Block[]): number {
  let count = 0;
  for (const b of blocks) if (b.kind !== "break" && b.kind !== "stanza") count += words(runsText(b.runs)).length;
  return count;
}

/** One note of a project, already read. */
export interface ProjectEntry { text: string; title: string; fmTitle?: string; poem: boolean }

/**
 * Compile several notes (an anthology or a folder of chapters) into one manuscript.
 * Each note becomes a chapter: its title is the chapter heading, its subtitle/byline is dropped,
 * and its own headings stay as section titles inside the chapter.
 */
export function compileProject(title: string, entries: ProjectEntry[], authorNames: string[]): Manuscript {
  const blocks: Block[] = [];
  for (const e of entries) {
    const ms = buildManuscript(e.text, { fallbackTitle: e.title, fmTitle: e.fmTitle, authorNames, poem: e.poem });
    blocks.push({ kind: "heading", level: 0, runs: [{ text: ms.title }], align: "center", chapter: true }, ...ms.blocks);
  }
  return { title, subtitle: null, blocks, words: countWords(blocks) };
}
