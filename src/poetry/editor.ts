import type { MarkdownPostProcessorContext } from "obsidian";
import { EditorView } from "@codemirror/view";
import type { EditorState, Extension } from "@codemirror/state";
import { MARK } from "../constants";
import { renderInlineInto } from "../screenplay/editor";
import { isPoemFM, isPoemText } from "./poem";

/* ======================================================================
   POEM LAYOUT — in the editor and in Reading view, every line stays a line,
   indentation is kept, and long lines wrap with a hanging indent.
   ====================================================================== */

export function docIsPoem(state: EditorState): boolean {
  return isPoemText(state.doc.sliceString(0, Math.min(state.doc.length, 3000)));
}

/** Marks the editor of a poem note, so the stylesheet can lay lines out as verse. */
export const poemAttrs: Extension = EditorView.editorAttributes.compute(["doc"], (state: EditorState): Record<string, string> => (docIsPoem(state) ? { class: "at-poem" } : {}));

/**
 * Reading view: rebuild each stanza from its source lines. Markdown would otherwise merge lines
 * (with "strict line breaks" on), drop leading spaces, or turn indented lines into code blocks.
 */
export function poemPostProcess(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
  if (!isPoemFM(ctx.frontmatter as Record<string, unknown> | undefined)) return;
  const info = ctx.getSectionInfo(el);
  if (!info) return;
  // leave headings, callouts, embeds, lists, tables and rules as Obsidian renders them
  if (el.querySelector(".callout, .frontmatter, .metadata-container, img, .internal-embed, h1, h2, h3, h4, h5, h6, ul, ol, table, hr")) return;
  const lines = info.text.split("\n").slice(info.lineStart, info.lineEnd + 1);
  if (!lines.some((l) => l.trim()) || lines.some((l) => /^\s*(```|~~~)/.test(l) || /^\s*%%\s*$/.test(l))) return;
  el.empty();
  el.addClass("at-poem-sec");
  const stanza = el.createDiv({ cls: "at-stanza" });
  for (const raw of lines) {
    if (!raw.trim()) continue;
    let line = raw.replace(/^\s*>\s?/, "");
    const lead = /^[ \t]*/.exec(line)?.[0] ?? "";
    line = line.slice(lead.length);
    const mk = MARK.exec(line);
    let align = "";
    if (mk) { align = mk[2]; line = mk[1] + line.slice(mk[0].length); }
    const div = stanza.createDiv({ cls: "at-verse" + (align === "center" || align === "right" ? ` at-verse-${align}` : "") });
    div.setCssProps({ "--at-vi": `${(lead.replace(/\t/g, "    ").length * 0.5).toFixed(1)}em` });
    renderInlineInto(div, line);
  }
}
