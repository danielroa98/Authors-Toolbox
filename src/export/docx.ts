import { zip } from "./zip";
import { labels, roundedWords, runsText } from "./manuscript";
import type { ExportOptions, Manuscript, Run } from "./manuscript";

/* ======================================================================
   WORD (.docx) WRITER — Office Open XML built by hand, zipped without dependencies.
   ====================================================================== */

const FONT_NAME = { times: "Times New Roman", courier: "Courier New", arial: "Arial" } as const;
const PAGE = { letter: { w: 12240, h: 15840 }, a4: { w: 11906, h: 16838 } } as const;
const MARGIN = 1440, INDENT = 720;

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function run(r: Run): string {
  const pr = (r.b ? "<w:b/>" : "") + (r.i ? "<w:i/>" : "");
  return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ""}<w:t xml:space="preserve">${xml(r.text)}</w:t></w:r>`;
}

interface ParaProps { align?: "left" | "center" | "right" | "both"; firstLine?: number; left?: number; single?: boolean; before?: number; pageBreak?: boolean; keepNext?: boolean; tabRight?: number }

function para(content: string, p: ParaProps = {}): string {
  const ppr = [
    p.keepNext ? "<w:keepNext/>" : "",
    p.pageBreak ? "<w:pageBreakBefore/>" : "",
    p.tabRight ? `<w:tabs><w:tab w:val="right" w:pos="${p.tabRight}"/></w:tabs>` : "",
    p.single || p.before ? `<w:spacing${p.before ? ` w:before="${p.before}"` : ""}${p.single ? ' w:line="240" w:lineRule="auto"' : ""}/>` : "",
    p.firstLine !== undefined || p.left ? `<w:ind${p.left ? ` w:left="${p.left}"` : ""} w:firstLine="${p.firstLine ?? 0}"/>` : "",
    p.align && p.align !== "left" ? `<w:jc w:val="${p.align}"/>` : "",
  ].join("");
  return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ""}${content}</w:p>`;
}

const text = (s: string) => run({ text: s });
const PAGE_FIELD = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';

/** The paragraphs of the story itself (shared by both layouts). */
function bodyXml(ms: Manuscript, o: ExportOptions): string {
  const out: string[] = [];
  const topLevel = Math.min(...ms.blocks.filter((b) => b.kind === "heading").map((b) => (b.kind === "heading" ? b.level : 9)), 9);
  let first = true;
  for (const b of ms.blocks) {
    if (b.kind === "break") { out.push(para(text("#"), { align: "center", firstLine: 0 })); continue; }
    if (b.kind === "heading") {
      const align = b.align === "justify" ? "center" : b.align;
      out.push(para(b.runs.map((r) => run({ ...r, b: true })).join(""), {
        align: align === "left" ? "left" : align, firstLine: 0, keepNext: true,
        pageBreak: o.chapterBreaks && b.level === topLevel && !first,
      }));
      first = false;
      continue;
    }
    const justify = b.align === "justify" && o.layout === "contest";
    const align = b.align === "center" || b.align === "right" ? b.align : justify ? "both" : "left";
    out.push(para(b.runs.map(run).join(""), b.quote ? { left: INDENT, firstLine: 0, align } : { align, firstLine: align === "center" || align === "right" ? 0 : INDENT }));
    first = false;
  }
  out.push(para(text(labels(o.lang).end), { align: "center", firstLine: 0 }));
  return out.join("");
}

function titleBlock(ms: Manuscript, o: ExportOptions, before: number): string {
  const out = [para(text(ms.title), { align: "center", firstLine: 0, before, keepNext: true })];
  if (ms.subtitle) out.push(para(ms.subtitle.map(run).join(""), { align: "center", firstLine: 0, keepNext: true }));
  return out.join("");
}

export function buildDocx(ms: Manuscript, o: ExportOptions): Uint8Array {
  const L = labels(o.lang);
  const page = PAGE[o.page];
  const textWidth = page.w - 2 * MARGIN;
  const lineTwips = Math.round(240 * o.spacing);
  const lang = o.lang === "es" ? "es-MX" : "en-US";
  const contest = o.layout === "contest";
  const surname = o.author.trim().split(/\s+/).pop() || "";

  let front = "";
  if (contest) {
    front = titleBlock(ms, o, 0)
      + (o.pseudonym.trim() ? para(text(`${L.pseudonym}: ${o.pseudonym.trim()}`), { align: "center", firstLine: 0 }) : "")
      + para("", { firstLine: 0 });
  } else {
    const count = `${L.about} ${roundedWords(ms.words).toLocaleString(o.lang === "es" ? "es-MX" : "en-US")} ${L.words}`;
    front = para(text(o.author.trim()) + "<w:r><w:tab/></w:r>" + text(count), { single: true, firstLine: 0, tabRight: textWidth });
    for (const line of o.contact.split("\n").map((x) => x.trim()).filter(Boolean)) front += para(text(line), { single: true, firstLine: 0 });
    front += titleBlock(ms, o, 2880)
      + (o.author.trim() ? para(text(`${L.by} ${o.author.trim()}`), { align: "center", firstLine: 0 }) : "")
      + para("", { firstLine: 0 });
  }

  const headerRef = contest
    ? '<w:footerReference w:type="default" r:id="rIdFooter"/>'
    : '<w:headerReference w:type="default" r:id="rIdHeader"/><w:titlePg/>';
  const sect = `<w:sectPr>${headerRef}<w:pgSz w:w="${page.w}" w:h="${page.h}"/><w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
  // <w:titlePg/> must come after pgMar in sectPr order
  const sectFixed = sect.replace("<w:titlePg/>", "").replace("</w:sectPr>", contest ? "</w:sectPr>" : "<w:titlePg/></w:sectPr>");

  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${front}${bodyXml(ms, o)}${sectFixed}</w:body></w:document>`;

  const headerText = [surname, ms.title].filter(Boolean).join(" / ") + " / ";
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${NS}>${para(text(headerText) + PAGE_FIELD, { align: "right", firstLine: 0, single: true })}</w:hdr>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${NS}>${para(PAGE_FIELD, { align: "center", firstLine: 0, single: true })}</w:ftr>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT_NAME[o.font]}" w:hAnsi="${FONT_NAME[o.font]}" w:cs="${FONT_NAME[o.font]}" w:eastAsia="${FONT_NAME[o.font]}"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="${lang}"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="${lineTwips}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:widowControl/></w:pPr></w:style>
</w:styles>`;

  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/></w:settings>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
${contest
    ? '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
    : '<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'}
</Relationships>`;

  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
${contest
    ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
    : '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

  // contest entries must not carry the writer's name in the file properties either
  const creator = contest ? o.pseudonym.trim() : o.author.trim();
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(ms.title)}</dc:title><dc:creator>${xml(creator)}</dc:creator><cp:lastModifiedBy>${xml(creator)}</cp:lastModifiedBy><dc:language>${lang}</dc:language></cp:coreProperties>`;

  const enc = new TextEncoder();
  const files: [string, string][] = [
    ["[Content_Types].xml", types],
    ["_rels/.rels", rootRels],
    ["docProps/core.xml", core],
    ["word/document.xml", document],
    ["word/styles.xml", styles],
    ["word/settings.xml", settings],
    ["word/_rels/document.xml.rels", rels],
    contest ? ["word/footer1.xml", footer] : ["word/header1.xml", header],
  ];
  return zip(files.map(([name, s]) => ({ name, data: enc.encode(s) })));
}

/** Plain text of a manuscript (used in tests and for a quick preview). */
export function manuscriptText(ms: Manuscript): string {
  return ms.blocks.map((b) => (b.kind === "break" ? "#" : runsText(b.runs))).join("\n");
}
