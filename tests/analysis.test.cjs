// Text analysis: words, sentences, dialogue, readability, the outline and LanguageTool chunks.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { T, fixture } = require("./support/helpers.cjs");

const A = T.analysis;
const slice = (s, ranges) => ranges.map((r) => s.slice(r.from ?? r[0], r.to ?? r[1]));

test("words and length categories", () => {
  assert.deepEqual(A.words("Él dijo: «semi-dormido», l'été y 3 gatos."), ["Él", "dijo", "semi-dormido", "l'été", "y", "3", "gatos"]);
  assert.equal(A.lengthCategory(999), "Flash fiction");
  assert.equal(A.lengthCategory(1000), "Short story");
  assert.equal(A.lengthCategory(7500), "Novelette");
  assert.equal(A.lengthCategory(40000), "Novel");
});

test("language detection", () => {
  assert.equal(A.detectLang(fixture("cuento-es.md")), "es");
  assert.equal(A.detectLang(fixture("story-en.md")), "en");
});

test("dialogue: Spanish rayas, including a line in the middle of a paragraph, and English quotes", () => {
  const es = "Lucía miró el mar.\n—¿Quién escribía aquí? —preguntó.\nNadie contestó.";
  const d = slice(es, A.dialogueRanges(es));
  assert.ok(d.some((x) => x.includes("¿Quién escribía aquí?")), JSON.stringify(d));
  assert.ok(!d.some((x) => x.includes("preguntó")), "the narrator's tag is not dialogue");
  assert.ok(!d.some((x) => x.includes("Nadie")));
  const en = `"You can wait," said the stationmaster. "The heater works."`;
  assert.deepEqual(slice(en, A.dialogueRanges(en)).map((x) => x.replace(/["“”]/g, "")), ["You can wait,", "The heater works."]);
});

test("analysis of a story", () => {
  const a = A.analyze(fixture("cuento-es.md"), { lang: "es" });
  assert.ok(a.words > 500 && a.words < 700);
  assert.ok(a.dialogue > 0 && a.dialogue < 0.3, "some dialogue: " + a.dialogue);
  assert.ok(a.readability && a.readability.score > 0, "Fernández Huerta");
  const en = A.analyze(fixture("story-en.md"), { lang: "en" });
  assert.match(en.readability.name, /Flesch/);
});

test("lines as paragraphs", () => {
  const text = "# T\n\nUna línea.\nOtra línea.\n\nOtro párrafo.";
  assert.equal(A.analyze(text, { lang: "es" }).paragraphs, 2);
  assert.equal(A.analyze(text, { lang: "es", linesAsParagraphs: true }).paragraphs, 3);
});

test("outline: headings, and reordering sections round-trips", () => {
  const text = fixture("cuento-es.md");
  // reorder() returns the lines to replace (fromLine..toLine) and their new text
  const apply = (t, r) => { const L = t.split("\n"); L.splice(r.fromLine, r.toLine - r.fromLine + 1, ...r.text.split("\n")); return L.join("\n"); };
  const o = A.buildOutline(text);
  const top = o.root.children[0];
  assert.equal(top.title, "El cuaderno del faro");
  assert.deepEqual(top.children.map((c) => c.title), ["Enero", "Febrero", "Marzo", "Abril", "Mayo"]);
  assert.equal(A.reorder(o, top.id, "h", 0, 5), null, "out of range");
  const moved = apply(text, A.reorder(o, top.id, "h", 0, 4));
  const o2 = A.buildOutline(moved);
  assert.deepEqual(o2.root.children[0].children.map((c) => c.title), ["Febrero", "Marzo", "Abril", "Mayo", "Enero"]);
  assert.equal(apply(moved, A.reorder(o2, o2.root.children[0].id, "h", 4, 0)), text);
});

test("LanguageTool chunks stay under the size limit and map back to the note", () => {
  const text = fixture("cuento-es.md").repeat(6);
  const map = A.proseMap(text);
  const chunks = A.ltChunks(map.pieces, 0, text.length, 6000);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(c.bytes <= 6000, String(c.bytes));
  const c = chunks[1];
  const plain = c.annotation.map((a) => (a.text !== undefined ? a.text : a.interpretAs || "")).join("");
  const at = plain.indexOf("faro");
  const doc = A.chunkPlainToDoc(c, at);
  assert.equal(text.slice(doc, doc + 4), "faro");
});
