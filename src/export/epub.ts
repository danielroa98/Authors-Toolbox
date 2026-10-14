import { zip } from "./zip";
import { breakText, justifies, labels, titleLines } from "./manuscript";
import type { Block, ExportOptions, Manuscript, Run } from "./manuscript";

/* ======================================================================
   EPUB 3 WRITER — one XHTML file per chapter, a title page, navigation (nav + NCX for
   older readers) and a small stylesheet. The `mimetype` entry is stored first, as required.
   ====================================================================== */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function runs(rs: Run[]): string {
  return rs.map((r) => {
    let t = esc(r.text);
    if (r.i) t = `<em>${t}</em>`;
    if (r.b) t = `<strong>${t}</strong>`;
    return t;
  }).join("");
}

function page(title: string, lang: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><meta charset="UTF-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${body}
</body>
</html>`;
}

const CSS = `body { margin: 0 5%; line-height: 1.5; }
h1.title { text-align: center; margin-top: 30%; font-weight: normal; }
p.subtitle, p.byline { text-align: center; text-indent: 0; }
h2 { text-align: center; margin: 2em 0 1em; }
h3, h4, h5, h6 { text-align: center; margin: 1.5em 0 0.5em; }
p { margin: 0; text-indent: 1.5em; }
p.first, p.center, p.right, p.break { text-indent: 0; }
p.center, p.break { text-align: center; }
p.right { text-align: right; }
p.justify { text-align: justify; }
p.break { margin: 1em 0; }
blockquote { margin: 0 0 0 2em; }
p.verse { text-indent: -2em; padding-left: 2em; text-align: left; }
div.stanza { margin-bottom: 1em; }
p.end { text-align: center; text-indent: 0; margin-top: 2em; }
`;

/** Stable identifier from the title and author, so re-exports update the same book. */
function bookId(seed: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) { h1 = Math.imul(h1 ^ seed.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 + seed.charCodeAt(i), 2246822519) >>> 0; }
  const hex = (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).padEnd(32, "0");
  return `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Split the blocks into chapters at project chapters, or at the top-level headings. */
function chapters(ms: Manuscript): { title: string; blocks: Block[] }[] {
  const headings = ms.blocks.filter((b): b is Extract<Block, { kind: "heading" }> => b.kind === "heading");
  const chapterHeads = headings.some((h) => h.chapter) ? headings.filter((h) => h.chapter) : headings.filter((h) => h.level === Math.min(...headings.map((x) => x.level)));
  const out: { title: string; blocks: Block[] }[] = [];
  let cur: { title: string; blocks: Block[] } = { title: ms.title, blocks: [] };
  for (const b of ms.blocks) {
    if (b.kind === "heading" && chapterHeads.includes(b)) {
      if (cur.blocks.length) out.push(cur);
      cur = { title: b.runs.map((r) => r.text).join(""), blocks: [b] };
    } else cur.blocks.push(b);
  }
  if (cur.blocks.length) out.push(cur);
  return out;
}

function chapterBody(blocks: Block[], o: ExportOptions): string {
  const out: string[] = [];
  let firstPara = true, inStanza = false;
  const closeStanza = () => { if (inStanza) { out.push("</div>"); inStanza = false; } };
  for (const b of blocks) {
    if (b.kind !== "verse" && b.kind !== "stanza") closeStanza();
    switch (b.kind) {
      case "heading": {
        const lvl = b.chapter ? 2 : Math.min(6, Math.max(2, b.level + 1));
        out.push(`<h${lvl}>${runs(b.runs)}</h${lvl}>`);
        firstPara = true;
        break;
      }
      case "break": out.push(`<p class="break">${esc(breakText(o)) || "&#160;"}</p>`); firstPara = true; break;
      case "stanza": closeStanza(); break;
      case "verse": {
        if (!inStanza) { out.push('<div class="stanza">'); inStanza = true; }
        const pad = b.indent ? `<span style="padding-left:${(b.indent * 0.5).toFixed(1)}em"></span>` : "";
        out.push(`<p class="verse${b.align === "center" || b.align === "right" ? " " + b.align : ""}">${pad}${runs(b.runs)}</p>`);
        break;
      }
      case "para": {
        const cls = b.align === "center" || b.align === "right" ? b.align : b.align === "justify" && justifies(o) ? "justify" : firstPara ? "first" : "";
        const p = `<p${cls ? ` class="${cls}"` : ""}>${runs(b.runs)}</p>`;
        out.push(b.quote ? `<blockquote>${p}</blockquote>` : p);
        firstPara = false;
        break;
      }
    }
  }
  closeStanza();
  return out.join("\n");
}

export function buildEpub(ms: Manuscript, o: ExportOptions): Uint8Array {
  const L = labels(o.lang);
  const lang = o.lang === "es" ? "es" : "en";
  const contest = o.layout === "contest";
  const creator = contest ? o.pseudonym.trim() : o.author.trim();
  const t = titleLines(ms, o);
  const chs = chapters(ms);

  const titleBody = [
    `<h1 class="title">${esc(ms.title)}</h1>`,
    t.subtitle ? `<p class="subtitle"><em>${runs(t.subtitle.map((r) => ({ ...r, i: false })))}</em></p>` : "",
    contest && o.pseudonym.trim() ? `<p class="byline">${esc(`${L.pseudonym}: ${o.pseudonym.trim()}`)}</p>` : "",
    t.byline ? `<p class="byline">${esc(t.byline)}</p>` : "",
  ].join("\n");

  const files: { name: string; body: string }[] = [{ name: "title.xhtml", body: page(ms.title, lang, `<section epub:type="titlepage">\n${titleBody}\n</section>`) }];
  chs.forEach((c, k) => {
    const last = k === chs.length - 1;
    files.push({ name: `ch${k + 1}.xhtml`, body: page(c.title, lang, `<section epub:type="chapter">\n${chapterBody(c.blocks, o)}${last ? `\n<p class="end">${esc(L.end)}</p>` : ""}\n</section>`) });
  });

  const navList = chs.map((c, k) => `<li><a href="ch${k + 1}.xhtml">${esc(c.title)}</a></li>`).join("\n");
  const nav = page(ms.title, lang, `<nav epub:type="toc" id="toc"><h2>${lang === "es" ? "Índice" : "Contents"}</h2><ol>\n<li><a href="title.xhtml">${esc(ms.title)}</a></li>\n${navList}\n</ol></nav>`);
  const id = bookId(ms.title + "|" + creator);
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${id}"/></head>
<docTitle><text>${esc(ms.title)}</text></docTitle><navMap>
${["title.xhtml", ...chs.map((_, k) => `ch${k + 1}.xhtml`)].map((src, k) => `<navPoint id="n${k}" playOrder="${k + 1}"><navLabel><text>${esc(k === 0 ? ms.title : chs[k - 1].title)}</text></navLabel><content src="${src}"/></navPoint>`).join("\n")}
</navMap></ncx>`;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${id}</dc:identifier>
<dc:title>${esc(ms.title)}</dc:title>
${creator ? `<dc:creator>${esc(creator)}</dc:creator>` : ""}
<dc:language>${lang}</dc:language>
<meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="css" href="style.css" media-type="text/css"/>
${files.map((f, k) => `<item id="p${k}" href="${f.name}" media-type="application/xhtml+xml"/>`).join("\n")}
</manifest>
<spine toc="ncx">
${files.map((_, k) => `<itemref idref="p${k}"/>`).join("\n")}
</spine>
</package>`;
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;

  const enc = new TextEncoder();
  return zip([
    { name: "mimetype", data: enc.encode("application/epub+zip") },
    { name: "META-INF/container.xml", data: enc.encode(container) },
    { name: "OEBPS/content.opf", data: enc.encode(opf) },
    { name: "OEBPS/nav.xhtml", data: enc.encode(nav) },
    { name: "OEBPS/toc.ncx", data: enc.encode(ncx) },
    { name: "OEBPS/style.css", data: enc.encode(CSS) },
    ...files.map((f) => ({ name: `OEBPS/${f.name}`, data: enc.encode(f.body) })),
  ]);
}
