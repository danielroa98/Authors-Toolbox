import { HEADING_RE, bodyStart, plainTitle, words } from "../text/analysis";

/* ======================================================================
   COMPARING TWO VERSIONS OF A NOTE — pure functions, no Obsidian APIs.
   Paragraphs (lines) are aligned with a Myers diff; paragraphs that were
   rewritten are paired by similarity and compared word by word; identical
   paragraphs that changed place are reported as moved.
   ====================================================================== */

/** 0 = same, 1 = only in the new version, -1 = only in the old one. */
export type Op = 0 | 1 | -1;
/** One step of an edit script: `a` indexes the old sequence (same/removed), `b` the new one (same/added). */
export interface Edit { op: Op; a: number; b: number }

/** Beyond this many differences the middle of the texts is treated as replaced (keeps big rewrites fast). */
const MAX_D = 1500;

/**
 * Shortest edit script between two sequences (Myers, 1986). Common ends are trimmed first;
 * if the remaining texts differ in more than MAX_D places, the middle is reported as replaced.
 */
export function diffSeq(A: readonly string[], B: readonly string[]): Edit[] {
  const ids = new Map<string, number>();
  const id = (s: string): number => { let v = ids.get(s); if (v === undefined) { v = ids.size; ids.set(s, v); } return v; };
  const a = A.map(id), b = B.map(id);
  let lo = 0;
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo++;
  let ea = a.length, eb = b.length;
  while (ea > lo && eb > lo && a[ea - 1] === b[eb - 1]) { ea--; eb--; }

  const out: Edit[] = [];
  for (let i = 0; i < lo; i++) out.push({ op: 0, a: i, b: i });
  const mid = middle(a, b, lo, ea, lo, eb);
  for (const e of mid) out.push(e);
  for (let i = 0; ea + i < a.length; i++) out.push({ op: 0, a: ea + i, b: eb + i });
  return out;
}

function middle(a: number[], b: number[], aLo: number, aHi: number, bLo: number, bHi: number): Edit[] {
  const N = aHi - aLo, M = bHi - bLo;
  const replaced = (): Edit[] => {
    const r: Edit[] = [];
    for (let i = aLo; i < aHi; i++) r.push({ op: -1, a: i, b: -1 });
    for (let j = bLo; j < bHi; j++) r.push({ op: 1, a: -1, b: j });
    return r;
  };
  if (!N || !M) return replaced();
  const max = Math.min(N + M, MAX_D);
  const off = max + 1;
  const V = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  let found = -1;
  outer:
  for (let d = 0; d <= max; d++) {
    trace.push(V.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && V[off + k - 1] < V[off + k + 1]) ? V[off + k + 1] : V[off + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && a[aLo + x] === b[bLo + y]) { x++; y++; }
      V[off + k] = x;
      if (x >= N && y >= M) { found = d; break outer; }
    }
  }
  if (found < 0) return replaced();

  const rev: Edit[] = [];
  let x = N, y = M;
  for (let d = found; d >= 0; d--) {
    const v = trace[d];
    const at = (k: number): number => v[k + d + 1];
    const k = x - y;
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const prevX = d === 0 ? 0 : at(prevK);
    const prevY = d === 0 ? 0 : prevX - prevK;
    while (x > prevX && y > prevY) { x--; y--; rev.push({ op: 0, a: aLo + x, b: bLo + y }); }
    if (d > 0) {
      if (x === prevX) { y--; rev.push({ op: 1, a: -1, b: bLo + y }); }
      else { x--; rev.push({ op: -1, a: aLo + x, b: -1 }); }
    }
  }
  return rev.reverse();
}

/* ---------- words inside a paragraph ---------- */

/** Words (with inner apostrophes and hyphens), runs of spaces, and single other characters. */
const TOKEN_RE = /[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}\p{N}]+)*|\s+|[^\s\p{L}\p{M}\p{N}]/gu;
export const tokenize = (s: string): string[] => s.match(TOKEN_RE) || [];
const isWord = (t: string): boolean => /[\p{L}\p{N}]/u.test(t);

/** A piece of a rewritten paragraph: kept (0), added (1) or cut (-1). */
export interface Seg { op: Op; text: string }

/** Word-level changes between two paragraphs, grouped so each change reads as "cut … / added …". */
export function diffWords(oldText: string, newText: string): Seg[] {
  const A = tokenize(oldText), B = tokenize(newText);
  const edits = diffSeq(A, B);
  const raw: Seg[] = edits.map((e) => ({ op: e.op, text: e.op === 1 ? B[e.b] : A[e.a] }));
  // a lone space or punctuation mark kept between two changes is folded into the change
  for (let i = 1; i < raw.length - 1; i++) {
    const s = raw[i];
    if (s.op === 0 && !isWord(s.text) && raw[i - 1].op !== 0 && raw[i + 1].op !== 0) {
      raw.splice(i, 1, { op: -1, text: s.text }, { op: 1, text: s.text });
      i++;
    }
  }
  // group each run of changes as all of its cuts, then all of its additions
  const out: Seg[] = [];
  let del = "", ins = "";
  const flush = (): void => {
    if (del) out.push({ op: -1, text: del });
    if (ins) out.push({ op: 1, text: ins });
    del = ins = "";
  };
  for (const s of raw) {
    if (s.op === -1) del += s.text;
    else if (s.op === 1) ins += s.text;
    else {
      flush();
      const last = out[out.length - 1];
      if (last && last.op === 0) last.text += s.text; else out.push({ op: 0, text: s.text });
    }
  }
  flush();
  return out;
}

export const countWords = (s: string): number => words(s).length;

/** How alike two paragraphs are (0–1): shared words over all words (Dice coefficient). */
export function similarity(a: string, b: string): number {
  const wa = words(a.toLowerCase()), wb = words(b.toLowerCase());
  if (!wa.length && !wb.length) return 1;
  if (!wa.length || !wb.length) return 0;
  const bag = new Map<string, number>();
  for (const w of wa) bag.set(w, (bag.get(w) ?? 0) + 1);
  let shared = 0;
  for (const w of wb) { const n = bag.get(w) ?? 0; if (n > 0) { shared++; bag.set(w, n - 1); } }
  return (2 * shared) / (wa.length + wb.length);
}

/* ---------- paragraphs of a note ---------- */

export interface Para {
  /** The line as written in the note. */
  raw: string;
  /** As shown: the line without alignment markers. */
  text: string;
  /** For matching: trimmed, spaces collapsed. */
  key: string;
  /** Line in the note (0-based). */
  line: number;
  words: number;
  /** Heading level, or 0 for text. */
  heading: number;
}

const ALIGN_MARK = /%%(?:center|right|left|justify)%%/g;

/** Every non-empty line of the note's body (front matter left out) is a paragraph. */
export function notePars(text: string): Para[] {
  const lines = text.split("\n");
  const out: Para[] = [];
  for (let i = bodyStart(lines); i < lines.length; i++) {
    const shown = lines[i].replace(ALIGN_MARK, "").trimEnd();
    if (!shown.trim()) continue;
    const h = HEADING_RE.exec(shown);
    const plain = h ? plainTitle(h[3]) : shown;
    out.push({ raw: lines[i], text: h ? plain : shown, key: shown.trim().replace(/\s+/g, " "), line: i, words: countWords(plain.replace(/%%[^%]*%%/g, "")), heading: h ? h[2].length : 0 });
  }
  return out;
}

/* ---------- comparing paragraphs ---------- */

export type ParaOp =
  | { kind: "same"; a: number; b: number }
  | { kind: "added"; b: number }
  | { kind: "removed"; a: number }
  | { kind: "changed"; a: number; b: number; segs: Seg[]; added: number; removed: number }
  /** The same paragraph in another place: shown where it is now (`b`); `a` is where it was. */
  | { kind: "moved"; a: number; b: number }
  /** Where a moved paragraph used to be (shown faintly in the old order). */
  | { kind: "moved-away"; a: number; b: number };

/** Rewritten paragraphs share at least this much (see `similarity`). */
const PAIR_MIN = 0.45;
/** How far ahead in a block of changes to look for a paragraph's rewritten version. */
const PAIR_WINDOW = 40;

export function diffParas(A: readonly Para[], B: readonly Para[]): ParaOp[] {
  const edits = diffSeq(A.map((p) => p.key), B.map((p) => p.key));
  const ops: ParaOp[] = [];
  let i = 0;
  while (i < edits.length) {
    if (edits[i].op === 0) { ops.push({ kind: "same", a: edits[i].a, b: edits[i].b }); i++; continue; }
    // a block of changes: pair cut and added paragraphs that are rewrites of each other, in order
    const dels: number[] = [], ins: number[] = [];
    while (i < edits.length && edits[i].op !== 0) { const e = edits[i++]; if (e.op === -1) dels.push(e.a); else ins.push(e.b); }
    const partner = new Map<number, number>();
    // a heading replaced by another heading and nothing else: the section was renamed
    if (dels.length === 1 && ins.length === 1 && A[dels[0]].heading && A[dels[0]].heading === B[ins[0]].heading) partner.set(dels[0], 0);
    let from = 0;
    for (const d of dels) {
      if (partner.has(d)) continue;
      let best = -1, bestSim = PAIR_MIN;
      for (let j = from; j < ins.length && j < from + PAIR_WINDOW; j++) {
        if (A[d].heading !== B[ins[j]].heading && (A[d].heading === 0 || B[ins[j]].heading === 0)) continue;
        const s = similarity(A[d].text, B[ins[j]].text);
        if (s > bestSim) { bestSim = s; best = j; }
      }
      if (best >= 0) { partner.set(d, best); from = best + 1; }
    }
    let di = 0, ij = 0;
    while (di < dels.length || ij < ins.length) {
      const d = dels[di];
      const p = d === undefined ? undefined : partner.get(d);
      if (d !== undefined && p === undefined) { ops.push({ kind: "removed", a: d }); di++; }
      else if (d !== undefined && p === ij) {
        const b = ins[ij];
        const segs = diffWords(A[d].text, B[b].text);
        let added = 0, removed = 0;
        for (const s of segs) { if (s.op === 1) added += countWords(s.text); else if (s.op === -1) removed += countWords(s.text); }
        ops.push({ kind: "changed", a: d, b, segs, added, removed }); di++; ij++;
      } else { ops.push({ kind: "added", b: ins[ij] }); ij++; }
    }
  }
  // identical paragraphs that were cut in one place and added in another were moved
  const cut = new Map<string, number[]>();
  ops.forEach((o, k) => { if (o.kind === "removed" && A[o.a].words > 0) { const key = A[o.a].key; const l = cut.get(key) ?? []; l.push(k); cut.set(key, l); } });
  ops.forEach((o, k) => {
    if (o.kind !== "added") return;
    const l = cut.get(B[o.b].key);
    const from = l?.shift();
    if (from === undefined) return;
    const a = (ops[from] as { a: number }).a;
    ops[k] = { kind: "moved", a, b: o.b };
    ops[from] = { kind: "moved-away", a, b: o.b };
  });
  return ops;
}

/* ---------- sections (chapters) ---------- */

export interface Section { title: string; level: number; words: number; first: number }

/** Sections of a note: text before the first heading, then one per heading. `of[i]` is paragraph i's section. */
export function sectionsOf(P: readonly Para[]): { list: Section[]; of: number[] } {
  const list: Section[] = [{ title: "", level: 0, words: 0, first: 0 }];
  const of: number[] = [];
  P.forEach((p, i) => {
    if (p.heading) list.push({ title: plainTitle(HEADING_RE.exec(p.text)?.[3] ?? p.text), level: p.heading, words: 0, first: i });
    of.push(list.length - 1);
    if (!p.heading) list[list.length - 1].words += p.words;
  });
  // a note that starts with a heading has no untitled opening section
  if (!list[0].words && P.length && P[0].heading) return { list: list.slice(1), of: of.map((v) => v - 1) };
  return { list, of };
}

export type SectionStatus = "new" | "cut" | "rewritten" | "renamed" | "moved" | "same";
export interface SectionRow { title: string; level: number; before: number; after: number; added: number; removed: number; status: SectionStatus }

const sectionKey = (s: Section): string => s.title.toLowerCase().replace(/\s+/g, " ").trim();

/** Words before and after, added and cut, per section; sections are matched by their heading. */
export function sectionRows(A: readonly Para[], B: readonly Para[], ops: readonly ParaOp[]): SectionRow[] {
  const sa = sectionsOf(A), sb = sectionsOf(B);
  const rows: SectionRow[] = sb.list.map((s) => ({ title: s.title, level: s.level, before: 0, after: s.words, added: 0, removed: 0, status: "same" }));
  // old section → row of the same title (first unused match)
  const used = new Set<number>();
  const rowOfOld = sa.list.map((s) => {
    const k = sectionKey(s);
    const r = sb.list.findIndex((t, j) => !used.has(j) && sectionKey(t) === k);
    if (r >= 0) used.add(r);
    return r;
  });
  // a renamed section: its heading was paired with the new heading as a rewrite
  const renamed = new Set<number>();
  ops.forEach((o) => {
    if (o.kind !== "changed" || !A[o.a].heading || !B[o.b].heading) return;
    const oi = sa.of[o.a], ni = sb.of[o.b];
    if (rowOfOld[oi] < 0 && !used.has(ni)) { rowOfOld[oi] = ni; used.add(ni); renamed.add(ni); }
  });
  const extra: SectionRow[] = [];
  sa.list.forEach((s, i) => {
    if (rowOfOld[i] >= 0) rows[rowOfOld[i]].before = s.words;
    else extra.push({ title: s.title, level: s.level, before: s.words, after: 0, added: 0, removed: s.words, status: "cut" });
  });
  const oldRow = (a: number): SectionRow | null => { const r = rowOfOld[sa.of[a]]; return r >= 0 ? rows[r] : null; };
  for (const o of ops) {
    if (o.kind === "added") { if (!B[o.b].heading) rows[sb.of[o.b]].added += B[o.b].words; }
    else if (o.kind === "removed") { const r = oldRow(o.a); if (r && !A[o.a].heading) r.removed += A[o.a].words; }
    else if (o.kind === "changed" && !B[o.b].heading) { rows[sb.of[o.b]].added += o.added; const r = oldRow(o.a) ?? rows[sb.of[o.b]]; r.removed += o.removed; }
  }
  // order of the matched sections: a section that changed place relative to the others was moved
  const order = rowOfOld.filter((r) => r >= 0);
  const lis = longestIncreasing(order);
  rows.forEach((r, j) => {
    const existed = rowOfOld.includes(j);
    if (!existed) r.status = "new";
    else if (r.added || r.removed) r.status = "rewritten";
    else if (renamed.has(j)) r.status = "renamed";
    else if (!lis.has(j)) r.status = "moved";
  });
  // keep cut sections near where they were
  const out = rows.slice();
  for (const e of extra) out.push(e);
  return out.filter((r) => r.title || r.before || r.after);
}

/** The values of the longest increasing subsequence (sections that kept their relative order). */
function longestIncreasing(xs: number[]): Set<number> {
  const tails: number[] = [], prev: number[] = new Array<number>(xs.length).fill(-1), idx: number[] = [];
  xs.forEach((x, i) => {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (tails[m] < x) lo = m + 1; else hi = m; }
    tails[lo] = x; idx[lo] = i; prev[i] = lo > 0 ? idx[lo - 1] : -1;
  });
  const out = new Set<number>();
  for (let i = idx[tails.length - 1] ?? -1; i >= 0; i = prev[i]) out.add(xs[i]);
  return out;
}

/* ---------- the whole comparison ---------- */

export interface CompareStats {
  before: number;
  after: number;
  added: number;
  removed: number;
  moved: number;
  /** Share of the text that was added or cut (0–1): (added + cut) / (words before + words after). */
  changed: number;
  paras: { added: number; removed: number; changed: number; moved: number; same: number };
}

export interface Comparison { a: Para[]; b: Para[]; ops: ParaOp[]; stats: CompareStats; sections: SectionRow[] }

export function compareTexts(oldText: string, newText: string): Comparison {
  const a = notePars(oldText), b = notePars(newText);
  const ops = diffParas(a, b);
  const st: CompareStats = { before: 0, after: 0, added: 0, removed: 0, moved: 0, changed: 0, paras: { added: 0, removed: 0, changed: 0, moved: 0, same: 0 } };
  for (const p of a) if (!p.heading) st.before += p.words;
  for (const p of b) if (!p.heading) st.after += p.words;
  for (const o of ops) {
    if (o.kind === "same") st.paras.same++;
    else if (o.kind === "added") { st.paras.added++; if (!b[o.b].heading) st.added += b[o.b].words; }
    else if (o.kind === "removed") { st.paras.removed++; if (!a[o.a].heading) st.removed += a[o.a].words; }
    else if (o.kind === "changed") { st.paras.changed++; if (!b[o.b].heading) { st.added += o.added; st.removed += o.removed; } }
    else if (o.kind === "moved") { st.paras.moved++; st.moved += b[o.b].words; }
  }
  st.changed = st.before + st.after ? Math.min(1, (st.added + st.removed) / (st.before + st.after)) : 0;
  return { a, b, ops, stats: st, sections: sectionRows(a, b, ops) };
}

/* ---------- marks for the editor ---------- */

export interface LineMarks {
  /** Lines (0-based, in the new text) that are new. */
  added: number[];
  /** Lines that replace other lines. */
  changed: number[];
  /** Lines right after a place where text was cut (or the line count, for a cut at the end). */
  cutBefore: number[];
}

/** Which lines of `newText` differ from `oldText`, for marks in the margin of the editor. */
export function lineMarks(oldText: string, newText: string): LineMarks {
  const A = oldText.split("\n").map((l) => l.trim()), B = newText.split("\n").map((l) => l.trim());
  const edits = diffSeq(A, B);
  const m: LineMarks = { added: [], changed: [], cutBefore: [] };
  let i = 0;
  while (i < edits.length) {
    if (edits[i].op === 0) { i++; continue; }
    const ins: number[] = []; let cut = 0;
    while (i < edits.length && edits[i].op !== 0) { const e = edits[i++]; if (e.op === 1) { if (B[e.b]) ins.push(e.b); } else if (A[e.a]) cut++; }
    if (cut && ins.length) m.changed.push(...ins);
    else if (ins.length) m.added.push(...ins);
    else if (cut) m.cutBefore.push(i < edits.length ? edits[i].b : B.length);
  }
  return m;
}
