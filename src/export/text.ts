import { breakText, labels, runsText, titleLines } from "./manuscript";
import type { ExportOptions, Manuscript } from "./manuscript";

/* ======================================================================
   PLAIN TEXT — the story without markup, for submission forms that ask you to paste it.
   Paragraphs are separated by blank lines; verse keeps its lines and indentation.
   ====================================================================== */

export function buildText(ms: Manuscript, o: ExportOptions): string {
  const L = labels(o.lang);
  const t = titleLines(ms, o);
  const out: string[] = [ms.title];
  if (t.subtitle) out.push(runsText(t.subtitle));
  if (o.layout === "contest" && o.pseudonym.trim()) out.push(`${L.pseudonym}: ${o.pseudonym.trim()}`);
  if (t.byline) out.push(t.byline);
  out.push("");
  let verse = false;
  for (const b of ms.blocks) {
    if (b.kind === "verse") { out.push(" ".repeat(b.indent) + runsText(b.runs)); verse = true; continue; }
    if (verse) { out.push(""); verse = false; }
    if (b.kind === "stanza") continue;
    if (b.kind === "break") out.push(breakText(o) || "", "");
    else if (b.kind === "heading") out.push(runsText(b.runs).toUpperCase(), "");
    else out.push(runsText(b.runs), "");
  }
  if (verse) out.push("");
  out.push(L.end, "");
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}
