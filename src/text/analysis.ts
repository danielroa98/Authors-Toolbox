/* ======================================================================
   TEXT CORE — pure functions (no Obsidian dependencies)
   ====================================================================== */

/* ---------- types ---------- */

/** Supported analysis languages. */
export type Lang = "en" | "es";

/** One piece of the document: text ('t') or markup ('m'). `i` = LanguageTool interpretAs for markup. */
export interface Piece {
  k: "t" | "m";
  s: string;
  from: number;
  i?: string;
}

/** Maps a run of a paragraph's plain text (p) to document offset (d), n chars long. */
export interface ParaSeg {
  p: number;
  d: number;
  n: number;
}

export type ParaKind = "para" | "heading" | "quote" | "list";

/** A prose block extracted from the markdown. */
export interface Para {
  kind: ParaKind;
  fromLine: number;
  toLine: number;
  plain: string;
  segs: ParaSeg[];
  /** Internal while building (deleted before the paragraph is emitted). */
  gap?: boolean;
  /** Word count — set by analyze() on non-heading paragraphs. */
  words?: number;
}

/** A non-heading paragraph after analyze() has counted its words. */
export type AnalyzedPara = Para & { words: number };

export interface ProseMap {
  pieces: Piece[];
  paras: Para[];
}

export interface Readability {
  name: "INFLESZ" | "Flesch";
  score: number;
  label: string;
  /** Flesch-Kincaid grade (English only). */
  grade?: number;
}

/** [start, end) offsets into a string. */
export type Range = [number, number];

export interface WordToken {
  w: string;
  lw: string;
  para: number;
  a: number;
  b: number;
}

export interface Sentence {
  para: number;
  a: number;
  b: number;
  n: number;
  opener: string;
}

export interface NameEntry {
  word: string;
  shown: string;
  count: number;
}

export interface EchoEntry {
  word: string;
  count: number;
  idx: number[];
}

export interface AdverbEntry {
  word: string;
  idx: number[];
}

export interface CrutchHit {
  para: number;
  a: number;
  b: number;
}

export interface CrutchEntry {
  word: string;
  hits: CrutchHit[];
}

export interface OpenerRun {
  word: string;
  sents: Sentence[];
}

export interface ParaWordCount {
  i: number;
  n: number;
}

export type CrutchLists = Record<Lang, string>;

export interface AnalyzeOptions {
  /** Language code, or "auto" (default) to detect. */
  lang?: string;
  echoWindow?: number;
  crutch?: CrutchLists;
  longSentence?: number;
}

export interface Analysis {
  lang: Lang;
  paras: AnalyzedPara[];
  allParas: Para[];
  W: WordToken[];
  S: Sentence[];
  words: number;
  chars: number;
  charsNoSp: number;
  paragraphs: number;
  sentences: number;
  avgSentence: number;
  sentenceSD: number;
  lens: number[];
  avgPara: number;
  syllables: number;
  readability: Readability | null;
  dialogue: number;
  variety: number;
  /** [word, count] */
  top: [string, number][];
  echoes: EchoEntry[];
  adverbs: AdverbEntry[];
  adverbCount: number;
  crutch: CrutchEntry[];
  longSentences: Sentence[];
  longThreshold: number;
  openers: OpenerRun[];
  longestParas: ParaWordCount[];
  names: NameEntry[];
}

export type LengthCategory = "Flash fiction" | "Short story" | "Novelette" | "Novella" | "Novel";

export interface OutlineHeading {
  line: number;
  level: number;
  title: string;
}

/** A scene segment while being built (title/id/parent are only set for non-empty ones). */
export interface SceneSegment {
  start: number;
  end: number;
  hasBreak: boolean;
  empty?: boolean;
  title?: string;
  id?: string;
  parent?: OutlineNode;
}

/** A non-empty scene inside an outline node. */
export interface Scene extends SceneSegment {
  title: string;
  id: string;
  parent: OutlineNode;
}

export interface OutlineNode {
  id: string;
  level: number;
  title: string;
  start: number;
  contentStart: number;
  end: number;
  children: OutlineNode[];
  scenes: Scene[];
  /** Undefined for the root. */
  parent?: OutlineNode;
  /** Scene separator line (set when the node has scene breaks). */
  sceneSep?: string;
  /** Whether the text before the first scene break is empty (set when the node has scene breaks). */
  leadingEmpty?: boolean;
}

export interface Outline {
  lines: string[];
  root: OutlineNode;
  all: OutlineNode[];
}

export type ReorderKind = "h" | "s";

export interface ReorderResult {
  fromLine: number;
  /** Inclusive. */
  toLine: number;
  text: string;
}

export interface LtTextAnnotation {
  text: string;
  markup?: undefined;
  interpretAs?: undefined;
}

export interface LtMarkupAnnotation {
  text?: undefined;
  markup: string;
  interpretAs?: string;
}

export type LtAnnotation = LtTextAnnotation | LtMarkupAnnotation;

export interface LtChunk {
  /** Document offset of the chunk start. */
  base: number;
  text: string;
  bytes: number;
  annotation: LtAnnotation[];
}

/** The subset of a LanguageTool /check match that we use. */
export interface LtMatch {
  message?: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements?: { value: string }[];
  context?: { text?: string; offset: number; length: number };
  sentence?: string;
  rule?: {
    id?: string;
    description?: string;
    issueType?: string;
    category?: { id?: string; name?: string };
  };
}

/** The subset of a LanguageTool /check response that we use. */
export interface LtResponse {
  matches?: LtMatch[];
}

export type IssueKind = "spelling" | "grammar" | "punctuation" | "style";

export interface LtIssue {
  from: number;
  to: number;
  text: string;
  message: string;
  short: string;
  replacements: string[];
  kind: IssueKind;
  rule: string;
  ruleName: string;
  sentence: string;
  id: string;
}

/* ---------- constants ---------- */

export const WORD_RE = /[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}\p{N}]+)*/gu;
export const LETTER_RE = /[\p{L}\p{M}\p{N}]/u;
export const HR_RE = /^\s{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
export const SCENE_RE = /^\s{0,3}(?:%%\w+%%)?\s*(?:([-*_])(?:[ \t]*\1){2,}|⁂|#|§|~{3,}|\*\s\*\s\*)[ \t]*$/;
export const HEADING_RE = /^(\s{0,3})(#{1,6})[ \t]+(.*)$/;
export const LIST_RE = /^(\s*)([-+*]|\d+[.)])[ \t]+(\[[ xX]\][ \t]+)?/;

export const STOP: Record<Lang, Set<string>> = {
  en: new Set(("the a an and or but if then so of to in on at by for with from as is was were be been being are am it its it's this that these those " +
    "i me my mine you your yours he him his she her hers we us our ours they them their theirs not no nor do did does done doing have has had having " +
    "there here what which who whom whose when where why how all any some can could would should will shall may might must just than too very into " +
    "out up down over under again about said one only i'm i'd i'll i've don't didn't doesn't can't couldn't wasn't weren't isn't aren't won't wouldn't " +
    "it'll that's there's what's he's she's let's you're we're they're you'll we'll they'll you've we've they've also more most such each own same other " +
    "both few through during before after above below off once because while until against between among himself herself itself myself yourself " +
    "themselves ourselves get got like back even still well way much many now").split(" ")),
  es: new Set(("el la los las lo un una unos unas y e o u ni pero sino si no de del a al en con por para sin sobre entre hasta desde hacia contra según tras " +
    "que qué quien quién quienes cual cuál cuales como cómo cuando cuándo donde dónde cuanto cuánto es era eran fue fueron ser sido siendo soy eres somos " +
    "son está estaba estaban estar estoy estás estamos están estuvo estado ha había habían han he has hemos haber hay habrá sería serían " +
    "yo me mi mis mí tú te tu tus ti él le les se su sus sí ella ellos ellas nos nosotros nosotras vosotros os usted ustedes nuestro nuestra nuestros nuestras " +
    "vuestro este esta esto estos estas ese esa eso esos esas aquel aquella aquello aquellos aquellas muy más menos ya también tampoco porque pues así " +
    "todo toda todos todas otro otra otros otras cada mismo misma mismos mismas sólo solo tan tanto tanta tantos algo nada dijo mientras aunque luego " +
    "entonces cuando ahí allí aquí bien mal sea fuera hacer hizo hace tener tenía tiene tienen poder podía puede pueden decir dice iba ir va").split(" ")),
};

export const ABBR = new Set<string>(["mr", "mrs", "ms", "dr", "st", "sr", "sra", "srta", "dra", "lic", "ing", "prof", "vs", "etc", "e.g", "i.e", "p", "pp", "no", "núm", "ud", "uds", "av", "col", "jr"]);

export const ADVERB_EXC_EN = new Set<string>(("only family early reply apply supply imply comply holy ugly july italy lily belly fly rely ally bully jelly silly lonely " +
  "friendly lovely daily likely assembly butterfly curly elderly jolly melancholy monopoly oily rally sly smelly wily chilly hilly ply anomaly emily " +
  "molly sally kelly billy polly holly dolly folly gully tally woolly homily costly deadly lively lowly manly orderly timely worldly ghostly cowardly " +
  "scholarly unlikely unruly burly surly bubbly cuddly prickly wrinkly sickly bodily hourly weekly monthly yearly nightly kindly").split(" "));
export const ADVERB_EXC_ES = new Set<string>(["mente", "demente", "clemente", "simiente", "vehemente"]);

export const DEFAULT_CRUTCH: CrutchLists = {
  en: "very, really, just, actually, suddenly, quite, somehow, seemed, started to, began to, rather, literally, basically, simply, a little, kind of, sort of",
  es: "muy, realmente, de repente, de pronto, simplemente, básicamente, solamente, empezó a, comenzó a, como que, un poco, algo, totalmente, en realidad, literalmente",
};

export function words(s: string): string[] { return s.match(WORD_RE) || []; }

/* ---------- Markdown → prose map (keeps document offsets) ---------- */

export function proseMap(text: string): ProseMap {
  const pieces: Piece[] = [];   // {k:'t'|'m', s, from, i?}  — covers the whole document, in order
  const paras: Para[] = [];    // prose blocks: {kind, fromLine, toLine, plain, segs:[{p,d,n}]}
  // (declared via `as` so control-flow analysis doesn't narrow it to `null`; the closures below reassign it)
  let cur = null as Para | null;

  const pushM = (s: string, from: number, ia?: string): void => {
    if (!s) return;
    const last = pieces[pieces.length - 1];
    if (last && last.k === "m" && last.from + last.s.length === from) {
      last.s += s; if (ia) last.i = (last.i || "") + ia; return;
    }
    const p: Piece = { k: "m", s, from }; if (ia) p.i = ia; pieces.push(p);
  };
  const pushT = (s: string, from: number): void => {
    if (!s) return;
    const last = pieces[pieces.length - 1];
    if (last && last.k === "t" && last.from + last.s.length === from) last.s += s;
    else pieces.push({ k: "t", s, from });
    if (cur) {
      if (cur.gap && cur.plain.length) cur.plain += " ";
      cur.gap = false;
      const lastSeg = cur.segs[cur.segs.length - 1];
      if (lastSeg && lastSeg.d + lastSeg.n === from && lastSeg.p + lastSeg.n === cur.plain.length) lastSeg.n += s.length;
      else cur.segs.push({ p: cur.plain.length, d: from, n: s.length });
      cur.plain += s;
    }
  };
  const endPara = (line: number): void => {
    if (cur && cur.plain.trim()) { cur.toLine = line; delete cur.gap; paras.push(cur); }
    cur = null;
  };
  const startPara = (kind: ParaKind, line: number): void => {
    if (cur && cur.kind === kind) return;
    endPara(line);
    cur = { kind, fromLine: line, toLine: line, plain: "", segs: [], gap: false };
  };

  const st = { comment: false };
  const inline = (s: string, from: number): void => {
    let i = 0, buf = "", bufFrom = from;
    const flush = (): void => { if (buf) pushT(buf, bufFrom); buf = ""; };
    const mark = (len: number, ia?: string): void => { flush(); pushM(s.slice(i, i + len), from + i, ia); i += len; bufFrom = from + i; };
    while (i < s.length) {
      const c = s[i], rest = s.slice(i);
      if (rest.startsWith("%%")) {
        const j = s.indexOf("%%", i + 2);
        if (j < 0) { mark(s.length - i); st.comment = true; break; }
        mark(j + 2 - i); continue;
      }
      if (rest.startsWith("![[")) { const j = s.indexOf("]]", i); mark(j < 0 ? s.length - i : j + 2 - i); continue; }
      if (rest.startsWith("![")) { const m = /^!\[[^\]]*\]\([^)]*\)/.exec(rest); if (m) { mark(m[0].length); continue; } }
      if (rest.startsWith("[[")) {
        const j = s.indexOf("]]", i);
        if (j > 0) {
          const inner = s.slice(i + 2, j), bar = inner.indexOf("|");
          if (bar >= 0) { mark(2 + bar + 1); flush(); pushT(inner.slice(bar + 1), from + i); i += inner.length - bar - 1; bufFrom = from + i; mark(2); }
          else { const hash = inner.indexOf("#"); mark(2); const shown = hash >= 0 ? inner.slice(0, hash) : inner; pushT(shown, from + i); i += shown.length; bufFrom = from + i; if (hash >= 0) mark(inner.length - hash); mark(2); }
          continue;
        }
      }
      if (rest.startsWith("[^")) { const j = s.indexOf("]", i); if (j > 0) { mark(j + 1 - i); continue; } }
      if (c === "[") {
        const m = /^\[([^\]]*)\]\(([^)]*)\)/.exec(rest);
        if (m) { mark(1); pushT(m[1], from + i); i += m[1].length; bufFrom = from + i; mark(2 + m[2].length + 1); continue; }
      }
      if (c === "`") { const j = s.indexOf("`", i + 1); if (j > 0) { mark(j + 1 - i); continue; } }
      if (c === "<") { const tag = /^<\/?[a-zA-Z][^>]*>/.exec(rest); if (tag) { mark(tag[0].length); continue; } }
      if (c === "\\" && i + 1 < s.length && /[!-/:-@[-`{-~]/.test(s[i + 1])) { mark(1); buf += s[i]; i++; continue; }
      if (/^(\*\*|__|~~|==)/.test(rest)) { mark(2); continue; }
      if (c === "*") { mark(1); continue; }
      if (c === "_") {
        const pv = i > 0 ? s[i - 1] : " ", nx = i + 1 < s.length ? s[i + 1] : " ";
        if (!(LETTER_RE.test(pv) && LETTER_RE.test(nx))) { mark(1); continue; }
      }
      if (i === 0 || /\s/.test(s[i - 1])) { const url = /^https?:\/\/\S+/.exec(rest); if (url) { mark(url[0].length); continue; } }
      const bid = /^\s\^[\w-]+\s*$/.exec(rest);
      if (bid) { mark(bid[0].length); continue; }
      if (!buf) bufFrom = from + i;
      buf += c; i++;
    }
    flush();
  };

  const lines = text.split("\n");
  let off = 0, front = lines[0] === "---", fence = false, callout = false;
  for (let n = 0; n < lines.length; n++) {
    const L = lines[n], from = off;
    if (front) {
      pushM(L, from);
      if (n > 0 && /^(---|\.\.\.)\s*$/.test(L)) front = false;
    } else if (st.comment) {
      const j = L.indexOf("%%");
      if (j < 0) pushM(L, from);
      else { pushM(L.slice(0, j + 2), from); st.comment = false; if (L.slice(j + 2).trim()) { startPara("para", n); inline(L.slice(j + 2), from + j + 2); } }
    } else if (fence) {
      pushM(L, from); if (/^\s*(```|~~~)/.test(L)) fence = false;
    } else if (/^\s*(```|~~~)/.test(L)) {
      endPara(n); fence = true; pushM(L, from);
    } else if (L.trim() === "") {
      endPara(n); callout = false; pushM(L, from);
    } else if (callout && /^\s*>/.test(L)) {
      pushM(L, from);
    } else if (/^\s*>\s*\[!/.test(L)) {
      endPara(n); callout = true; pushM(L, from);
    } else if (HR_RE.test(L) || SCENE_RE.test(L)) {
      endPara(n); pushM(L, from);
    } else if (/^\s*\|/.test(L) || /^\s*\$\$/.test(L)) {
      endPara(n); pushM(L, from);
    } else {
      callout = false;
      let m: RegExpExecArray | null;
      if ((m = HEADING_RE.exec(L))) {
        endPara(n); startPara("heading", n);
        const pre = m[1].length + m[2].length + (L.length - m[1].length - m[2].length - m[3].length);
        pushM(L.slice(0, pre), from); inline(L.slice(pre), from + pre); endPara(n + 1);
      } else if ((m = /^(\s*>+\s?)/.exec(L))) {
        startPara("quote", n); pushM(m[1], from); inline(L.slice(m[1].length), from + m[1].length);
      } else if ((m = LIST_RE.exec(L))) {
        endPara(n); startPara("list", n); pushM(m[0], from); inline(L.slice(m[0].length), from + m[0].length);
      } else {
        startPara("para", n); inline(L, from);
      }
      if (cur) cur.gap = true;
    }
    off += L.length;
    if (n < lines.length - 1) { pushM("\n", off, "\n"); off += 1; }
  }
  endPara(lines.length);
  return { pieces, paras };
}

export function plainToDoc(para: Pick<Para, "segs">, p: number): number {
  const segs = para.segs;
  for (let k = 0; k < segs.length; k++) {
    const g = segs[k], nx = segs[k + 1];
    if (p < g.p) return g.d;
    if (p < g.p + g.n) return g.d + (p - g.p);
    if (p === g.p + g.n && (!nx || nx.p > p)) return g.d + g.n;
  }
  const g = segs[segs.length - 1];
  return g ? g.d + g.n : 0;
}

/* ---------- language ---------- */

export function detectLang(sample: string): Lang {
  let en = 0, es = 0;
  for (const w of words(sample.slice(0, 20000).toLowerCase())) {
    if (STOP.en.has(w)) en++;
    if (STOP.es.has(w)) es++;
  }
  if (/[ñáéíóú¿¡]/i.test(sample)) es += 3;
  return es > en ? "es" : "en";
}
export function baseLang(code: string | null | undefined): Lang { return String(code || "").toLowerCase().startsWith("es") ? "es" : "en"; }

/* ---------- syllables / readability ---------- */

export function syllablesEn(w: string): number {
  w = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}
export function syllablesEs(w: string): number {
  w = w.toLowerCase().replace(/qu(?=[eiéí])/g, "q").replace(/gu(?=[eiéí])/g, "g").replace(/y$/, "i").replace(/[^a-záéíóúüñ]/g, "");
  if (!w) return 0;
  const V = "aeiouáéíóúü", STRONG = "aeoáéóíú";
  let n = 0, prev: string | null = null;
  for (const ch of w) {
    if (!V.includes(ch)) { prev = null; continue; }
    if (prev === null) n++;
    else if (STRONG.includes(prev) && STRONG.includes(ch)) n++;
    prev = ch;
  }
  return Math.max(1, n);
}
export function readability(lang: Lang, nWords: number, nSent: number, nSyl: number): Readability | null {
  if (!nWords || !nSent) return null;
  const wps = nWords / nSent, spw = nSyl / nWords;
  if (lang === "es") {
    const v = 206.835 - 62.3 * spw - wps;  // Szigriszt-Pazos / INFLESZ
    const label = v < 40 ? "Very difficult" : v < 55 ? "Somewhat difficult" : v < 65 ? "Normal" : v < 80 ? "Fairly easy" : "Very easy";
    return { name: "INFLESZ", score: v, label };
  }
  const v = 206.835 - 1.015 * wps - 84.6 * spw;  // Flesch Reading Ease
  const grade = 0.39 * wps + 11.8 * spw - 15.59;
  const label = v >= 90 ? "Very easy" : v >= 80 ? "Easy" : v >= 70 ? "Fairly easy" : v >= 60 ? "Standard" : v >= 50 ? "Fairly difficult" : v >= 30 ? "Difficult" : "Very difficult";
  return { name: "Flesch", score: v, label, grade };
}

/* ---------- sentences & dialogue ---------- */

export function splitSentences(s: string): Range[] {
  const out: Range[] = [];
  const re = /(?:[.!?]+|…|\.\.\.)+[”"’'»)\]]*(?=\s|$)/g;
  let start = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const end = m.index + m[0].length;
    const before = s.slice(start, m.index);
    const lastWord = ((before.match(/(\S+)$/) || ["", ""])[1]).toLowerCase().replace(/^[¿¡"“«(—–-]+/, "");
    if (/^\.$/.test(m[0]) && (ABBR.has(lastWord) || /^\p{L}$/u.test(lastWord))) continue;
    const after = s.slice(end).replace(/^\s+/, "");
    const nx = after.replace(/^[—–\-"“”«»'’(]+/, "");
    if (nx && /^\p{Ll}/u.test(nx)) continue;  // "…pensé… que", "“Really?” she asked", "—¿Vienes? —preguntó"
    out.push([start, end]);
    start = end; while (start < s.length && /\s/.test(s[start])) start++;
  }
  if (start < s.length && s.slice(start).trim()) out.push([start, s.length]);
  return out.filter(([a, b]) => words(s.slice(a, b)).length > 0);
}

export function dialogueRanges(s: string): Range[] {
  const t = s.replace(/^\s+/, ""), lead = s.length - t.length, out: Range[] = [];
  if (/^[—–]/.test(t) || /^-(?=\S)/.test(t)) {
    let on = true, start = lead + 1;
    for (let i = lead + 1; i < s.length; i++) {
      if (s[i] === "—" || s[i] === "–") {
        if (on) out.push([start, i]); else start = i + 1;
        on = !on;
      }
    }
    if (on) out.push([start, s.length]);
    return out;
  }
  let open = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "“" || c === "«") { if (open < 0) open = i; }
    else if (c === "”" || c === "»") { if (open >= 0) { out.push([open, i]); open = -1; } }
    else if (c === '"') { if (open < 0) open = i; else { out.push([open, i]); open = -1; } }
  }
  return out;
}

export function mattr(list: string[], win: number): number {
  if (!list.length) return 0;
  if (list.length <= win) return new Set(list).size / list.length;
  const cnt = new Map<string, number>(); let uniq = 0, sum = 0, n = 0;
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    const c = (cnt.get(w) || 0) + 1; cnt.set(w, c); if (c === 1) uniq++;
    if (i >= win) { const o = list[i - win]; const oc = (cnt.get(o) ?? 0) - 1; cnt.set(o, oc); if (oc === 0) uniq--; }
    if (i >= win - 1) { sum += uniq / win; n++; }
  }
  return sum / n;
}

/* ---------- full analysis ---------- */

export function parseCrutch(str: string | null | undefined): string[] {
  return String(str || "").split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
}

export function analyze(text: string, opts?: AnalyzeOptions | null): Analysis {
  opts = opts || {};
  const { paras } = proseMap(text);
  const prose: AnalyzedPara[] = paras.filter((p) => p.kind !== "heading").map((p) => Object.assign(p, { words: 0 }));
  const sample = prose.map((p) => p.plain).join("\n");
  const lang = opts.lang && opts.lang !== "auto" ? baseLang(opts.lang) : detectLang(sample);
  const stop = STOP[lang];
  const sylF = lang === "es" ? syllablesEs : syllablesEn;

  const W: WordToken[] = [];        // {w, lw, para, a, b}
  const S: Sentence[] = [];        // {para, a, b, n, opener}
  let chars = 0, charsNoSp = 0, syl = 0, dlgWords = 0;
  prose.forEach((p, pi) => {
    p.words = 0;
    chars += p.plain.length; charsNoSp += p.plain.replace(/\s/g, "").length;
    const dr = dialogueRanges(p.plain);
    let m: RegExpExecArray | null; WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(p.plain))) {
      const w = m[0], a = m.index;
      W.push({ w, lw: w.toLowerCase(), para: pi, a, b: a + w.length });
      p.words++; syl += sylF(w);
      if (dr.some(([x, y]) => a >= x && a < y)) dlgWords++;
    }
    for (const [a, b] of splitSentences(p.plain)) {
      const ws = words(p.plain.slice(a, b));
      S.push({ para: pi, a, b, n: ws.length, opener: (ws[0] || "").toLowerCase() });
    }
  });

  const nW = W.length, nS = S.length;
  const lens = S.map((s) => s.n);
  const avgS = nS ? nW / nS : 0;
  const sd = nS ? Math.sqrt(lens.reduce((t, x) => t + (x - avgS) ** 2, 0) / nS) : 0;
  // proper nouns: words that are capitalised (almost) every time they appear mid-sentence
  const capStat = new Map<string, { cap: number; n: number; shown: string }>();
  for (const x of W) {
    const p = prose[x.para].plain;
    const pre = p.slice(Math.max(0, x.a - 8), x.a);
    const initial = /^[\s—–\-"“«¿¡(']*$/.test(p.slice(0, x.a)) || /[.!?…:]["”’»)]*\s+[—–\-"“«¿¡(']*$/.test(pre);
    if (initial) continue;
    const c = capStat.get(x.lw) || { cap: 0, n: 0, shown: x.w };
    c.n++; if (/^\p{Lu}/u.test(x.w)) { c.cap++; c.shown = x.w; }
    capStat.set(x.lw, c);
  }
  const proper = new Set([...capStat.entries()].filter(([w, c]) => c.cap >= 1 && c.cap / c.n >= 0.8 && !stop.has(w)).map(([w]) => w));
  const nameCount = new Map<string, number>();
  for (const x of W) if (proper.has(x.lw)) nameCount.set(x.lw, (nameCount.get(x.lw) || 0) + 1);
  // (every proper noun has a capStat entry, so the `?? w` fallback never applies)
  const names: NameEntry[] = [...nameCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([w, n]) => ({ word: w, shown: capStat.get(w)?.shown ?? w, count: n }));
  const content = W.filter((x) => !stop.has(x.lw) && x.lw.length >= 3 && !/^\d+$/.test(x.lw) && !proper.has(x.lw));

  // frequency
  const freq = new Map<string, number>();
  for (const x of content) freq.set(x.lw, (freq.get(x.lw) || 0) + 1);
  const top = [...freq.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 15);

  // echoes: the same content word again within N words
  const win = opts.echoWindow || 40;
  const lastAt = new Map<string, number>(), echoes = new Map<string, { word: string; count: number; idx: Set<number> }>();
  W.forEach((x, idx) => {
    if (stop.has(x.lw) || x.lw.length < 4 || /^\d+$/.test(x.lw) || proper.has(x.lw)) return;
    const prev = lastAt.get(x.lw);
    if (prev !== undefined && idx - prev <= win) {
      const e = echoes.get(x.lw) || { word: x.lw, count: 0, idx: new Set<number>() };
      e.count++; e.idx.add(prev); e.idx.add(idx); echoes.set(x.lw, e);
    }
    lastAt.set(x.lw, idx);
  });
  const echoList: EchoEntry[] = [...echoes.values()].sort((a, b) => b.count - a.count).slice(0, 12)
    .map((e) => ({ word: e.word, count: e.count, idx: [...e.idx].sort((a, b) => a - b) }));

  // adverbs
  const adv = new Map<string, AdverbEntry>();
  W.forEach((x, idx) => {
    const isAdv = lang === "es" ? (/mente$/.test(x.lw) && x.lw.length > 6 && !ADVERB_EXC_ES.has(x.lw))
      : (/ly$/.test(x.lw) && x.lw.length > 4 && !ADVERB_EXC_EN.has(x.lw));
    if (isAdv) { const e = adv.get(x.lw) || { word: x.lw, idx: [] }; e.idx.push(idx); adv.set(x.lw, e); }
  });
  const advList = [...adv.values()].sort((a, b) => b.idx.length - a.idx.length);
  const advCount = advList.reduce((t, e) => t + e.idx.length, 0);

  // crutch words / phrases
  const crutch: CrutchEntry[] = [];
  for (const ph of parseCrutch((opts.crutch || DEFAULT_CRUTCH)[lang])) {
    const re = new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "giu");
    const hits: CrutchHit[] = [];
    prose.forEach((p, pi) => {
      let m: RegExpExecArray | null; re.lastIndex = 0;
      while ((m = re.exec(p.plain))) {
        const a = m.index, b = a + m[0].length;
        if ((a > 0 && LETTER_RE.test(p.plain[a - 1])) || (b < p.plain.length && LETTER_RE.test(p.plain[b]))) continue;
        hits.push({ para: pi, a, b });
      }
    });
    if (hits.length) crutch.push({ word: ph, hits });
  }
  crutch.sort((a, b) => b.hits.length - a.hits.length);

  // long sentences
  const longT = opts.longSentence || 35;
  const longS = S.filter((s) => s.n > longT).sort((a, b) => b.n - a.n);

  // repeated sentence openers (3+ in a row)
  const openers: OpenerRun[] = [];
  for (let i = 0; i < S.length;) {
    let j = i + 1;
    while (j < S.length && S[j].opener && S[j].opener === S[i].opener) j++;
    if (j - i >= 3 && S[i].opener) openers.push({ word: S[i].opener, sents: S.slice(i, j) });
    i = j;
  }

  // paragraphs
  const paraWords: ParaWordCount[] = prose.map((p, i) => ({ i, n: p.words })).filter((x) => x.n > 0);
  const longestParas = [...paraWords].sort((a, b) => b.n - a.n).slice(0, 3);

  const r = readability(lang, nW, nS, syl);
  return {
    lang, paras: prose, allParas: paras, W, S,
    words: nW, chars, charsNoSp, paragraphs: paraWords.length, sentences: nS,
    avgSentence: avgS, sentenceSD: sd, lens, avgPara: paraWords.length ? nW / paraWords.length : 0,
    syllables: syl, readability: r, dialogue: nW ? dlgWords / nW : 0,
    variety: mattr(W.map((x) => x.lw), 100),
    top, echoes: echoList, adverbs: advList, adverbCount: advCount, crutch, longSentences: longS, longThreshold: longT,
    openers, longestParas, names,
  };
}

export function lengthCategory(n: number): LengthCategory {
  if (n < 1000) return "Flash fiction";
  if (n < 7500) return "Short story";
  if (n < 17500) return "Novelette";
  if (n < 40000) return "Novella";
  return "Novel";
}

/* ---------- outline (headings + scene breaks) and reordering ---------- */

export function bodyStart(lines: string[]): number {
  if (lines[0] !== "---") return 0;
  for (let i = 1; i < lines.length; i++) if (/^(---|\.\.\.)\s*$/.test(lines[i])) return i + 1;
  return 0;
}

export function plainTitle(s: string): string {
  return s.replace(/%%[^%]*%%/g, "").replace(/!\[\[[^\]]*\]\]/g, "").replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_~=`]/g, "").replace(/\s+/g, " ").trim();
}

export function buildOutline(text: string): Outline {
  const lines = text.split("\n");
  const start = bodyStart(lines);
  const heads: OutlineHeading[] = [], breaks: number[] = [];
  let fence = false, comment = false;
  for (let i = start; i < lines.length; i++) {
    const L = lines[i];
    const cnt = (L.match(/%%/g) || []).length;
    if (comment) { if (cnt % 2 === 1) comment = false; continue; }
    if (/^\s*(```|~~~)/.test(L)) { fence = !fence; continue; }
    if (fence) continue;
    if (cnt % 2 === 1) { comment = true; continue; }
    if (/^\s*>/.test(L)) continue;
    const h = HEADING_RE.exec(L);
    if (h) { heads.push({ line: i, level: h[2].length, title: plainTitle(h[3]) || "(untitled)" }); continue; }
    if (SCENE_RE.test(L) && (i === start || lines[i - 1].trim() === "")) breaks.push(i);
  }
  const root: OutlineNode = { id: "", level: 0, start, contentStart: start, end: lines.length, children: [], scenes: [], title: "" };
  const stack: OutlineNode[] = [root];
  for (const h of heads) {
    while (stack[stack.length - 1].level >= h.level) stack.pop();
    const parent = stack[stack.length - 1];
    const node: OutlineNode = { id: parent.id + "/h" + parent.children.length, level: h.level, title: h.title, start: h.line, contentStart: h.line + 1, end: lines.length, children: [], scenes: [], parent };
    parent.children.push(node); stack.push(node);
  }
  const all: OutlineNode[] = [];
  (function walk(n: OutlineNode): void { all.push(n); n.children.forEach(walk); })(root);
  // end of a heading node = next heading at same or higher level
  for (const n of all) {
    if (n === root) continue;
    const nxt = heads.find((h) => h.line > n.start && h.level <= n.level);
    n.end = nxt ? nxt.line : lines.length;
  }
  const nonBlank = (a: number, b: number): boolean => { for (let i = a; i < b; i++) if (lines[i].trim()) return true; return false; };
  for (const n of all) {
    const ownEnd = n.children.length ? n.children[0].start : n.end;
    const bs = breaks.filter((b) => b >= n.contentStart && b < ownEnd);
    if (!bs.length) continue;
    const segs: SceneSegment[] = [];
    let a = n.contentStart;
    for (const b of bs) { segs.push({ start: a, end: b, hasBreak: a !== n.contentStart }); a = b; }
    segs.push({ start: a, end: ownEnd, hasBreak: true });
    let k = 0;
    for (const s of segs) {
      const from = s.hasBreak ? s.start + 1 : s.start;
      if (!nonBlank(from, s.end)) { s.empty = true; continue; }
      let first = from; while (first < s.end && !lines[first].trim()) first++;
      const title = plainTitle(lines[first]).split(/\s+/).slice(0, 7).join(" ") + "…";
      const scene: Scene = Object.assign(s, { title, id: n.id + "/s" + k++, parent: n });
      n.scenes.push(scene);
    }
    n.sceneSep = lines[bs[0]].trim();
    n.leadingEmpty = segs[0].empty;
  }
  return { lines, root, all };
}

export function trimBlank(arr: string[]): string[] {
  let a = 0, b = arr.length;
  while (a < b && !arr[a].trim()) a++;
  while (b > a && !arr[b - 1].trim()) b--;
  return arr.slice(a, b);
}

/** Returns {fromLine, toLine (inclusive), text} replacing that region, or null. kind: 'h' | 's' */
export function reorder(outline: Outline, parentId: string, kind: ReorderKind, fromIdx: number, toIdx: number): ReorderResult | null {
  const parent = outline.all.find((n) => n.id === parentId);
  if (!parent) return null;
  const L = outline.lines;
  const count = kind === "h" ? parent.children.length : parent.scenes.length;
  if (fromIdx < 0 || fromIdx >= count || toIdx < 0 || toIdx >= count || fromIdx === toIdx) return null;
  const order = Array.from({ length: count }, (_, i) => i);
  const [mv] = order.splice(fromIdx, 1); order.splice(toIdx, 0, mv);
  let chunks: string[], regionStart: number, regionEnd: number;
  if (kind === "h") {
    const items = parent.children;
    chunks = items.map((n) => trimBlank(L.slice(n.start, n.end)).join("\n"));
    regionStart = items[0].start; regionEnd = items[items.length - 1].end;
    const text = order.map((i) => chunks[i]).join("\n\n");
    while (regionEnd > regionStart && !L[regionEnd - 1].trim()) regionEnd--;
    return { fromLine: regionStart, toLine: regionEnd - 1, text };
  }
  const items = parent.scenes;
  // (sceneSep is always set on nodes that have scenes)
  const sceneSep = parent.sceneSep ?? "";
  chunks = items.map((s) => trimBlank(L.slice(s.hasBreak ? s.start + 1 : s.start, s.end)).join("\n"));
  const sep = "\n\n" + sceneSep + "\n\n";
  regionStart = items[0].hasBreak ? items[0].start : items[0].start;
  while (!items[0].hasBreak && regionStart < items[0].end && !L[regionStart].trim()) regionStart++;
  regionEnd = items[items.length - 1].end;
  while (regionEnd > regionStart && !L[regionEnd - 1].trim()) regionEnd--;
  let text = order.map((i) => chunks[i]).join(sep);
  if (parent.leadingEmpty) text = sceneSep + "\n\n" + text;
  return { fromLine: regionStart, toLine: regionEnd - 1, text };
}

/* ---------- LanguageTool request building ---------- */

export function utf8len(s: string): number { let n = 0; for (const ch of s) { const c = ch.codePointAt(0) ?? 0; n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; } return n; }

/** Cut the piece list to [from,to) and split into annotation chunks of at most maxBytes. */
export function ltChunks(pieces: Piece[], from: number, to: number, maxBytes: number): LtChunk[] {
  const sel: Piece[] = [];
  for (const p of pieces) {
    const a = p.from, b = p.from + p.s.length;
    if (b <= from || a >= to) continue;
    const s = p.s.slice(Math.max(0, from - a), Math.min(p.s.length, to - a));
    const q: Piece = { k: p.k, s, from: Math.max(a, from) };
    if (p.i) q.i = p.s === s ? p.i : (s.includes("\n") ? "\n" : "");
    sel.push(q);
  }
  const chunks: Piece[][] = [];
  let cur: Piece[] = [], bytes = 0;
  const close = (): void => { if (cur.some((x) => x.k === "t" && x.s.trim())) chunks.push(cur); cur = []; bytes = 0; };
  for (const p of sel) {
    const b = utf8len(p.s);
    if (bytes + b > maxBytes && cur.length) {
      // split at the last paragraph break inside the current chunk
      let cut = -1;
      for (let i = cur.length - 1; i > 0; i--) if (cur[i].k === "m" && /\n\s*\n|\n$/.test(cur[i].s)) { cut = i + 1; break; }
      if (cut > 0 && cut < cur.length) {
        const keep = cur.slice(cut); cur = cur.slice(0, cut); close();
        cur = keep; bytes = keep.reduce((t, x) => t + utf8len(x.s), 0);
      } else close();
    }
    if (b > maxBytes && p.k === "t") {
      // a single giant paragraph: split at sentence ends
      let s = p.s, f = p.from;
      while (utf8len(s) > maxBytes) {
        let cut = Math.floor(maxBytes / 2);
        const m = s.slice(0, cut).match(/[\s\S]*[.!?…]\s/);
        if (m) cut = m[0].length;
        cur.push({ k: "t", s: s.slice(0, cut), from: f }); close();
        s = s.slice(cut); f += cut;
      }
      cur.push({ k: "t", s, from: f }); bytes += utf8len(s);
      continue;
    }
    cur.push(p); bytes += b;
  }
  close();
  return chunks.map((c) => ({
    base: c[0].from,
    text: c.map((x) => x.s).join(""),
    bytes: c.reduce((t, x) => t + utf8len(x.s), 0),
    annotation: c.map((x): LtAnnotation => (x.k === "t" ? { text: x.s } : x.i ? { markup: x.s, interpretAs: x.i } : { markup: x.s })),
  }));
}

export function issueKind(m: LtMatch): IssueKind {
  const t = (m.rule && m.rule.issueType) || "";
  const cat = (m.rule && m.rule.category && m.rule.category.id) || "";
  if (t === "misspelling" || cat === "TYPOS") return "spelling";
  if (t === "grammar" || cat === "GRAMMAR") return "grammar";
  if (t === "typographical" || t === "whitespace" || cat === "PUNCTUATION" || cat === "TYPOGRAPHY" || cat === "CASING") return "punctuation";
  return "style";
}

/** Map LanguageTool matches back to document offsets; verifies the text and relocates if it drifted. */
export function chunkPlainToDoc(chunk: LtChunk, off: number): number {
  // LanguageTool's internal plain text = text pieces + interpretAs of markup
  let p = 0, d = chunk.base;
  for (const a of chunk.annotation) {
    if (a.text !== undefined) {
      if (off <= p + a.text.length) return d + (off - p);
      p += a.text.length; d += a.text.length;
    } else {
      const ia = a.interpretAs || "";
      if (off < p + ia.length) return d;
      p += ia.length; d += a.markup.length;
    }
  }
  return d;
}

/** Map LanguageTool matches back to document offsets; verifies the text and relocates if it drifted. */
export function mapMatches(json: LtResponse | null | undefined, chunk: LtChunk, docText: string): LtIssue[] {
  const out: LtIssue[] = [];
  for (const m of (json && json.matches) || []) {
    const ctx = m.context;
    const expected = ctx && typeof ctx.text === "string" ? ctx.text.slice(ctx.offset, ctx.offset + ctx.length) : chunk.text.slice(m.offset, m.offset + m.length);
    const len = expected.length;
    if (!len) continue;
    const cands = [chunk.base + m.offset, chunkPlainToDoc(chunk, m.offset)];
    let from = -1;
    for (const c of cands) if (docText.slice(c, c + len) === expected) { from = c; break; }
    for (let dd = 1; dd < 400 && from < 0; dd++) {
      for (const c of cands) {
        if (docText.slice(c - dd, c - dd + len) === expected) { from = c - dd; break; }
        if (docText.slice(c + dd, c + dd + len) === expected) { from = c + dd; break; }
      }
    }
    if (from < 0) continue;
    out.push({
      from, to: from + len, text: expected, message: m.message || "", short: m.shortMessage || "",
      replacements: (m.replacements || []).slice(0, 6).map((r) => r.value),
      kind: issueKind(m), rule: (m.rule && m.rule.id) || "", ruleName: (m.rule && m.rule.description) || "",
      sentence: m.sentence || "",
      id: "",
    });
  }
  return out;
}
