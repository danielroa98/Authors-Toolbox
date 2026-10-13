import { bodyStart, plainTitle, trimBlank, words } from "../text/analysis";

/* ======================================================================
   SCREENPLAY CORE — Fountain syntax inside Markdown notes (pure functions)
   ====================================================================== */

/** Every line classification produced by classifyScript. */
export type ScriptLineType =
  | "scene" | "action" | "character" | "dialogue" | "paren" | "transition"
  | "centered" | "pagebreak" | "section" | "synopsis" | "lyric" | "meta";

/** Screenplay element types (everything except "meta"). */
export type ScriptElement = Exclude<ScriptLineType, "meta">;

/** A non-printing line (code fence, inline comment, embed, callout…). */
export interface ScriptMetaLine {
  t: "meta";
  mark?: number;
  markEnd?: number;
  block?: number;
}

/** A printing screenplay element line. */
export interface ScriptElementLine {
  t: ScriptElement;
  /** Length of a forced-syntax prefix to hide. */
  mark: number;
  /** Length of a suffix to hide. */
  markEnd: number;
  /** 1-based index of the paragraph block this line belongs to. */
  block: number;
}

export type ScriptLine = ScriptMetaLine | ScriptElementLine;

export interface ClassifiedScript {
  lines: string[];
  /** One entry per line; null for blank lines, front matter and comments. */
  types: (ScriptLine | null)[];
}

export interface ScriptHeading {
  ie: string;
  location: string;
  time: string;
}

export interface ScriptScene extends ScriptHeading {
  line: number;
  end: number;
  heading: string;
  lines: number;
  startLine: number;
  lastBlock: number;
  cast: Set<string>;
  words: number;
  eighths: number;
}

export interface ScriptCharacter {
  name: string;
  speeches: number;
  words: number;
  scenes: Set<number>;
  firstLine: number;
}

export interface ScriptLocation {
  name: string;
  scenes: number;
  ie: Set<string>;
  times: Set<string>;
}

export interface ScriptSection {
  line: number;
  level: number;
  title: string;
}

export type ScriptNoteKind = "dense" | "speech" | "heading" | "paren" | "camera" | "unfilmable" | "intro";

export interface ScriptNote {
  kind: ScriptNoteKind;
  line: number;
  msg: string;
}

export interface ScriptIECounts {
  INT: number;
  EXT: number;
  "INT/EXT": number;
}

export interface ScriptAnalysis {
  lines: string[];
  types: (ScriptLine | null)[];
  pages: number;
  minutes: number;
  scenes: ScriptScene[];
  sections: ScriptSection[];
  characters: ScriptCharacter[];
  locations: ScriptLocation[];
  dialogueWords: number;
  actionWords: number;
  ie: ScriptIECounts;
  times: Record<string, number>;
  notes: ScriptNote[];
}

export interface OutlineGroup {
  id: string;
  level: number;
  title: string;
  start: number;
  end: number;
  children: OutlineGroup[];
  scenes: OutlineScene[];
  /** Undefined only for the root group. */
  parent?: OutlineGroup;
}

export interface OutlineScene {
  id: string;
  start: number;
  end: number;
  title: string;
  parent: OutlineGroup;
  kind: "c";
}

export interface ScriptOutline {
  lines: string[];
  root: OutlineGroup;
  all: OutlineGroup[];
}

export interface SceneReorder {
  fromLine: number;
  toLine: number;
  text: string;
}

export type ScriptFrontmatter = Record<string, unknown>;

export const SP_SCENE = /^(?:INT\.?\/EXT|EXT\.?\/INT|INT|EXT|EST|I\/E|E\/I)[.\s]/i;
export const SP_TRANS_WORDS = /^(FADE (IN|OUT)[:.]?|FADE TO BLACK\.?|CUT TO BLACK\.?|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|FUNDIDO (A NEGRO|DE ENTRADA|DE SALIDA)[.:]?|CORTE A NEGRO[.:]?|ABRE A:|ENTRA[.:]?)$/;
export const SP_WIDTH: Partial<Record<ScriptLineType, number>> = { action: 61, scene: 61, transition: 61, centered: 61, dialogue: 35, paren: 26, character: 38, lyric: 35, section: 61 };
export const SP_LINES_PER_PAGE = 55;

export function isUpperLine(s: string): boolean { return /\p{L}/u.test(s) && !/\p{Ll}/u.test(s); }

export function cueName(line: string): string {
  return line.replace(/^\s*@/, "").replace(/\^\s*$/, "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

/** True when a note's front matter marks it as a screenplay. */
export function isScriptText(text: string): boolean {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return false;
  return /^type:\s*["']?(\[\[)?(script|screenplay|guion|guión)(\]\])?["']?\s*$/mi.test(m[1]) ||
    /^cssclass(es)?:.*screenplay/m.test(m[1]) || /^\s*-\s*["']?screenplay["']?\s*$/m.test(m[1]);
}
export function isScriptFM(fm: ScriptFrontmatter | null | undefined): boolean {
  if (!fm) return false;
  const ty: unknown = fm.type;
  const first: unknown = Array.isArray(ty) ? ty[0] : ty || "";
  const t = String(first).toLowerCase().replace(/\[\[|\]\]/g, "");
  if (["script", "screenplay", "guion", "guión"].includes(t)) return true;
  const c: unknown = fm.cssclasses || fm.cssclass;
  const cArr = Array.isArray(c) ? c.map((x) => String(x ?? "")) : (typeof c === "string" ? c.split(/[,\s]+/) : []);
  return cArr.includes("screenplay");
}

/**
 * Classify every line of a Fountain-in-Markdown document.
 * Returns an array (one entry per line): null for blank/front matter/comments, otherwise
 * { t: type, mark: length of a forced-syntax prefix to hide, markEnd: length of suffix to hide, block: blockIndex }
 * types: scene, action, character, dialogue, paren, transition, centered, pagebreak, section, synopsis, lyric, meta
 */
export function classifyScript(text: string): ClassifiedScript {
  const lines = text.split("\n");
  const out = new Array<ScriptLine | null>(lines.length).fill(null);
  let i = 0;
  if (lines[0] === "---") { i = 1; while (i < lines.length && !/^(---|\.\.\.)\s*$/.test(lines[i])) i++; i++; }
  let comment = false, fence = false, block = 0;
  const blocks: number[][] = [];
  let cur: number[] | null = null;
  for (; i < lines.length; i++) {
    const L = lines[i];
    const cnt = (L.match(/%%/g) || []).length;
    if (comment) { if (cnt % 2 === 1) comment = false; cur = null; continue; }
    if (/^\s*(```|~~~)/.test(L)) { fence = !fence; out[i] = { t: "meta" }; cur = null; continue; }
    if (fence) { out[i] = { t: "meta" }; continue; }
    if (/^\s*%%/.test(L) && cnt % 2 === 1) { comment = true; cur = null; continue; }
    if (/^\s*%%.*%%\s*$/.test(L) && !/^\s*%%(center|right|left|justify)%%\S/.test(L)) { out[i] = { t: "meta" }; continue; }
    if (L.trim() === "") { cur = null; continue; }
    if (!cur) { cur = []; blocks.push(cur); }
    cur.push(i);
  }
  for (const b of blocks) {
    block++;
    let k = 0;
    while (k < b.length) {
      const n = b[k], L = lines[n], t = L.trim();
      const rest = b.length - k;
      const set = (type: ScriptLineType, mark?: number, markEnd?: number): void => { out[n] = { t: type, mark: mark || 0, markEnd: markEnd || 0, block }; };
      if (/^\s*>\s*\[!/.test(L)) { for (let j = k; j < b.length && /^\s*>/.test(lines[b[j]]); j++) { out[b[j]] = { t: "meta", block }; k = j; } k++; continue; }
      if (/^#{1,6}\s/.test(t)) { set("section"); k++; continue; }
      if (/^!?\[\[.*\]\]$/.test(t) || /^!\[.*\]\(.*\)$/.test(t)) { set("meta"); k++; continue; }
      if (/^={3,}\s*$/.test(t)) { set("pagebreak"); k++; continue; }
      if (/^=(?!=)/.test(t)) { set("synopsis", L.indexOf("=") + 1); k++; continue; }
      if (/^\.(?![.\s])/.test(t) || SP_SCENE.test(t)) {
        set("scene", /^\./.test(t) ? L.indexOf(".") + 1 : 0); k++; continue;
      }
      if (/^>.*<\s*$/.test(t)) { set("centered", L.indexOf(">") + 1, L.length - L.lastIndexOf("<")); k++; continue; }
      if (rest === 1 && k === 0 && (/^>(?!.*<\s*$)/.test(t) || (isUpperLine(t) && (/(TO|A):$/.test(t) || SP_TRANS_WORDS.test(t))))) {
        set("transition", /^>/.test(t) ? L.indexOf(">") + 1 : 0); k++; continue;
      }
      if (k === 0 && rest >= 2 && !/^!/.test(t) && (/^@/.test(t) || (isUpperLine(t.replace(/\([^)]*\)/g, "")) && !/:$/.test(t) && t.length <= 50))) {
        set("character", /^@/.test(t) ? L.indexOf("@") + 1 : 0, /\^\s*$/.test(L) ? L.length - L.lastIndexOf("^") : 0);
        for (let j = 1; j < b.length; j++) {
          const lj = lines[b[j]].trim();
          out[b[j]] = { t: /^\(.*\)$/.test(lj) ? "paren" : "dialogue", mark: 0, markEnd: 0, block };
        }
        k = b.length; continue;
      }
      if (/^~/.test(t)) { set("lyric", L.indexOf("~") + 1); k++; continue; }
      set("action", /^!/.test(t) ? L.indexOf("!") + 1 : 0);
      k++;
    }
  }
  return { lines, types: out };
}

export function wrapCount(s: string, width: number): number {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  let lines = 1, len = 0;
  for (const w of words) {
    const l = w.length;
    if (len === 0) len = l;
    else if (len + 1 + l <= width) len += 1 + l;
    else { lines++; len = l; }
    while (len > width) { lines++; len -= width; }
  }
  return lines;
}

export function stripInline(s: string): string {
  return s.replace(/%%[^%]*%%/g, "").replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/(\*\*\*|\*\*|\*|__|_|~~|==)/g, "");
}

export function parseHeading(t: string): ScriptHeading {
  let s = t.replace(/^\./, "").replace(/#[^#]+#\s*$/, "").trim();
  const m = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?|EST\.?|I\/E\.?|E\/I\.?)\s*/i.exec(s);
  let ie = "";
  if (m) { ie = m[1].toUpperCase().replace(/\.$/, "").replace(/\.\//, "/"); s = s.slice(m[0].length); }
  let time = "";
  const dash = s.split(/\s+[-–—]\s+/);
  if (dash.length > 1) { time = (dash.pop() ?? "").trim().toUpperCase(); s = dash.join(" - "); }
  return { ie: ie.startsWith("INT/") || ie.startsWith("EXT/") || ie === "I/E" || ie === "E/I" ? "INT/EXT" : ie, location: s.trim().toUpperCase(), time };
}

/** Full screenplay analysis: page estimate, scenes, characters, locations, format notes. */
export function analyzeScript(text: string, lang: string): ScriptAnalysis {
  const { lines, types } = classifyScript(text);
  const scenes: ScriptScene[] = [], chars = new Map<string, ScriptCharacter>(), locs = new Map<string, ScriptLocation>(), notes: ScriptNote[] = [];
  let total = 0, curScene: ScriptScene | null = null, dlgWords = 0, actWords = 0, prevBlock = -1, lastCue: string | null = null, speechLines = 0, speechStart = -1;
  let actionLines = 0, actionStart = -1;
  const sections: ScriptSection[] = [];
  const camera = lang === "es" ? /\b(vemos|veremos|la cámara|cámara|primer plano|plano general|zoom|paneo|panea|close up|travelling)\b/i
    : /\b(we see|we hear|we watch|camera|close on|close-up|closeup|pan to|pans|zoom|zooms|angle on|tracking shot)\b/i;
  const unfilm = lang === "es" ? /\b(piensa|pensaba|recuerda|recordaba|se da cuenta|siente que|sabe que|sabía que|se pregunta|imagina|desea)\b/i
    : /\b(thinks|thought|remembers|remembered|realizes|realised|realized|wonders|knows that|feels that|recalls|wishes)\b/i;
  const closeAction = (): void => {
    if (actionStart >= 0 && actionLines > 4) notes.push({ kind: "dense", line: actionStart, msg: `Action paragraph runs ${actionLines} lines — keep action to 3–4 lines so the page reads fast.` });
    actionLines = 0; actionStart = -1;
  };
  const closeSpeech = (): void => {
    if (speechStart >= 0 && speechLines > 6 && lastCue) notes.push({ kind: "speech", line: speechStart, msg: `${lastCue} speaks for ${speechLines} lines — long speeches slow a scene; consider breaking it up.` });
    speechLines = 0; speechStart = -1;
  };
  for (let n = 0; n < lines.length; n++) {
    const x = types[n];
    if (!x || x.t === "meta") continue;
    const raw = lines[n], body = stripInline(raw.slice(x.mark || 0, raw.length - (x.markEnd || 0))).trim();
    if (x.block !== prevBlock) {
      if (prevBlock >= 0) total += 1;  // blank line between elements
      if (x.t !== "action") closeAction();
      if (x.t !== "dialogue" && x.t !== "paren") closeSpeech();
      prevBlock = x.block;
    }
    const w = SP_WIDTH[x.t] || 61;
    const h = x.t === "pagebreak" ? 0 : x.t === "section" || x.t === "synopsis" ? 0 : wrapCount(body, w);
    if (x.t === "pagebreak") total = Math.ceil(total / SP_LINES_PER_PAGE) * SP_LINES_PER_PAGE;
    total += h;
    if (x.t === "section") {
      const lvl = (/^#+/.exec(raw.trim()) || ["#"])[0].length;
      sections.push({ line: n, level: lvl, title: plainTitle(raw.replace(/^#+\s*/, "")) });
      continue;
    }
    if (curScene && x.t !== "scene") { curScene.lines += h + (x.block !== curScene.lastBlock ? 1 : 0); curScene.lastBlock = x.block; }
    switch (x.t) {
      case "scene": {
        if (curScene) curScene.end = n;
        const hd = parseHeading(body);
        curScene = { line: n, end: lines.length, heading: body.toUpperCase(), ...hd, lines: h, startLine: total - h, lastBlock: x.block, cast: new Set<string>(), words: 0, eighths: 0 };
        scenes.push(curScene);
        if (hd.location) { const l = locs.get(hd.location) || { name: hd.location, scenes: 0, ie: new Set<string>(), times: new Set<string>() }; l.scenes++; if (hd.ie) l.ie.add(hd.ie); if (hd.time) l.times.add(hd.time); locs.set(hd.location, l); }
        if (!hd.ie && !/^\./.test(raw.trim())) notes.push({ kind: "heading", line: n, msg: `Scene heading "${body}" should start with INT. or EXT.` });
        else if (hd.ie && !hd.time) notes.push({ kind: "heading", line: n, msg: `Scene heading "${body}" has no time of day (e.g. - DAY / - NOCHE).` });
        if (/\p{Ll}/u.test(body)) notes.push({ kind: "heading", line: n, msg: `Scene headings are written in CAPITALS: "${body}".` });
        break;
      }
      case "character": {
        const name = cueName(raw.slice(x.mark || 0));
        lastCue = name;
        const c = chars.get(name) || { name, speeches: 0, words: 0, scenes: new Set<number>(), firstLine: n };
        c.speeches++; if (curScene) { c.scenes.add(curScene.line); curScene.cast.add(name); }
        chars.set(name, c);
        break;
      }
      case "dialogue": case "paren": {
        if (speechStart < 0) speechStart = n;
        speechLines += h;
        if (x.t === "dialogue") {
          const wc = words(body).length; dlgWords += wc;
          if (lastCue) { const cc = chars.get(lastCue); if (cc) cc.words += wc; }
          if (curScene) curScene.words += wc;
        } else if (words(body).length > 6) notes.push({ kind: "paren", line: n, msg: `Long parenthetical — parentheticals are for brief delivery notes; put actions in the action lines.` });
        break;
      }
      case "action": {
        if (actionStart < 0) actionStart = n;
        actionLines += h;
        const wc = words(body).length; actWords += wc; if (curScene) curScene.words += wc;
        let m: RegExpExecArray | null;
        if ((m = camera.exec(body))) notes.push({ kind: "camera", line: n, msg: `“${m[0]}” — camera directions are usually left to the director in a spec script.` });
        if ((m = unfilm.exec(body))) notes.push({ kind: "unfilmable", line: n, msg: `“${m[0]}” — only write what the audience can see or hear.` });
        break;
      }
      default: break;
    }
  }
  closeAction(); closeSpeech();
  if (curScene) curScene.end = lines.length;
  // character introductions: the first time a speaking character appears in action, the name should be in CAPS
  for (const c of chars.values()) {
    const first = c.firstLine;
    const nameWords = c.name.split(/\s+/).filter((w) => w.length > 1);
    let introduced = false;
    for (let n = 0; n < first && !introduced; n++) {
      const x = types[n];
      if (!x || x.t !== "action") continue;
      if (nameWords.some((w) => new RegExp("(^|[^\\p{L}])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^\\p{L}]|$)", "u").test(lines[n]))) introduced = true;
    }
    if (!introduced) notes.push({ kind: "intro", line: first, msg: `${c.name} speaks before being introduced — introduce new characters in action, name in CAPS, with a short description (e.g. "ANA (30s), tired but sharp").` });
  }
  const pages = total / SP_LINES_PER_PAGE;
  for (const s of scenes) s.eighths = Math.max(1, Math.round((s.lines / SP_LINES_PER_PAGE) * 8));
  const ie: ScriptIECounts = { INT: 0, EXT: 0, "INT/EXT": 0 }, times: Record<string, number> = {};
  const isIEKey = (k: string): k is keyof ScriptIECounts => k in ie;
  for (const s of scenes) { if (isIEKey(s.ie)) ie[s.ie]++; if (s.time) times[s.time] = (times[s.time] || 0) + 1; }
  notes.sort((a, b) => a.line - b.line);
  return {
    lines, types, pages, minutes: pages, scenes, sections,
    characters: [...chars.values()].sort((a, b) => b.speeches - a.speeches),
    locations: [...locs.values()].sort((a, b) => b.scenes - a.scenes),
    dialogueWords: dlgWords, actionWords: actWords, ie, times, notes,
  };
}

export function fmtEighths(e: number): string {
  const p = Math.floor(e / 8), r = e % 8;
  return (p ? p + (r ? " " : "") : "") + (r ? `${r}/8` : "") || "0";
}

/** Scenes as reorderable groups: each Markdown heading (act / sequence) holds its scenes. */
export function buildScriptOutline(text: string): ScriptOutline {
  const { lines, types } = classifyScript(text);
  const start = bodyStart(lines);
  const root: OutlineGroup = { id: "", level: 0, start, end: lines.length, children: [], scenes: [], title: "" };
  const stack: OutlineGroup[] = [root];
  const all: OutlineGroup[] = [root];
  for (let n = start; n < lines.length; n++) {
    const x = types[n];
    if (!x) continue;
    if (x.t === "section") {
      const lvl = (/^#+/.exec(lines[n].trim()) || ["#"])[0].length;
      while (stack[stack.length - 1].level >= lvl) stack.pop();
      const parent = stack[stack.length - 1];
      const node: OutlineGroup = { id: parent.id + "/h" + parent.children.length, level: lvl, title: plainTitle(lines[n].replace(/^\s*#+\s*/, "")) || "(untitled)", start: n, end: lines.length, children: [], scenes: [], parent };
      parent.children.push(node); stack.push(node); all.push(node);
    }
  }
  for (const n of all) {
    if (n === root) continue;
    const nxt = all.find((m) => m !== root && m.start > n.start && m.level <= n.level);
    n.end = nxt ? nxt.start : lines.length;
  }
  for (const n of all) {
    const ownEnd = n.children.length ? n.children[0].start : n.end;
    const heads: number[] = [];
    for (let i = n === root ? start : n.start + 1; i < ownEnd; i++) if (types[i]?.t === "scene") heads.push(i);
    heads.forEach((h, k) => {
      const end = k + 1 < heads.length ? heads[k + 1] : ownEnd;
      n.scenes.push({ id: n.id + "/c" + k, start: h, end, title: stripInline(lines[h].replace(/^\s*\./, "")).trim().toUpperCase(), parent: n, kind: "c" });
    });
  }
  return { lines, root, all };
}

export function reorderScenes(outline: ScriptOutline, parentId: string, fromIdx: number, toIdx: number): SceneReorder | null {
  const parent = outline.all.find((n) => n.id === parentId);
  if (!parent) return null;
  const items = parent.scenes, L = outline.lines;
  if (fromIdx < 0 || fromIdx >= items.length || toIdx < 0 || toIdx >= items.length || fromIdx === toIdx) return null;
  const order = items.map((_, i) => i);
  const [mv] = order.splice(fromIdx, 1); order.splice(toIdx, 0, mv);
  const chunks = items.map((s) => trimBlank(L.slice(s.start, s.end)).join("\n"));
  let regionEnd = items[items.length - 1].end;
  while (regionEnd > items[0].start && !L[regionEnd - 1].trim()) regionEnd--;
  return { fromLine: items[0].start, toLine: regionEnd - 1, text: order.map((i) => chunks[i]).join("\n\n") };
}

/** Fountain export: title page from front matter, Obsidian syntax converted. */
export function toFountain(text: string, fm?: ScriptFrontmatter | null): string {
  fm = fm || {};
  const lines = text.split("\n");
  const body = lines.slice(bodyStart(lines)).join("\n");
  const tp: string[] = [];
  const val = (v: unknown): string => {
    if (Array.isArray(v)) return v.map((item) => String(item ?? "")).join(", ").replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2");
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      return String(v).replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2");
    }
    return "";
  };
  const add = (k: string, v: unknown): void => {
    const s = val(v);
    if (s.trim()) tp.push(`${k}: ${s}`);
  };
  add("Title", fm.title); add("Credit", fm.credit); add("Author", fm.author); add("Source", fm.source || (fm.adapted_from ? "Based on " + val(fm.adapted_from) : ""));
  add("Draft date", fm.draft_date); add("Contact", fm.contact);
  const out = body
    .replace(/^\s*>\s*\[![^\n]*(\n\s*>[^\n]*)*/gm, "")                 // callouts
    .replace(/%%(center|right|left|justify)%%/g, "")
    .replace(/!\[\[[^\]]*\]\]/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")                      // wikilinks → plain text
    .replace(/%%([\s\S]*?)%%/g, (m: string, c: string) => (c.trim() ? "[[" + c.trim() + "]]" : ""))   // comments → Fountain notes
    .replace(/\n{3,}/g, "\n\n").trim();
  return (tp.length ? tp.join("\n") + "\n\n" : "") + out + "\n";
}
