// The writing panel end to end: a Spanish story in the editor, every tab, the outline, the grammar check
// (against a fake LanguageTool), note language and the settings.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { M, T, fixture, tick, loadPlugin, openNote } = require("./support/helpers.cjs");

after(M.teardown);

const STORY = fixture("cuento-es.md").replace("Don Ernesto,", "Ella tenia un un perro y lo quería muchoo. Don Ernesto,");

test("the writing panel", async (t) => {
  const { app, plugin } = await loadPlugin();
  const view = await openNote(app, plugin, "20_Creative_Writing/Stories/El cuaderno del faro.md", STORY);
  const panel = plugin.panels()[0];
  const text = () => panel.contentEl.textContent;

  await t.test("opens on first run with the word count and length", () => {
    assert.ok(panel, "panel opened");
    const words = plugin.state.analysis.words;
    assert.match(text(), new RegExp(T.analysis.lengthCategory(words)));
    assert.match(text(), /words/);
  });

  await t.test("every prose tab renders", () => {
    for (const tab of ["overview", "outline", "style", "check"]) {
      plugin.prefs.panelTab = tab; panel.render();
      assert.doesNotMatch(text(), /Something went wrong/, tab);
    }
  });

  await t.test("moving a section in the outline round-trips exactly", () => {
    plugin.prefs.panelTab = "outline"; panel.render();
    assert.ok(panel.contentEl.querySelectorAll(".at-orow").length >= 6, "outline rows");
    const before = view.editor.getValue();
    const top = plugin.state.outline.root.children[0];
    const feb = top.children.findIndex((c) => c.title === "Febrero");
    assert.ok(feb > 0, "Febrero found");
    plugin.moveSection(top.id, "h", feb, feb - 1);
    const moved = view.editor.getValue();
    assert.ok(moved.indexOf("## %%center%%Febrero") < moved.indexOf("## %%center%%Enero"), "Febrero above Enero");
    assert.equal(moved.length, before.length);
    plugin.moveSection(plugin.state.outline.root.children[0].id, "h", feb - 1, feb);
    assert.equal(view.editor.getValue(), before);
  });

  await t.test("selection statistics", () => {
    const off = view.editor.getValue().indexOf("Ella tenia");
    view.cmView.dispatch({ selection: { anchor: off, head: off + 40 } });
    plugin.updateSelection();
    plugin.prefs.panelTab = "overview"; panel.render();
    assert.match(text(), /Selection/);
    view.cmView.dispatch({ selection: { anchor: 0 } });
  });

  await t.test("grammar check: consent, offsets, fixes, dictionary", async () => {
    plugin.prefs.panelTab = "check"; panel.render();
    assert.match(text(), /Allow and continue/, "asks for consent first");
    panel.contentEl.querySelector(".at-consent button").click();
    await tick();
    assert.equal(plugin.prefs.ltConsent, true);
    for (const mode of ["full", "plain"]) {
      M.setLtMode(mode);
      await plugin.runCheck("note");
      const issues = [...plugin.check.issues.values()];
      assert.ok(issues.length >= 4, `${mode}: ${issues.length} issues`);
      for (const i of issues) assert.equal(view.editor.getValue().slice(i.from, i.to), i.text, `${mode}: offsets map back`);
    }
    const tenia = [...plugin.check.issues.values()].find((i) => i.text === "tenia");
    plugin.applyFix(tenia.id, "tenía");
    assert.ok(view.editor.getValue().includes("Ella tenía un un perro"));
    assert.ok(!plugin.check.issues.has(tenia.id));

    const carlos = [...plugin.check.issues.values()].find((i) => i.text === "Carlos");
    await plugin.addToDictionary(carlos.id);
    assert.ok(![...plugin.check.issues.values()].some((i) => i.text === "Carlos"), "every Carlos dropped");
    assert.match(plugin.prefs.ltDictionary, /Carlos/);

    view.cmView.posAtCoords = () => view.editor.getValue().indexOf("un un") + 1;
    plugin.onEditorClick({ clientX: 1, clientY: 1 }, view.cmView);
    await tick();
    assert.ok(M.Menu.last.items.some((i) => i.t === "un"), "clicking an underline offers the suggestion");
    panel.render();
    assert.ok(panel.contentEl.querySelectorAll(".at-issue-card").length > 0, "issue cards");
  });

  await t.test("note language is written to and removed from the front matter", async () => {
    await plugin.setNoteLang("en");
    await tick(300);
    assert.match(view.editor.getValue(), /\nlang: en\n/);
    assert.equal(plugin.state.langSource, "note");
    await plugin.setNoteLang("auto");
    await tick(300);
    assert.doesNotMatch(view.editor.getValue(), /\nlang:/);
  });

  await t.test("switching to an English note shows Flesch readability and clears the check", async () => {
    await openNote(app, plugin, "x/The Last Train.md", fixture("story-en.md"));
    plugin.prefs.panelTab = "overview"; panel.render();
    assert.match(text(), /Flesch/);
    assert.equal(plugin.check, null);
  });
});

test("settings", async () => {
  const { plugin } = await loadPlugin();
  const tab = plugin.tab;
  const groups = tab.getSettingDefinitions();
  const items = groups.flatMap((g) => g.items);
  assert.deepEqual(groups.map((g) => g.heading ?? g.name ?? g.title).filter(Boolean).length, groups.length, "every group is named");
  assert.ok(groups.length >= 7 && items.length >= 30, `groups ${groups.length}, settings ${items.length}`);
  assert.ok(items.every((d) => d.name && (d.control || d.render)), "every setting has a control");
  assert.equal(tab.getControlValue("readingWpm"), 230);
  assert.ok(String(tab.getControlValue("crutchEn")).startsWith("very"), "crutch list shows the default");
  await tab.setControlValue("readingWpm", 0); assert.equal(plugin.prefs.readingWpm, 230, "invalid number falls back");
  await tab.setControlValue("defaultGoal", 0); assert.equal(plugin.prefs.defaultGoal, 0);
  await tab.setControlValue("defaultGoal", 1500); assert.equal(plugin.prefs.defaultGoal, 1500);
  await tab.setControlValue("scriptsFolder", "  "); assert.equal(plugin.prefs.scriptsFolder, "Scripts");
  await tab.setControlValue("authorName", "  Ana Pérez "); assert.equal(plugin.prefs.authorName, "Ana Pérez");
  await tab.setControlValue("dailyGoal", 500); assert.equal(plugin.prefs.dailyGoal, 500);
  tab.display();
  assert.ok(tab.containerEl, "display() fallback renders");
});

test("dialogue dashes become rayas while typing in stories only", async () => {
  const { EditorView } = require("@codemirror/view");
  const { app } = await loadPlugin();
  const make = (text) => { const v = new M.MarkdownView(app, M.file("x.md"), text); v.cmView.dispatch({ selection: { anchor: text.length } }); return v; };
  const type = (v, s) => {
    for (const ch of s) {
      const pos = v.cmView.state.selection.main.head;
      const handled = v.cmView.state.facet(EditorView.inputHandler).some((h) => h(v.cmView, pos, pos, ch, () => null));
      if (!handled) v.cmView.dispatch({ changes: { from: pos, insert: ch }, selection: { anchor: pos + 1 } });
    }
  };
  const story = make("---\ntype: story\nlang: es\n---\n# Vuelve\n\n");
  type(story, "-Karla, vuelve --dijo él-- por favor.");
  assert.ok(story.editor.getValue().endsWith("—Karla, vuelve —dijo él— por favor."), story.editor.getValue());
  type(story, "\nUna palabra semi-dormida.");
  assert.ok(story.editor.getValue().endsWith("semi-dormida."));
  const note = make("---\ntype: note\n---\n");
  type(note, "- item");
  assert.ok(note.editor.getValue().endsWith("- item"), "other notes keep Markdown lists");
  const script = make("---\ntype: script\n---\n");
  type(script, "- x");
  assert.ok(script.editor.getValue().endsWith("- x"), "scripts untouched");
  const converted = T.raya.convertDialogueDashes("---\ntype: story\n---\n- Hola.\n-Adiós.\n- [ ] tarea\n");
  assert.equal(converted.text, "---\ntype: story\n---\n—Hola.\n—Adiós.\n- [ ] tarea\n", "existing dialogue lines converted, tasks kept");
  assert.equal(converted.changed, 2);
});

test("insert image: browse folders without listing the whole vault", async () => {
  const { app, plugin } = await loadPlugin();
  const { TFolder, TFile } = M.obsidian;
  const root = new TFolder("", null); const byPath = { "": root };
  const add = (p, folder) => {
    const parent = byPath[p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ""];
    const n = folder ? new TFolder(p, parent) : new TFile(p, parent);
    parent.children.push(n); byPath[p] = n;
  };
  add("98_Attachments", true); add("98_Attachments/Art", true); add("98_Attachments/Art/cover.jpeg");
  add("98_Attachments/a.png"); add("98_Attachments/notes.md"); add("Stories", true); add("Stories/x.md");
  app.vault.getRoot = () => root; app.vault.getAbstractFileByPath = (p) => byPath[p] || null;
  let listed = false; app.vault.getFiles = () => { listed = true; return []; };
  app.fileManager.getAvailablePathForAttachment = async (n) => "98_Attachments/" + n;
  app.metadataCache.fileToLinktext = (f) => f.name;
  const view = new M.MarkdownView(app, byPath["Stories/x.md"], "Hello\n");
  app.activeView = view;
  plugin.cmds.find((c) => c.id === "insert-image").editorCallback(view.editor, view);
  await tick(30);
  const modal = M.Modal.last;
  const options = () => [...modal.list.options].map((o) => o.value);
  assert.ok(options().includes("d:98_Attachments/Art"), "subfolder listed");
  assert.ok(!options().some((v) => v.endsWith("notes.md")), "notes are not offered as images");
  modal.list.value = "d:98_Attachments/Art"; modal.list.onchange();
  modal.list.value = "f:98_Attachments/Art/cover.jpeg"; modal.list.onchange();
  assert.equal(modal.file.path, "98_Attachments/Art/cover.jpeg");
  await modal.insert();
  assert.match(view.editor.getValue(), /cover\.jpeg/);
  assert.equal(listed, false);
});
