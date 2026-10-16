// Copy for Substack: the post built from a story or poem, its HTML and plain text, and the window.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { M, T, fixture, loadPlugin, openNote } = require("./support/helpers.cjs");

const { buildManuscript } = T.manuscript;
const { buildSubstack, substackNotes } = T.substack;
const AUTHOR = "Autora de Prueba";
after(M.teardown);
const post = (text, poem = false, sub) => buildSubstack(buildManuscript(text, { fallbackTitle: "x", authorNames: [AUTHOR], poem, links: true }), sub);

test("a story: title and subtitle apart, the top sections as Heading 2, emphasis and dividers kept", () => {
  const p = post("# El faro\n## Un cuento de invierno\n\n### Enero\n\nLa *luz* se **apagó**.\n—Ven —dijo.\n\n***\n\nOtra escena.\n\n#### Noche\n\nFin.");
  assert.equal(p.title, "El faro");
  assert.equal(p.subtitle, "Un cuento de invierno");
  assert.doesNotMatch(p.html, /El faro|invierno/, "title and subtitle aren't in the body");
  assert.equal(p.html, [
    "<h2>Enero</h2>", "<p>La <em>luz</em> se <strong>apagó</strong>.</p>", "<p>—Ven —dijo.</p>", "<hr>",
    "<p>Otra escena.</p>", "<h3>Noche</h3>", "<p>Fin.</p>",
  ].join("\n"));
  assert.equal(p.text, "Enero\n\nLa luz se apagó.\n\n—Ven —dijo.\n\n* * *\n\nOtra escena.\n\nNoche\n\nFin.\n");
});

test("a poem: one paragraph per stanza with line breaks, indentation as no-break spaces", () => {
  const p = post(fixture("poema.md"), true);
  assert.equal(p.title, "Romance del pueblo dormido");
  const paras = p.html.split("\n");
  assert.equal(paras.length, 2, "two stanzas");
  assert.equal(paras[0].split("<br>").length, 8, "eight lines in the first stanza");
  assert.match(paras[1], /^<p> {4}Todo duerme, todo espera,<br> {8}bajo la luz/);
  assert.match(p.text, /callada\.\nUn perro/, "plain text keeps one line per verse");
});

test("links are kept (web and mail only), wikilinks become text, markup is escaped", () => {
  const p = post("# T\n\nLee [mi blog](https://example.com/a_b \"x\") o <https://ex.org>, y [[Otra nota|esa nota]]. [raro](javascript:alert(1)) 1 < 2 & *[en cursiva](https://i.com)*");
  assert.match(p.html, /<a href="https:\/\/example.com\/a_b">mi blog<\/a>/);
  assert.match(p.html, /<a href="https:\/\/ex.org">https:\/\/ex.org<\/a>/);
  assert.match(p.html, /y esa nota\./);
  assert.doesNotMatch(p.html, /javascript/);
  assert.match(p.html, /1 &lt; 2 &amp;/);
  assert.match(p.html, /<a href="https:\/\/i.com"><em>en cursiva<\/em><\/a>/);
  // the manuscript writers still drop links
  const ms = buildManuscript("# T\n\nLee [mi blog](https://example.com).", { fallbackTitle: "x", authorNames: [] });
  assert.equal(T.manuscript.runsText(ms.blocks[0].runs), "Lee mi blog.");
  assert.equal(ms.blocks[0].runs[0].href, undefined);
});

test("quotes group, footnote text and front matter stay out, the subtitle property is used", () => {
  const p = post("---\nsubtitle: De la serie\n---\n# T\n\n> Uno\n> Dos\n\nTexto[^1].\n\n[^1]: La nota.", false, "De la serie");
  assert.equal(p.subtitle, "De la serie");
  assert.equal(p.html, "<blockquote><p>Uno</p><p>Dos</p></blockquote>\n<p>Texto.</p>");
});

test("notes list what Substack won't receive", () => {
  const text = "# T\n\n![[foto.png]]\n\n%%center%%Centrado\n\nTexto[^1].\n\n[^1]: Nota.\n\n| a | b |\n|---|---|\n| 1 | 2 |";
  const ms = buildManuscript(text, { fallbackTitle: "x", authorNames: [], links: true });
  const notes = substackNotes(text, ms).join(" | ");
  assert.match(notes, /1 image isn't copied/);
  assert.match(notes, /1 footnote isn't copied/);
  assert.match(notes, /1 centred or right-aligned paragraph/);
  assert.match(notes, /Tables/);
  assert.deepEqual(substackNotes("# T\n\nSolo texto.", buildManuscript("# T\n\nSolo texto.", { fallbackTitle: "x", authorNames: [] })), []);
});

test("the command opens the window, and Copy text puts HTML and plain text on the clipboard", async () => {
  const { app, plugin } = await loadPlugin();
  await openNote(app, plugin, "Poemas/Romance.md", fixture("poema.md"));
  await plugin.copyForSubstack();
  const modal = M.Modal.last;
  assert.ok(modal instanceof T.SubstackModal);
  const prev = modal.contentEl.querySelector(".at-substack-preview");
  assert.equal(prev.querySelector("h1").textContent, "Romance del pueblo dormido");
  assert.equal(prev.querySelectorAll("p br").length, 7 + 1);

  const written = [];
  global.ClipboardItem = class { constructor(items) { this.items = items; } };
  Object.defineProperty(global.navigator, "clipboard", { configurable: true, value: { write: async (items) => { written.push(...items); }, writeText: async (t) => { written.push(t); } } });
  assert.equal(await T.copyRich("<p>a</p>", "a"), true);
  assert.deepEqual(Object.keys(written[0].items), ["text/html", "text/plain"]);
  delete global.ClipboardItem;
  assert.equal(await T.copyRich("<p>b</p>", "b"), true);
  assert.equal(written[1], "b", "plain text where rich copy isn't available");
});
