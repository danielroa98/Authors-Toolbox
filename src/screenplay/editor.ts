import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, MarkdownPostProcessorContext, TFile, editorLivePreviewField } from "obsidian";
import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate, keymap } from "@codemirror/view";
import { RangeSetBuilder, Prec, EditorState, Extension } from "@codemirror/state";
import { ClassifiedScript, SP_SCENE, ScriptFrontmatter, classifyScript, cueName, isScriptFM, isScriptText, isUpperLine, parseHeading, stripInline } from "./fountain";

/* ======================================================================
   SCREENPLAY — editor formatting, reading view, smart Enter, suggestions
   ====================================================================== */

export const SCRIPTS_FOLDER_DEFAULT = "Scripts";

export function docIsScript(state: EditorState): boolean {
  return isScriptText(state.doc.sliceString(0, Math.min(state.doc.length, 3000)));
}

export function buildSpDecorations(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  const state = view.state;
  if (!docIsScript(state)) return b.finish();
  const doc = state.doc;
  const { types } = classifyScript(doc.toString());
  let live = false;
  try { live = !!state.field(editorLivePreviewField, false); } catch { live = false; }
  const head = doc.lineAt(state.selection.main.head).number - 1;
  for (const { from, to } of view.visibleRanges) {
    let n = doc.lineAt(from).number - 1;
    const last = doc.lineAt(to).number - 1;
    for (; n <= last; n++) {
      const x = types[n];
      if (!x || x.t === "meta") continue;
      const line = doc.line(n + 1);
      b.add(line.from, line.from, Decoration.line({ class: `sp-line sp-${x.t}` }));
      if (live && n !== head) {
        if (x.mark) b.add(line.from + x.mark - 1, line.from + x.mark, Decoration.replace({}));
        if (x.markEnd && x.markEnd < line.length) b.add(line.to - x.markEnd, line.to, Decoration.replace({}));
      }
    }
  }
  return b.finish();
}

export const spView: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = buildSpDecorations(view); }
    update(u: ViewUpdate): void { if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = buildSpDecorations(u.view); }
  },
  { decorations: (v) => v.decorations }
);

export const spAttrs: Extension = EditorView.editorAttributes.compute(["doc"], (state: EditorState): Record<string, string> => (docIsScript(state) ? { class: "sp-script" } : {}));

/** Final Draft-style Enter: after a character cue or parenthetical stay in the dialogue block; elsewhere start a new element. */
export function smartEnter(view: EditorView): boolean {
  const st = view.state;
  if (!docIsScript(st)) return false;
  const sel = st.selection.main;
  if (!sel.empty) return false;
  const line = st.doc.lineAt(sel.head);
  if (sel.head !== line.to) return false;
  const t = line.text.trim();
  if (!t || /^(\s*[-*+]\s|\s*\d+[.)]\s|\s*>|\s*#|---)/.test(line.text) || /^\s*%%/.test(line.text)) return false;
  const { types } = classifyScript(st.doc.toString());
  const x = types[line.number - 1];
  if (!x || x.t === "meta" || x.t === "section") return false;
  const prevBlank = line.number === 1 || !st.doc.line(line.number - 1).text.trim();
  let insert = "\n\n";
  if (x.t === "character" || x.t === "paren") insert = "\n";
  else if (prevBlank && isUpperLine(t.replace(/\([^)]*\)/g, "")) && !SP_SCENE.test(t) && !/:$/.test(t) && !/^[.!>~=]/.test(t)) insert = "\n";  // a cue being typed
  else if (x.t === "dialogue") insert = "\n\n";
  view.dispatch({ changes: { from: sel.head, insert }, selection: { anchor: sel.head + insert.length }, scrollIntoView: true, userEvent: "input" });
  return true;
}
export const spKeymap: Extension = Prec.high(keymap.of([{ key: "Enter", run: smartEnter }]));

/* ---------- reading view ---------- */

export function renderInlineInto(parent: HTMLElement, s: string): void {
  s = s.replace(/%%[^%]*%%/g, "").replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2");
  const re = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) parent.appendText(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("***")) { const b = parent.createEl("strong"); b.createEl("em", { text: tok.slice(3, -3) }); }
    else if (tok.startsWith("**")) parent.createEl("strong", { text: tok.slice(2, -2) });
    else if (tok.startsWith("*")) parent.createEl("em", { text: tok.slice(1, -1) });
    else parent.createEl("u", { text: tok.slice(1, -1) });
    last = m.index + tok.length;
  }
  if (last < s.length) parent.appendText(s.slice(last));
}

export let spCache: { text: string; res: ClassifiedScript } | null = null;
export function classifyCached(text: string): ClassifiedScript {
  if (!spCache || spCache.text !== text) spCache = { text, res: classifyScript(text) };
  return spCache.res;
}

export function spPostProcess(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
  const fm = ctx.frontmatter as ScriptFrontmatter | null | undefined;
  if (!isScriptFM(fm)) return;
  const info = ctx.getSectionInfo(el);
  if (!info) return;
  const { lines, types } = classifyCached(info.text);
  const rows: number[] = [];
  for (let n = info.lineStart; n <= info.lineEnd; n++) if (types[n] && types[n]?.t !== "meta" && types[n]?.t !== "section") rows.push(n);
  if (!rows.length) return;
  if (el.querySelector(".callout, .frontmatter, .metadata-container, img, .internal-embed, ul, ol, pre, table")) return;
  el.empty();
  el.addClass("sp-sec");
  let block: HTMLElement | null = null, blockId = -1;
  for (const n of rows) {
    const x = types[n];
    if (!x) continue;
    if (x.block !== blockId) {
      blockId = x.block ?? -1;
      const dlg = x.t === "character";
      block = el.createDiv({ cls: "sp-block" + (dlg ? " sp-block-dialogue" : "") });
    }
    const raw = lines[n];
    let body = raw;
    if (x.markEnd) body = body.slice(0, body.length - x.markEnd);
    if (x.mark) body = body.slice(x.mark);
    body = body.trim();
    if (!block) continue;
    const d = block.createDiv({ cls: `sp-el sp-${x.t}` });
    if (x.t === "pagebreak") continue;
    renderInlineInto(d, body);
  }
}

/* ---------- suggestions for character cues and scene headings ---------- */

export class ScriptSuggest extends EditorSuggest<string> {
  plugin: unknown;
  constructor(app: App, plugin: unknown) {
    super(app);
    this.plugin = plugin;
    this.limit = 12;
  }
  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    if (!file) return null;
    const fm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter;
    if (!isScriptFM(fm)) return null;
    const line = editor.getLine(cursor.line);
    if (cursor.ch !== line.length || !line.trim()) return null;
    const prev = cursor.line > 0 ? editor.getLine(cursor.line - 1) : "";
    if (prev.trim()) return null;
    if (/^\.?(INT|EXT|EST|I\/E)[./ ]/i.test(line)) return { start: { line: cursor.line, ch: 0 }, end: cursor, query: line };
    const t = line.trim();
    if (t.length >= 1 && /\p{L}/u.test(t) && !/\p{Ll}/u.test(t.replace(/^@/, "")) && !/:/.test(t)) return { start: { line: cursor.line, ch: 0 }, end: cursor, query: line };
    return null;
  }
  getSuggestions(ctx: EditorSuggestContext): string[] {
    const text = ctx.editor.getValue();
    const { lines, types } = classifyScript(text);
    const q = ctx.query.toUpperCase();
    if (/^\.?(INT|EXT|EST|I\/E)/.test(q)) {
      const heads = new Set<string>(), times = new Set<string>(["DAY", "NIGHT"]);
      types.forEach((x, n) => {
        if (x && x.t === "scene" && n !== ctx.start.line) {
          const h = parseHeading(stripInline(lines[n]));
          if (h.location) heads.add(h.location);
          if (h.time) times.add(h.time);
        }
      });
      if (/[-–—]\s*\S*$/.test(q) && / [-–—] /.test(q)) {
        const base = q.replace(/\s*[-–—]\s*\S*$/, "");
        const typed = (/[-–—]\s*(\S*)$/.exec(q) || ["", ""])[1];
        return [...times].filter((t) => t.startsWith(typed)).map((t) => `${base} - ${t}`);
      }
      const m = /^(\.?(?:INT\.?\/EXT|EXT\.?\/INT|INT|EXT|EST|I\/E)\.?)\s*(.*)$/.exec(q);
      if (!m) return [];
      const prefix = m[1].replace(/^\./, "").replace(/([A-Z])$/, "$1.");
      return [...heads].filter((h) => h.startsWith(m[2])).sort().map((h) => `${prefix} ${h} - `);
    }
    const names = new Set<string>();
    types.forEach((x, n) => { if (x && x.t === "character" && n !== ctx.start.line) names.add(cueName(lines[n])); });
    const qn = q.replace(/^@/, "").trim();
    const out = [...names].filter((n) => n.startsWith(qn) && n !== qn).sort();
    if (names.has(qn)) out.unshift(...["(V.O.)", "(O.S.)", "(CONT'D)"].map((e) => `${qn} ${e}`));
    return out;
  }
  renderSuggestion(v: string, el: HTMLElement): void { el.setText(v); }
  selectSuggestion(v: string): void {
    const ctx = this.context;
    if (!ctx) return;
    ctx.editor.replaceRange(v, ctx.start, ctx.end);
    ctx.editor.setCursor({ line: ctx.start.line, ch: v.length });
  }
}

export interface ScriptTemplateOptions {
  title: string;
  date: string;
  author?: string;
  guide?: boolean;
  format?: string;
  adapted?: string;
  lang?: string;
}

export function scriptTemplate(o: ScriptTemplateOptions): string {
  const y = (v: string | number | boolean | undefined | null): string => '"' + (v != null ? String(v) : "").replace(/"/g, '\\"') + '"';
  const es = o.lang === "es";
  return [
    "---",
    "type: script",
    "cssclasses:",
    "  - screenplay",
    "status: drafting",
    `format: ${o.format || "short"}`,
    `title: ${y(o.title)}`,
    `credit: ${y(es ? "Escrito por" : "Written by")}`,
    `author: ${y(o.author || "")}`,
    o.adapted ? `adapted_from: ${y("[[" + o.adapted + "]]")}` : "adapted_from:",
    o.lang ? `lang: ${o.lang}` : null,
    `draft_date: ${o.date}`,
    `date_created: ${o.date}`,
    "logline: ",
    "---",
    "",
    es ? "> [!abstract]- Logline y notas" : "> [!abstract]- Logline & notes",
    es ? "> **Logline:** En una frase: quién, qué quiere, qué se lo impide." : "> **Logline:** One sentence: who, what they want, what stands in the way.",
    o.adapted ? (es ? `> **Basado en:** [[${o.adapted}]] — ábrelo al lado para adaptarlo escena por escena.` : `> **Based on:** [[${o.adapted}]] — keep it open alongside and adapt it scene by scene.`) : ">",
    o.guide ? (es ? "> **Formato:** ver [[Screenplay Format Guide]]." : "> **Format:** see [[Screenplay Format Guide]].") : null,
    "",
    es ? "FUNDIDO DE ENTRADA:" : "FADE IN:",
    "",
    es ? "INT. LUGAR - NOCHE" : "INT. LOCATION - NIGHT",
    "",
    es ? "Describe lo que vemos y oímos, en presente. Presenta a cada personaje la primera vez en MAYÚSCULAS: ANA (30), cansada pero lúcida."
      : "Describe what we see and hear, in the present tense. Introduce each character the first time in CAPS: ANA (30s), tired but sharp.",
    "",
    "ANA",
    es ? "(en voz baja)" : "(quietly)",
    es ? "El diálogo va debajo del nombre del personaje." : "Dialogue goes under the character's name.",
    "",
    es ? "CORTE A:" : "CUT TO:",
    "",
  ].filter((l): l is string => l !== null).join("\n");
}
