// Screenplays: editor formatting, the script tabs, scene moves, smart Enter, suggestions, Reading view,
// Fountain export and new scripts from the template.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { M, T, fixture, tick, loadPlugin, openNote } = require("./support/helpers.cjs");

after(M.teardown);
const SCRIPT = fixture("guion.md");
const SP = { ...T.fountain, ...T.scriptEditor };

test("screenplay notes", async (t) => {
  const { app, plugin } = await loadPlugin();
  const view = await openNote(app, plugin, "20_Creative_Writing/Scripts/La señal.md", SCRIPT);
  await tick(50);
  const dom = view.cmView.dom;
  const panel = plugin.panels()[0];
  const count = (cls) => dom.querySelectorAll(".cm-line." + cls).length;

  await t.test("editor lines are formatted as screenplay elements", () => {
    assert.ok(dom.classList.contains("sp-script"));
    assert.ok(count("sp-scene") >= 2 && count("sp-character") >= 2 && count("sp-paren") >= 1 && count("sp-transition") >= 1);
  });

  await t.test("every script tab renders", () => {
    for (const tab of ["sp-stats", "sp-scenes", "sp-cast", "sp-notes", "check"]) {
      plugin.prefs.panelTabScript = tab; panel.render();
      assert.doesNotMatch(panel.contentEl.textContent, /Something went wrong/, tab);
    }
    plugin.prefs.panelTabScript = "sp-stats"; panel.render();
    assert.match(panel.contentEl.textContent, /pages/);
    assert.match(panel.contentEl.textContent, /Short film/);
    assert.match(panel.contentEl.textContent, /Typical short/, "format goal from the front matter");
    plugin.prefs.panelTabScript = "sp-cast"; panel.render();
    assert.match(panel.contentEl.textContent, /TOMÁS/);
  });

  await t.test("scenes move and move back exactly", () => {
    const act = () => plugin.state.sOutline.all.find((n) => n.title === "Acto I");
    plugin.moveSection(act().id, "c", 0, 1);
    const moved = view.editor.getValue();
    assert.ok(moved.indexOf("EXT. MUELLE") < moved.indexOf("INT. COMISARÍA"));
    plugin.moveSection(act().id, "c", 1, 0);
    assert.equal(view.editor.getValue(), SCRIPT);
  });

  await t.test("smart Enter: dialogue after a cue, a new element after dialogue", () => {
    const end = view.editor.getValue().length;
    view.cmView.dispatch({ changes: { from: end, insert: "\nPEDRO" }, selection: { anchor: end + 6 } });
    assert.equal(SP.smartEnter(view.cmView), true);
    let v = view.editor.getValue();
    assert.ok(v.endsWith("\nPEDRO\n"));
    view.cmView.dispatch({ changes: { from: v.length, insert: "Hola." }, selection: { anchor: v.length + 5 } });
    SP.smartEnter(view.cmView);
    v = view.editor.getValue();
    assert.ok(v.endsWith("PEDRO\nHola.\n\n"));
  });

  await t.test("character and scene suggestions", () => {
    const sug = new SP.ScriptSuggest(app, plugin);
    const ctx = (q) => ({ editor: view.editor, query: q, start: { line: 999, ch: 0 } });
    assert.ok(sug.getSuggestions(ctx("TO")).some((s) => s.startsWith("TOMÁS")), "cue");
    assert.ok(sug.getSuggestions(ctx("INT. CO")).some((s) => s.includes("COMISARÍA")), "scene location");
  });

  await t.test("format a line as centered text or a scene heading", () => {
    view.cmView.dispatch({ changes: { from: view.editor.getValue().length, insert: "the end" } });
    plugin.formatLine(view.editor, "centered");
    assert.match(view.editor.getValue(), /> the end <\s*$/);
    const e0 = view.editor.getValue().length;
    view.cmView.dispatch({ changes: { from: e0, insert: "\n\ncocina - noche" }, selection: { anchor: e0 + 16 } });
    plugin.formatLine(view.editor, "scene");
    assert.match(view.editor.getValue(), /INT\. COCINA - NOCHE\s*$/);
  });

  await t.test("Reading view", () => {
    const text = view.editor.getValue(); const L = text.split("\n");
    const at = (line, n) => { const el = document.createElement("div"); el.createEl("p", { text: "raw" });
      SP.spPostProcess(el, { frontmatter: { type: "script" }, getSectionInfo: () => ({ text, lineStart: line, lineEnd: line + n }) }); return el; };
    const cue = at(L.indexOf("INSPECTORA VEGA"), 2);
    assert.ok(cue.querySelector(".sp-character") && cue.querySelector(".sp-paren") && cue.querySelector(".sp-dialogue"));
    const fin = at(L.indexOf("> FIN <"), 0);
    assert.ok(fin.querySelector(".sp-centered"));
    assert.equal(fin.textContent, "FIN");
  });

  await t.test("Fountain export", async () => {
    await plugin.exportFountain();
    const out = Object.keys(app.files).find((k) => k.endsWith(".fountain"));
    assert.ok(out);
    assert.match(app.files[out], /^Title: La señal/);
    assert.doesNotMatch(app.files[out], /\[!abstract\]/, "callouts are not exported");
  });

  await t.test("new scripts and adaptations from the template", async () => {
    const f = await plugin.createScript("Test script", {});
    assert.match(app.files[f.path], /type: script/);
    assert.match(app.files[f.path], /FADE IN:/);
    const f2 = await plugin.createScript("La playa (guion)", { adapted: "La playa", lang: "es", format: "short" });
    assert.match(app.files[f2.path], /adapted_from: "\[\[La playa\]\]"/);
    assert.match(app.files[f2.path], /FUNDIDO DE ENTRADA:/);
  });

  await t.test("prose notes still use the prose panel", async () => {
    await openNote(app, plugin, "Stories/La playa.md", "---\ntype: story\n---\n# La playa\n\nEl mar estaba en calma y ella caminaba sola.");
    plugin.prefs.panelTab = "overview"; panel.render();
    assert.match(panel.contentEl.textContent, /Flash fiction/);
  });
});

test("script analysis", () => {
  const a = SP.analyzeScript(SCRIPT, "es");
  assert.equal(a.scenes.length, 4, "three headings and one forced (.RECUERDO)");
  assert.deepEqual(a.characters.map((c) => c.name).sort(), ["INSPECTORA VEGA", "MARINA", "MCKENZIE", "TOMÁS"].sort(), "forced @McKENZIE counted under one name");
  assert.ok(a.pages > 0 && a.pages < 2);
  const o = SP.buildScriptOutline(SCRIPT);
  assert.deepEqual(o.all.filter((n) => n.kind !== "scene" && n.title).map((n) => n.title).slice(0, 2), ["Acto I", "Acto II"]);
});
