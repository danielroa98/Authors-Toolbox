import { bodyStart } from "../text/analysis";
import { runsText } from "./manuscript";
import type { Block, Manuscript, Run } from "./manuscript";

/* ======================================================================
   SUBSTACK — a story or poem as a Substack post, ready to paste into the editor.
   Substack keeps the title and subtitle in fields of their own, so they are copied
   separately and the body starts with the text. What the editor offers is kept
   (paragraphs, headings, italic, bold, links, quotes, dividers); what it can't hold
   (alignment, first-line indents) is left out and reported.
   Poems: each stanza is one paragraph whose lines are joined by line breaks (what
   Shift+Enter makes in Substack), so lines stay single-spaced and never merge;
   indentation is kept with no-break spaces, which the editor doesn't collapse.
   ====================================================================== */

export type SubstackBlock =
  | { kind: "p"; lines: Run[][] }
  | { kind: "h"; level: number; runs: Run[] }
  | { kind: "quote"; paras: Run[][] }
  | { kind: "hr" };

export interface SubstackPost {
  title: string;
  subtitle: string;
  blocks: SubstackBlock[];
  /** Body as HTML, for a rich paste. */
  html: string;
  /** Body as plain text, for apps that only take text. */
  text: string;
  words: number;
}

const NBSP = " ";

/** Build the post from a manuscript (built with `links: true` to keep web links). */
export function buildSubstack(ms: Manuscript, subtitle?: string): SubstackPost {
  const blocks: SubstackBlock[] = [];
  const levels = ms.blocks.flatMap((b) => (b.kind === "heading" && !b.chapter ? [b.level] : []));
  const top = levels.length ? Math.min(...levels) : 1;
  const hasChapters = ms.blocks.some((b) => b.kind === "heading" && b.chapter);
  let stanza: Run[][] | null = null;
  let quote: Run[][] | null = null;
  const end = () => { stanza = null; quote = null; };

  for (const b of ms.blocks) {
    switch (b.kind) {
      case "verse": {
        quote = null;
        const line = b.indent ? [{ text: NBSP.repeat(b.indent) }, ...b.runs] : b.runs;
        if (stanza) stanza.push(line);
        else { stanza = [line]; blocks.push({ kind: "p", lines: stanza }); }
        break;
      }
      case "stanza": end(); break;
      case "break":
        end();
        if (blocks.length && blocks[blocks.length - 1].kind !== "hr") blocks.push({ kind: "hr" });
        break;
      case "heading": {
        end();
        // the post's title is its own field, so sections start at Heading 2; a project's chapters
        // take Heading 2 and the sections inside them one level lower
        const level = b.chapter ? 2 : Math.min(6, 2 + (b.level - top) + (hasChapters ? 1 : 0));
        blocks.push({ kind: "h", level, runs: b.runs });
        break;
      }
      case "para":
        stanza = null;
        if (b.quote) {
          if (quote) quote.push(b.runs);
          else { quote = [b.runs]; blocks.push({ kind: "quote", paras: quote }); }
        } else { quote = null; blocks.push({ kind: "p", lines: [b.runs] }); }
        break;
    }
  }
  while (blocks.length && blocks[blocks.length - 1].kind === "hr") blocks.pop();
  return {
    title: ms.title,
    subtitle: (ms.subtitle ? runsText(ms.subtitle) : subtitle ?? "").trim(),
    blocks,
    html: toHtml(blocks),
    text: toText(blocks),
    words: ms.words,
  };
}

/* ---------- HTML ---------- */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Only web and mail links are kept; anything else stays as plain text. */
export const safeHref = (url: string | undefined): string | null =>
  url && /^(https?:\/\/|mailto:)/i.test(url.trim()) ? url.trim() : null;

function runsHtml(rs: Run[]): string {
  return rs.map((r) => {
    let t = esc(r.text);
    if (r.i) t = `<em>${t}</em>`;
    if (r.b) t = `<strong>${t}</strong>`;
    const href = safeHref(r.href);
    return href ? `<a href="${esc(href)}">${t}</a>` : t;
  }).join("");
}

export function toHtml(blocks: SubstackBlock[]): string {
  return blocks.map((b) => {
    switch (b.kind) {
      case "p": return `<p>${b.lines.map(runsHtml).join("<br>")}</p>`;
      case "h": return `<h${b.level}>${runsHtml(b.runs)}</h${b.level}>`;
      case "quote": return `<blockquote>${b.paras.map((p) => `<p>${runsHtml(p)}</p>`).join("")}</blockquote>`;
      case "hr": return "<hr>";
    }
  }).join("\n");
}

/* ---------- plain text ---------- */

export function toText(blocks: SubstackBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case "p": out.push(b.lines.map(runsText).join("\n")); break;
      case "h": out.push(runsText(b.runs)); break;
      case "quote": out.push(...b.paras.map(runsText)); break;
      case "hr": out.push("* * *"); break;
    }
  }
  return out.join("\n\n") + "\n";
}

/* ---------- what doesn't carry over ---------- */

/** Things in the note that won't be in the pasted post, so the writer can add them in Substack. */
export function substackNotes(text: string, ms: Manuscript): string[] {
  const lines = text.split("\n");
  const body = lines.slice(bodyStart(lines)).join("\n").replace(/%%[\s\S]*?%%/g, "");
  const count = (re: RegExp) => (body.match(re) || []).length;
  const images = count(/!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g);
  const footnotes = new Set(body.match(/\[\^[^\]]+\](?!:)/g) || []).size;
  const tables = count(/^\s*\|.*\n\s*\|\s*:?-+/gm);
  const callouts = count(/^\s*>\s*\[!/gm);
  const code = Math.floor(count(/^\s*(```|~~~)/gm) / 2);
  const aligned = ms.blocks.filter((b: Block) => (b.kind === "para" || b.kind === "verse") && (b.align === "center" || b.align === "right")).length;
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const out: string[] = [];
  if (images) out.push(`${n(images, "image isn't", "images aren't")} copied: add them in Substack with the image button.`);
  if (footnotes) out.push(`${n(footnotes, "footnote isn't", "footnotes aren't")} copied: add them with Substack's footnote button.`);
  if (aligned) out.push(`${n(aligned, "centred or right-aligned paragraph", "centred or right-aligned paragraphs")} will be left-aligned: Substack can't align text.`);
  if (tables + callouts + code) out.push("Tables, callouts and code blocks are left out.");
  return out;
}
