import { editorInfoField } from "obsidian";
import { EditorView } from "@codemirror/view";
import type { EditorState, Extension } from "@codemirror/state";
import type { ToolboxPrefs } from "../constants";
import { isScriptText } from "../screenplay/fountain";
import { HR_RE } from "../text/analysis";

/* ======================================================================
   SPANISH DIALOGUE DASH (raya) — in story notes, a "-" typed at the start of a line becomes "—",
   so Obsidian doesn't turn the line into a bullet list; "--" anywhere becomes "—".
   ====================================================================== */

export function isStoryState(state: EditorState, folders: string[]): boolean {
  const head = state.doc.sliceString(0, Math.min(state.doc.length, 3000));
  if (isScriptText(head)) return false;
  const m = /^---\n([\s\S]*?)\n---/.exec(head);
  if (m && /^type:\s*["']?(\[\[)?(story|relato|cuento|novel|novela|novella|chapter|capítulo)(\]\])?["']?\s*$/mi.test(m[1])) return true;
  if (m && /^type:\s*\n\s*-\s*["']?(story|relato|cuento|novela?)["']?\s*$/mi.test(m[1])) return true;
  let path = "";
  try { const info = state.field(editorInfoField, false); path = info?.file?.path ?? ""; } catch { /* ignore */ }
  return !!path && folders.some((f) => f && path.startsWith(f.replace(/\/+$/, "") + "/"));
}

export function rayaExtension(plugin: { prefs: ToolboxPrefs }): Extension {
  return EditorView.inputHandler.of((view, from, to, text) => {
    if (text !== "-" || from !== to || !plugin.prefs.autoRaya) return false;
    const folders = String(plugin.prefs.storyFolders || "").split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
    if (!isStoryState(view.state, folders)) return false;
    const line = view.state.doc.lineAt(from);
    const before = line.text.slice(0, from - line.from);
    // inside a code block or table? leave it alone
    if (/^\s*(\||```|~~~|>)/.test(line.text)) return false;
    if (/^\s*(%%\w+%%)?\s*$/.test(before)) {
      view.dispatch({ changes: { from, insert: "—" }, selection: { anchor: from + 1 }, userEvent: "input.type" });
      return true;
    }
    if (before.endsWith("-") && !before.endsWith("--") && !/-{3,}$/.test(line.text)) {
      view.dispatch({ changes: { from: from - 1, to: from, insert: "—" }, selection: { anchor: from }, userEvent: "input.type" });
      return true;
    }
    return false;
  });
}

/** Turn existing "- text" / "-text" dialogue lines in the body into "—text". Returns number of lines changed. */
export function convertDialogueDashes(text: string): { text: string; changed: number } {
  const lines = text.split("\n");
  let i = 0, n = 0, fence = false;
  if (lines[0] === "---") { i = 1; while (i < lines.length && !/^(---|\.\.\.)\s*$/.test(lines[i])) i++; i++; }
  for (; i < lines.length; i++) {
    const L = lines[i];
    if (/^\s*(```|~~~)/.test(L)) { fence = !fence; continue; }
    if (fence || /^\s*>/.test(L) || HR_RE.test(L)) continue;
    const m = /^(\s*(?:%%\w+%%)?)(?:\\?[-–])[ \t]?(?=\S)/.exec(L);
    if (m && !/^\s*-\s*\[[ xX]\]/.test(L)) { lines[i] = m[1] + "—" + L.slice(m[0].length); n++; }
  }
  return { text: lines.join("\n"), changed: n };
}
