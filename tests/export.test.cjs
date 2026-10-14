// Manuscript export: the shared model, page layout, and every writer (PDF, Word, EPUB, plain text).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { T, fixture } = require("./support/helpers.cjs");

const { buildManuscript, compileProject } = T.manuscript;
const AUTHOR = "Autora de Prueba";
const base = {
  layout: "manuscript", font: "times", spacing: 2, page: "letter", author: AUTHOR, contact: "correo@example.com",
  pseudonym: "La Navegante", chapterBreaks: false, keepJustify: false, sceneBreak: "#", coverPage: false, lang: "es",
};
const story = () => buildManuscript(fixture("cuento-es.md"), { fallbackTitle: "x", authorNames: [AUTHOR] });
const latin1 = (bytes) => Buffer.from(bytes).toString("latin1");
/** Names of the files in a (stored) zip, in order. */
const zipNames = (bytes) => {
  const b = Buffer.from(bytes); const names = [];
  for (let i = 0; i + 30 < b.length; i++) {
    if (b.readUInt32LE(i) !== 0x04034b50) continue;
    const n = b.readUInt16LE(i + 26), extra = b.readUInt16LE(i + 28), size = b.readUInt32LE(i + 18);
    names.push({ name: b.toString("utf8", i + 30, i + 30 + n), method: b.readUInt16LE(i + 8) });
    i += 29 + n + extra + size;
  }
  return names;
};

test("the manuscript model", () => {
  const ms = story();
  assert.equal(ms.title, "El cuaderno del faro");
  const kinds = ms.blocks.map((b) => b.kind);
  assert.equal(kinds.filter((k) => k === "heading").length, 5, "one heading per month (the first is a section, not a subtitle)");
  assert.equal(ms.subtitle, null);
  assert.equal(kinds.filter((k) => k === "break").length, 1, "the # scene break");
  assert.ok(ms.words > 500 && ms.words < 700, String(ms.words));
  const text = JSON.stringify(ms);
  assert.doesNotMatch(text, /%%|type: story/, "markers and front matter are dropped");
  assert.ok(ms.blocks.some((b) => b.kind === "heading" && b.align === "center"), "%%center%% headings are centred");
});

test("a heading under the title is a subtitle, or a byline when it is the author's name", () => {
  const sub = buildManuscript("# Título\n\n## Una historia de verano\n\nTexto.", { fallbackTitle: "x", authorNames: [AUTHOR] });
  assert.equal(sub.subtitle[0].text, "Una historia de verano");
  const by = buildManuscript(`# Título\n## ${AUTHOR}\n\nTexto.`, { fallbackTitle: "x", authorNames: [AUTHOR] });
  assert.equal(by.subtitle, null);
  assert.ok(!JSON.stringify(by.blocks).includes(AUTHOR));
});

test("PDF: valid structure, page numbers in the header, a byline", () => {
  const ms = story();
  const pages = T.layout.layoutManuscript(ms, base);
  const pdf = latin1(T.buildPdf(pages, base, ms.title));
  assert.ok(pdf.startsWith("%PDF-1."));
  assert.ok(pdf.trimEnd().endsWith("%%EOF"));
  assert.match(pdf, new RegExp(`/Count ${pages.pages.length} `));
  const xref = Number(/startxref\n(\d+)/.exec(pdf)[1]);
  assert.equal(pdf.slice(xref, xref + 4), "xref", "startxref points at the table");
  assert.ok(pages.pages.length >= 3, `${pages.pages.length} pages double-spaced`);
  assert.equal(T.layout.pageMarks(base, ms.title, 1, pages), null, "no header on the first page");
  assert.equal(T.layout.pageMarks(base, ms.title, 2, pages).text, "Prueba / El cuaderno del faro / 2", "surname / title / page");
  assert.equal(T.layout.pageMarks({ ...base, layout: "contest" }, ms.title, 2, pages).text, "2", "contest: number only");
});

test("Word: a stored zip with the document parts", () => {
  const docx = T.buildDocx(story(), base);
  const names = zipNames(docx).map((e) => e.name);
  for (const part of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml"]) assert.ok(names.includes(part), part);
  assert.match(latin1(docx), /El cuaderno del faro/);
});

test("EPUB: mimetype first and uncompressed, one file per chapter", () => {
  const ms = compileProject("Cuentos", [
    { text: fixture("cuento-es.md"), title: "El cuaderno del faro", poem: false },
    { text: fixture("poema.md"), title: "Romance del pueblo dormido", poem: true },
  ], [AUTHOR]);
  const entries = zipNames(T.buildEpub(ms, base));
  assert.deepEqual(entries[0], { name: "mimetype", method: 0 });
  assert.ok(entries.some((e) => e.name === "OEBPS/nav.xhtml"));
  assert.equal(entries.filter((e) => /OEBPS\/ch\d+\.xhtml/.test(e.name)).length, 2);
});

test("projects: chapters in order, total words, verse kept", () => {
  const ms = compileProject("Cuentos", [
    { text: fixture("cuento-es.md"), title: "El cuaderno del faro", poem: false },
    { text: fixture("poema.md"), title: "Romance del pueblo dormido", poem: true },
  ], [AUTHOR]);
  const chapters = ms.blocks.filter((b) => b.kind === "heading" && b.chapter);
  assert.equal(chapters.length, 2);
  assert.equal(ms.blocks.filter((b) => b.kind === "verse").length, 10);
  assert.equal(ms.blocks.find((b) => b.kind === "verse" && b.indent === 8).runs[0].text, "bajo la luz de la escarcha.");
  const poemWords = buildManuscript(fixture("poema.md"), { fallbackTitle: "x", authorNames: [], poem: true }).words;
  assert.equal(ms.words, story().words + poemWords + 8, "both notes plus their chapter titles");
});

test("contest entries never contain the author's name", () => {
  const ms = story();
  const o = { ...base, layout: "contest", coverPage: true };
  const outputs = {
    pdf: latin1(T.buildPdf(T.layout.layoutManuscript(ms, o), o, ms.title)),
    docx: latin1(T.buildDocx(ms, o)),
    epub: latin1(T.buildEpub(ms, o)),
    txt: T.buildText(ms, o),
  };
  for (const [fmt, out] of Object.entries(outputs)) {
    assert.ok(!out.includes(AUTHOR) && !out.includes("correo@example.com"), `${fmt}: no name or contact`);
    if (fmt !== "pdf") assert.ok(out.includes("La Navegante"), `${fmt}: pseudonym`);
  }
});

test("plain text: no markers, scene breaks kept", () => {
  const txt = T.buildText(story(), { ...base, sceneBreak: "* * *" });
  assert.doesNotMatch(txt, /%%|\*\*|---/);
  assert.match(txt, /\n\* \* \*\n/);
  assert.match(txt, /^El cuaderno del faro/);
});
