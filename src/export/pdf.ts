import { pageMarks, winAnsi } from "./layout";
import type { FontKey, PageLayout } from "./layout";
import type { ExportOptions } from "./manuscript";

/* ======================================================================
   PDF WRITER — prints a PageLayout with the PDF standard fonts (no embedding needed,
   so it works the same on desktop, iPhone and iPad). Text uses WinAnsiEncoding,
   which covers Spanish (ñ, á, ¿, ¡), curly quotes, « » and the em dash.
   ====================================================================== */

const FONT_RES: Record<FontKey, string> = { r: "F1", b: "F2", i: "F3", bi: "F4" };

/** A PDF string literal, ASCII-only (bytes over 127 written as octal escapes). */
function pdfString(s: string): string {
  let out = "(";
  for (const c of winAnsi(s)) {
    if (c === 0x28 || c === 0x29 || c === 0x5c) out += "\\" + String.fromCharCode(c);
    else if (c < 32 || c > 126) out += "\\" + c.toString(8).padStart(3, "0");
    else out += String.fromCharCode(c);
  }
  return out + ")";
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();

/** Metadata text: PDF "text string" in UTF-16BE so any character survives. */
function infoString(s: string): string {
  let hex = "FEFF";
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

export function buildPdf(layout: PageLayout, o: ExportOptions, title: string): Uint8Array {
  const objs: string[] = [];     // objs[k] is object number k+1
  const add = (body: string) => { objs.push(body); return objs.length; };
  const catalogId = add("");     // filled in below
  const pagesId = add("");
  const fontIds = (["r", "b", "i", "bi"] as FontKey[]).map((k) =>
    add(`<< /Type /Font /Subtype /Type1 /BaseFont /${layout.fonts[k]} /Encoding /WinAnsiEncoding >>`));
  const creator = o.layout === "contest" ? o.pseudonym.trim() : o.author.trim();
  const infoId = add(`<< /Title ${infoString(title)}${creator ? ` /Author ${infoString(creator)}` : ""} /Creator (Authors Toolbox) /Producer (Authors Toolbox) >>`);

  const fontRes = `<< ${(["r", "b", "i", "bi"] as FontKey[]).map((k, j) => `/${FONT_RES[k]} ${fontIds[j]} 0 R`).join(" ")} >>`;
  const pageIds: number[] = [];
  const size = layout.size;
  layout.pages.forEach((p, idx) => {
    const ops: string[] = [];
    const text = (s: string, f: FontKey, x: number, yTop: number, wordSpace = 0) => {
      const base = layout.height - yTop - size;
      ops.push(`BT /${FONT_RES[f]} ${size} Tf ${num(wordSpace)} Tw 1 0 0 1 ${num(x)} ${num(base)} Tm ${pdfString(s)} Tj ET`);
    };
    for (const line of p.lines) for (const s of line.segments) text(s.text, s.font, s.x, line.y, line.wordSpace);
    const mark = pageMarks(o, title, idx + 1, layout);
    if (mark) text(mark.text, "r", mark.x, mark.y);
    const stream = ops.join("\n");
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(layout.width)} ${num(layout.height)}] /Resources << /Font ${fontRes} >> /Contents ${contentId} 0 R >>`));
  });
  objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  // every character written so far is ASCII, so string length = byte length
  let out = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  objs.forEach((body, k) => { offsets.push(out.length); out += `${k + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
