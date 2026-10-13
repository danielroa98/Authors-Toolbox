import { Editor, Notice, editorLivePreviewField } from "obsidian";
import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { MARK, type AlignTarget } from "../constants";

/* ---------- alignment logic: one hidden marker per paragraph ---------- */

export const SKIP_START = /^(\s*)(>|\||```|~~~|<|---\s*$|\*\*\*\s*$|[-+*]\s|\d+[.)]\s|!\[\[[^\]]*\]\]\s*$|\$\$)/;

export function frontmatterEnd(editor: Editor): number {
  if (editor.getLine(0) !== "---") return -1;
  for (let i = 1; i <= editor.lastLine(); i++) if (editor.getLine(i) === "---") return i;
  return -1;
}

export function applyAlign(editor: Editor, target: AlignTarget): void {
  const sel = editor.listSelections()[0];
  const a = sel.anchor, h = sel.head;
  let from = Math.min(a.line, h.line), to = Math.max(a.line, h.line);
  const end = a.line > h.line || (a.line === h.line && a.ch > h.ch) ? a : h;
  if (to > from && end.ch === 0) to--;
  // block-level formatting: grow to whole paragraphs
  while (from > 0 && editor.getLine(from - 1).trim() !== "") from--;
  while (to < editor.lastLine() && editor.getLine(to + 1).trim() !== "") to++;

  const fmEnd = frontmatterEnd(editor);
  const starts: number[] = [];
  let inFence = false;
  for (let i = 0; i <= to; i++) {
    const t = editor.getLine(i);
    if (/^\s*(```|~~~)/.test(t)) { inFence = !inFence; continue; }
    if (inFence || i <= fmEnd || i < from) continue;
    if (t.trim() === "") continue;
    const prevBlank = i === 0 || editor.getLine(i - 1).trim() === "";
    if (!prevBlank) continue;
    if (SKIP_START.test(t) && !MARK.test(t)) continue;
    starts.push(i);
  }
  if (!starts.length) { new Notice("Click inside a paragraph or select some text first."); return; }

  const current = (i: number): string => { const m = MARK.exec(editor.getLine(i)); return m ? m[2] : "none"; };
  let newMode = target;
  if (target !== "none" && starts.every((i) => current(i) === target)) newMode = "none"; // toggle off

  for (const i of starts) {
    const t = editor.getLine(i);
    const m = MARK.exec(t);
    const prefix = m ? m[1] : (/^(\s{0,3}#{1,6}[ \t]+)/.exec(t) || ["", ""])[1];
    const rest = m ? t.slice(m[0].length) : t.slice(prefix.length);
    const out = prefix + (newMode === "none" ? "" : `%%${newMode}%%`) + rest;
    if (out !== t) editor.replaceRange(out, { line: i, ch: 0 }, { line: i, ch: t.length });
  }
}

/* ---------- Live Preview / Source mode: centre the paragraph lines ---------- */

export function buildDecorations(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  const state = view.state;
  const doc = state.doc;
  let live = false;
  try { live = !!state.field(editorLivePreviewField, false); } catch { live = false; }
  const headLine = doc.lineAt(state.selection.main.head).number;
  let cur: string | null = null, first = true;
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    const t = line.text;
    if (t.trim() === "") { first = true; cur = null; continue; }
    let m: RegExpExecArray | null = null;
    if (first) { m = MARK.exec(t); cur = m ? m[2] : null; first = false; }
    if (!cur) continue;
    b.add(line.from, line.from, Decoration.line({ class: `at-line-${cur}` }));
    // in Live Preview hide the marker itself, except on the line being edited
    if (m && live && n !== headLine) {
      const from = line.from + m[1].length;
      b.add(from, from + `%%${cur}%%`.length, Decoration.replace({}));
    }
  }
  return b.finish();
}

export const alignView = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = buildDecorations(view); }
    update(u: ViewUpdate) { if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = buildDecorations(u.view); }
  },
  { decorations: (v) => v.decorations }
);
