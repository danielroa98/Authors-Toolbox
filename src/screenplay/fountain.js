import { bodyStart, plainTitle, trimBlank, words } from "../text/analysis.js";

/* ======================================================================
   SCREENPLAY CORE — Fountain syntax inside Markdown notes (pure functions)
   ====================================================================== */

export const SP_SCENE = /^(?:INT\.?\/EXT|EXT\.?\/INT|INT|EXT|EST|I\/E|E\/I)[.\s]/i;
export const SP_TRANS_WORDS = /^(FADE (IN|OUT)[:.]?|FADE TO BLACK\.?|CUT TO BLACK\.?|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|FUNDIDO (A NEGRO|DE ENTRADA|DE SALIDA)[.:]?|CORTE A NEGRO[.:]?|ABRE A:|ENTRA[.:]?)$/;
export const SP_WIDTH = { action: 61, scene: 61, transition: 61, centered: 61, dialogue: 35, paren: 26, character: 38, lyric: 35, section: 61 };
export const SP_LINES_PER_PAGE = 55;

export function isUpperLine(s) { return /\p{L}/u.test(s) && !/\p{Ll}/u.test(s); }

export function cueName(line) {
  return line.replace(/^\s*@/, "").replace(/\^\s*$/, "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

/** True when a note's front matter marks it as a screenplay. */
export function isScriptText(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return false;
  return /^type:\s*["']?(\[\[)?(script|screenplay|guion|guión)(\]\])?["']?\s*$/mi.test(m[1]) ||
    /^cssclass(es)?:.*screenplay/m.test(m[1]) || /^\s*-\s*["']?screenplay["']?\s*$/m.test(m[1]);
}
export function isScriptFM(fm) {
  if (!fm) return false;
  const t = String(Array.isArray(fm.type) ? fm.type[0] : fm.type || "").toLowerCase().replace(/\[\[|\]\]/g, "");
  if (["script", "screenplay", "guion", "guión"].includes(t)) return true;
  const c = fm.cssclasses || fm.cssclass;
  return (Array.isArray(c) ? c : String(c || "").split(/[,\s]+/)).includes("screenplay");
}

/**
 * Classify every line of a Fountain-in-Markdown document.
 * Returns an array (one entry per line): null for blank/front matter/comments, otherwise
 * { t: type, mark: length of a forced-syntax prefix to hide, markEnd: length of suffix to hide, block: blockIndex }
 * types: scene, action, character, dialogue, paren, transition, centered, pagebreak, section, synopsis, lyric, meta
 */
export function classifyScript(text) {
  const lines = text.split("\n");
  const out = new Array(lines.length).fill(null);
  let i = 0;
  if (lines[0] === "---") { i = 1; while (i < lines.length && !/^(---|\.\.\.)\s*$/.test(lines[i])) i++; i++; }
  let comment = false, fence = false, block = 0;
  const blocks = [];
  let cur = null;
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
      const set = (type, mark, markEnd) => { out[n] = { t: type, mark: mark || 0, markEnd: markEnd || 0, block }; };
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

export function wrapCount(s, width) {
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

export function stripInline(s) {
  return s.replace(/%%[^%]*%%/g, "").replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/(\*\*\*|\*\*|\*|__|_|~~|==)/g, "");
}

export function parseHeading(t) {
  let s = t.replace(/^\./, "").replace(/#[^#]+#\s*$/, "").trim();
  const m = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?|EST\.?|I\/E\.?|E\/I\.?)\s*/i.exec(s);
  let ie = "";
  if (m) { ie = m[1].toUpperCase().replace(/\.$/, "").replace(/\.\//, "/"); s = s.slice(m[0].length); }
  let time = "";
  const dash = s.split(/\s+[-–—]\s+/);
  if (dash.length > 1) { time = dash.pop().trim().toUpperCase(); s = dash.join(" - "); }
  return { ie: ie.startsWith("INT/") || ie.startsWith("EXT/") || ie === "I/E" || ie === "E/I" ? "INT/EXT" : ie, location: s.trim().toUpperCase(), time };
}

/** Full screenplay analysis: page estimate, scenes, characters, locations, format notes. */
export function analyzeScript(text, lang) {
  const { lines, types } = classifyScript(text);
  const scenes = [], chars = new Map(), locs = new Map(), notes = [];
  let total = 0, curScene = null, dlgWords = 0, actWords = 0, prevBlock = -1, lastCue = null, speechLines = 0, speechStart = -1;
  let actionLines = 0, actionStart = -1;
  const sections = [];
  const camera = lang === "es" ? /\b(vemos|veremos|la cámara|cámara|primer plano|plano general|zoom|paneo|panea|close up|travelling)\b/i
    : /\b(we see|we hear|we watch|camera|close on|close-up|closeup|pan to|pans|zoom|zooms|angle on|tracking shot)\b/i;
  const unfilm = lang === "es" ? /\b(piensa|pensaba|recuerda|recordaba|se da cuenta|siente que|sabe que|sabía que|se pregunta|imagina|desea)\b/i
    : /\b(thinks|thought|remembers|remembered|realizes|realised|realized|wonders|knows that|feels that|recalls|wishes)\b/i;
  const closeAction = () => {
    if (actionStart >= 0 && actionLines > 4) notes.push({ kind: "dense", line: actionStart, msg: `Action paragraph runs ${actionLines} lines — keep action to 3–4 lines so the page reads fast.` });
    actionLines = 0; actionStart = -1;
  };
  const closeSpeech = () => {
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
        curScene = { line: n, end: lines.length, heading: body.toUpperCase(), ...hd, lines: h, startLine: total - h, lastBlock: x.block, cast: new Set(), words: 0 };
        scenes.push(curScene);
        if (hd.location) { const l = locs.get(hd.location) || { name: hd.location, scenes: 0, ie: new Set(), times: new Set() }; l.scenes++; if (hd.ie) l.ie.add(hd.ie); if (hd.time) l.times.add(hd.time); locs.set(hd.location, l); }
        if (!hd.ie && !/^\./.test(raw.trim())) notes.push({ kind: "heading", line: n, msg: `Scene heading "${body}" should start with INT. or EXT.` });
        else if (hd.ie && !hd.time) notes.push({ kind: "heading", line: n, msg: `Scene heading "${body}" has no time of day (e.g. - DAY / - NOCHE).` });
        if (/\p{Ll}/u.test(body)) notes.push({ kind: "heading", line: n, msg: `Scene headings are written in CAPITALS: "${body}".` });
        break;
      }
      case "character": {
        const name = cueName(raw.slice(x.mark || 0));
        lastCue = name;
        const c = chars.get(name) || { name, speeches: 0, words: 0, scenes: new Set(), firstLine: n };
        c.speeches++; if (curScene) { c.scenes.add(curScene.line); curScene.cast.add(name); }
        chars.set(name, c);
        break;
      }
      case "dialogue": case "paren": {
        if (speechStart < 0) speechStart = n;
        speechLines += h;
        if (x.t === "dialogue") {
          const wc = words(body).length; dlgWords += wc;
          if (lastCue && chars.has(lastCue)) chars.get(lastCue).words += wc;
          if (curScene) curScene.words += wc;
        } else if (words(body).length > 6) notes.push({ kind: "paren", line: n, msg: `Long parenthetical — parentheticals are for brief delivery notes; put actions in the action lines.` });
        break;
      }
      case "action": {
        if (actionStart < 0) actionStart = n;
        actionLines += h;
        const wc = words(body).length; actWords += wc; if (curScene) curScene.words += wc;
        let m;
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
  const ie = { INT: 0, EXT: 0, "INT/EXT": 0 }, times = {};
  for (const s of scenes) { if (s.ie in ie) ie[s.ie]++; if (s.time) times[s.time] = (times[s.time] || 0) + 1; }
  notes.sort((a, b) => a.line - b.line);
  return {
    lines, types, pages, minutes: pages, scenes, sections,
    characters: [...chars.values()].sort((a, b) => b.speeches - a.speeches),
    locations: [...locs.values()].sort((a, b) => b.scenes - a.scenes),
    dialogueWords: dlgWords, actionWords: actWords, ie, times, notes,
  };
}

export function fmtEighths(e) {
  const p = Math.floor(e / 8), r = e % 8;
  return (p ? p + (r ? " " : "") : "") + (r ? `${r}/8` : "") || "0";
}

/** Scenes as reorderable groups: each Markdown heading (act / sequence) holds its scenes. */
export function buildScriptOutline(text) {
  const { lines, types } = classifyScript(text);
  const start = bodyStart(lines);
  const root = { id: "", level: 0, start, end: lines.length, children: [], scenes: [], title: "" };
  const stack = [root];
  const all = [root];
  for (let n = start; n < lines.length; n++) {
    const x = types[n];
    if (!x) continue;
    if (x.t === "section") {
      const lvl = (/^#+/.exec(lines[n].trim()) || ["#"])[0].length;
      while (stack[stack.length - 1].level >= lvl) stack.pop();
      const parent = stack[stack.length - 1];
      const node = { id: parent.id + "/h" + parent.children.length, level: lvl, title: plainTitle(lines[n].replace(/^\s*#+\s*/, "")) || "(untitled)", start: n, end: lines.length, children: [], scenes: [], parent };
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
    const heads = [];
    for (let i = n === root ? start : n.start + 1; i < ownEnd; i++) if (types[i] && types[i].t === "scene") heads.push(i);
    heads.forEach((h, k) => {
      const end = k + 1 < heads.length ? heads[k + 1] : ownEnd;
      n.scenes.push({ id: n.id + "/c" + k, start: h, end, title: stripInline(lines[h].replace(/^\s*\./, "")).trim().toUpperCase(), parent: n, kind: "c" });
    });
  }
  return { lines, root, all };
}

export function reorderScenes(outline, parentId, fromIdx, toIdx) {
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
export function toFountain(text, fm) {
  fm = fm || {};
  const lines = text.split("\n");
  const body = lines.slice(bodyStart(lines)).join("\n");
  const tp = [];
  const val = (v) => (Array.isArray(v) ? v.join(", ") : String(v)).replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2");
  const add = (k, v) => { if (v != null && String(v).trim()) tp.push(`${k}: ${val(v)}`); };
  add("Title", fm.title); add("Credit", fm.credit); add("Author", fm.author); add("Source", fm.source || (fm.adapted_from ? "Based on " + val(fm.adapted_from) : ""));
  add("Draft date", fm.draft_date); add("Contact", fm.contact);
  const out = body
    .replace(/^\s*>\s*\[![^\n]*(\n\s*>[^\n]*)*/gm, "")                 // callouts
    .replace(/%%(center|right|left|justify)%%/g, "")
    .replace(/!\[\[[^\]]*\]\]/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")                      // wikilinks → plain text
    .replace(/%%([\s\S]*?)%%/g, (m, c) => (c.trim() ? "[[" + c.trim() + "]]" : ""))   // comments → Fountain notes
    .replace(/\n{3,}/g, "\n\n").trim();
  return (tp.length ? tp.join("\n") + "\n\n" : "") + out + "\n";
}
