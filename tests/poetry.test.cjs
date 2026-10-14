// Poetry: Spanish métrica, rhyme, form recognition, the Poem tab and verse layout in Reading view.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { M, T, fixture, tick, loadPlugin, openNote } = require("./support/helpers.cjs");

after(M.teardown);
const { metricEs, rhymeEs, analyzePoem } = T.metrics;

test("Spanish syllable count (métrica)", () => {
  // Lines from public-domain poems with their accepted counts.
  const lines = [
    ["En tanto que de rosa y azucena", 11], ["se muestra la color en vuestro gesto", 11],
    ["Verde que te quiero verde", 8], ["Caminante, no hay camino,", 8], ["se hace camino al andar", 8],
    ["Puedo escribir los versos más tristes esta noche", 14], ["Volverán las oscuras golondrinas", 11],
    ["en tu balcón sus nidos a colgar", 11], ["Era un aroma en la noche", 8], ["Yo soy un hombre sincero", 8],
    ["de donde crece la palma", 8], ["La princesa está triste... ¿Qué tendrá la princesa?", 14],
  ];
  for (const [line, want] of lines) assert.equal(metricEs(line).syllables, want, line);
});

test("rhyme keeps ñ and treats final y as a vowel", () => {
  assert.equal(rhymeEs("en la montaña").rhyme, "aña");
  assert.equal(rhymeEs("bajo la luna gitana").rhyme, "ana", "montaña and gitana do not rhyme");
  assert.equal(rhymeEs("bajo la luna gitana").assonance, rhymeEs("en la montaña").assonance, "but share the assonance á-a");
  assert.equal(rhymeEs("yo soy").rhyme, rhymeEs("me voy").rhyme);
});

test("forms", () => {
  const sonnet = `Mientras por competir con tu cabello,\noro bruñido al sol relumbra en vano;\nmientras con menosprecio en medio el llano\nmira tu blanca frente el lilio bello;\n\nmientras a cada labio, por cogello,\nsiguen más ojos que al clavel temprano;\ny mientras triunfa con desdén lozano\nde el luciente cristal tu gentil cuello,\n\ngoza cuello, cabello, labio y frente,\nantes que lo que fue en tu edad dorada\noro, lilio, clavel, cristal luciente,\n\nno sólo en plata o víola troncada\nse vuelva, mas tú y ello juntamente\nen tierra, en humo, en polvo, en sombra, en nada.`;
  const s = analyzePoem(sonnet, "es");
  assert.match(s.form, /[Ss]oneto|[Ss]onnet/);
  assert.ok(s.lines.every((l) => l.syllables === 11), s.lines.map((l) => l.syllables).join(","));
  assert.ok(s.scheme.join("").startsWith("ABBAABBA"), s.scheme.join(" "));

  const haiku = analyzePoem("Morning frost settles\non the empty garden chair\nno one comes to sit", "en");
  assert.match(haiku.form, /[Hh]aiku/);

  const romance = analyzePoem(fixture("poema.md"), "es");
  assert.match(romance.form, /[Rr]omance/);
  assert.equal(romance.lines.length, 10);
  assert.equal(romance.stanzas, 2);
  assert.ok(romance.lines.every((l) => l.syllables === 8), romance.lines.map((l) => l.syllables).join(","));
});

test("poem notes in the panel and in Reading view", async () => {
  const { app, plugin } = await loadPlugin();
  const poem = fixture("poema.md");
  await openNote(app, plugin, "Poems/Romance.md", poem);
  assert.equal(plugin.state.poem.lines.length, 10);
  const panel = plugin.panels()[0];
  plugin.prefs.panelTab = "poem"; panel.render();
  assert.match(panel.contentEl.textContent, /Esquema de rima/);
  assert.equal(panel.contentEl.querySelectorAll(".at-poem-line").length, 10);

  // indented lines arrive as a code block; they must come back as verse with their indentation
  const el = document.createElement("div");
  el.innerHTML = "<pre><code>Todo duerme, todo espera,\nbajo la luz de la escarcha.</code></pre>";
  const L = poem.split("\n"); const start = L.indexOf("    Todo duerme, todo espera,");
  for (const pp of plugin.pps) pp(el, { frontmatter: { type: "poem" }, getSectionInfo: () => ({ text: poem, lineStart: start, lineEnd: start + 1 }) });
  const verses = el.querySelectorAll(".at-verse");
  assert.equal(verses.length, 2);
  assert.equal(el.querySelector("pre"), null);
  assert.equal(verses[0].style.getPropertyValue("--at-vi"), "2.0em");
  assert.equal(verses[1].style.getPropertyValue("--at-vi"), "4.0em");
});

test("template comments are neither shown as verse nor counted", async () => {
  const { app, plugin } = await loadPlugin();
  const tpl = `---\ntype: poem\nlang: es\n---\n# Prueba\n\n%% Cada verso en su propia línea.\n   One line per line of verse. %%\n\nVerde que te quiero verde.\n`;
  const el = document.createElement("div"); el.innerHTML = "<p></p>";
  const s = tpl.split("\n").findIndex((l) => l.startsWith("%% Cada"));
  for (const pp of plugin.pps) pp(el, { frontmatter: { type: "poem" }, getSectionInfo: () => ({ text: tpl, lineStart: s, lineEnd: s + 1 }) });
  assert.equal(el.querySelector(".at-verse"), null);
  await openNote(app, plugin, "Poems/Prueba.md", tpl);
  await tick();
  assert.equal(plugin.state.poem.lines.length, 1);
});
