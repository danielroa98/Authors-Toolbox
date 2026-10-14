// Revision mode: the comparison engine, drafts, the revision view, restoring text, marks in the editor
// and the Word file with tracked changes.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { M, T, fixture, tick, loadPlugin, openNote } = require("./support/helpers.cjs");

after(M.teardown);
const D = T.revDiff;
const STORY = fixture("cuento-es.md");

/** The story revised: one paragraph rewritten, one cut, one added, one moved to another chapter, a chapter renamed. */
function revise(text) {
  return text
    .replace("Los peldaños crujían bajo sus botas y el viento se colaba por las grietas de la piedra, silbando como un animal herido.",
      "Los peldaños gemían bajo sus botas y el viento entraba por las grietas, silbando como un animal herido.")
    .replace("Esa noche no pudo dormir. Copió las palabras subrayadas en una hoja, en orden, y las leyó en voz baja hasta que el cielo empezó a clarear.\n\n", "")
    .replace("A lo lejos, un barco sin nombre cambió de rumbo.", "A lo lejos, un barco sin nombre cambió de rumbo.\n\nNadie en el pueblo volvió a hablar de Carlos.")
    .replace("—Hay cosas que es mejor dejar en el mar —le dijo una anciana mientras pesaba un kilo de almejas.\n\n", "")
    .replace("## %%center%%Abril\n\n", "## %%center%%Abril\n\n—Hay cosas que es mejor dejar en el mar —le dijo una anciana mientras pesaba un kilo de almejas.\n\n")
    .replace("## %%center%%Mayo", "## %%center%%Mayo, la luz");
}
const REVISED = revise(STORY);

test("diffSeq is a correct shortest edit script", () => {
  const rnd = (n) => Array.from({ length: n }, () => "abcd"[Math.floor(Math.random() * 4)]);
  for (let t = 0; t < 1500; t++) {
    const A = rnd(Math.floor(Math.random() * 25)), B = rnd(Math.floor(Math.random() * 25));
    const e = D.diffSeq(A, B);
    assert.equal(e.filter((x) => x.op !== 1).map((x) => A[x.a]).join(""), A.join(""));
    assert.equal(e.filter((x) => x.op !== -1).map((x) => B[x.b]).join(""), B.join(""));
    for (const x of e) if (x.op === 0) assert.equal(A[x.a], B[x.b]);
  }
  assert.equal(D.diffSeq("abcabba".split(""), "cbabac".split("")).filter((x) => x.op !== 0).length, 5, "Myers' example: 5 edits");
});

test("word changes inside a paragraph read as cut / added", () => {
  const segs = D.diffWords("El perro corría por el campo.", "El perro negro corría por la playa.");
  assert.deepEqual(segs, [
    { op: 0, text: "El perro " }, { op: 1, text: "negro " }, { op: 0, text: "corría por " },
    { op: -1, text: "el campo" }, { op: 1, text: "la playa" }, { op: 0, text: "." },
  ]);
});

test("comparing two versions of a story", () => {
  const c = D.compareTexts(STORY, REVISED);
  const kinds = c.ops.map((o) => o.kind);
  const count = (k) => kinds.filter((x) => x === k).length;
  assert.equal(count("changed"), 2, "the rewritten paragraph and the renamed chapter");
  assert.equal(count("removed"), 1, "the cut paragraph");
  assert.equal(count("added"), 1, "the new paragraph");
  assert.equal(count("moved"), 1); assert.equal(count("moved-away"), 1);
  const rewritten = c.ops.find((o) => o.kind === "changed" && !c.b[o.b].heading);
  assert.ok(rewritten.segs.some((s) => s.op === -1 && s.text.includes("crujían")));
  assert.ok(rewritten.segs.some((s) => s.op === 1 && s.text.includes("gemían")));
  const s = c.stats;
  assert.equal(s.after - s.before, D.notePars(REVISED).reduce((n, p) => n + (p.heading ? 0 : p.words), 0) - D.notePars(STORY).reduce((n, p) => n + (p.heading ? 0 : p.words), 0));
  assert.ok(s.added > 0 && s.removed > s.added, `+${s.added} −${s.removed}`);
  assert.ok(s.moved > 10);
  assert.ok(s.changed > 0 && s.changed < 0.2, String(s.changed));

  const row = (t) => c.sections.find((r) => r.title === t);
  const cut = D.countWords("Esa noche no pudo dormir. Copió las palabras subrayadas en una hoja, en orden, y las leyó en voz baja hasta que el cielo empezó a clarear.");
  const moved = D.countWords("—Hay cosas que es mejor dejar en el mar —le dijo una anciana mientras pesaba un kilo de almejas.");
  assert.equal(row("Enero").status, "rewritten");
  assert.equal(row("Febrero").removed, cut, "the cut paragraph counts in its chapter");
  assert.equal(row("Marzo").after, row("Marzo").before - moved, "the moved paragraph left Marzo");
  assert.equal(row("Abril").after, row("Abril").before + moved, "and arrived in Abril");
  assert.equal(row("Abril").added, 0, "moving is not adding");
  assert.equal(row("Mayo, la luz").status, "rewritten", "a renamed chapter is matched to the old one (and has a new paragraph)");
  assert.equal(row("Mayo, la luz").before, D.compareTexts(STORY, STORY).sections.find((r) => r.title === "Mayo").before);
  const ren = D.compareTexts("# T\n\n## Uno\n\nTexto.\n\n## Dos\n\nMás.", "# T\n\n## Uno\n\nTexto.\n\n## Segundo\n\nMás.").sections;
  assert.equal(ren.find((r) => r.title === "Segundo").status, "renamed");
});

test("sections: new, cut and reordered chapters", () => {
  const a = "# T\n\n## Uno\n\nUno uno.\n\n## Dos\n\nDos dos.\n\n## Tres\n\nTres tres.\n";
  const b = "# T\n\n## Dos\n\nDos dos.\n\n## Uno\n\nUno uno.\n\n## Cuatro\n\nCuatro cuatro cuatro.\n";
  const rows = D.compareTexts(a, b).sections;
  const st = Object.fromEntries(rows.map((r) => [r.title, r.status]));
  assert.equal(st.Cuatro, "new");
  assert.equal(st.Tres, "cut");
  assert.ok(st.Uno === "moved" || st.Dos === "moved", JSON.stringify(st));
});

test("marks for the editor", () => {
  const m = D.lineMarks("a\nb\nc\nd\n", "a\nB\nc\nnew\nd\n");
  assert.deepEqual(m, { added: [3], changed: [1], cutBefore: [] });
  assert.deepEqual(D.lineMarks("a\nb\nc", "a\nc").cutBefore, [1]);
  assert.deepEqual(D.lineMarks("a\nb", "a").cutBefore, [1], "cut at the end");
});

test("a novel-length comparison stays fast, and a full rewrite does not hang", () => {
  const para = (i) => `Párrafo número ${i}: la historia sigue con palabras que cambian poco a poco, ${i % 7} veces.`;
  const a = Array.from({ length: 4000 }, (_, i) => para(i)).join("\n\n");
  const b = a.replace(para(100), para(100) + " Añadido.").replace(para(2000) + "\n\n", "").replace(para(3500), "Nuevo párrafo.\n\n" + para(3500));
  let t = Date.now();
  const c = D.compareTexts(a, b);
  assert.ok(Date.now() - t < 1500, `took ${Date.now() - t} ms`);
  assert.equal(c.stats.paras.changed, 1); assert.equal(c.stats.paras.removed, 1); assert.equal(c.stats.paras.added, 1);
  const z = Array.from({ length: 3000 }, (_, i) => `Otra cosa ${i * 13} distinta.`).join("\n");
  t = Date.now();
  D.compareTexts(a, z);
  assert.ok(Date.now() - t < 5000, `full rewrite took ${Date.now() - t} ms`);
});

test("draft store: add, rename, prune, goal", async () => {
  const files = {};
  const adapter = {
    exists: async (p) => p in files || Object.keys(files).some((k) => k.startsWith(p + "/")),
    read: async (p) => files[p], write: async (p, t) => { files[p] = t; }, mkdir: async (p) => { files[p + "/.keep"] = ""; }, remove: async (p) => { delete files[p]; },
  };
  const S = new T.revStore.DraftStore(adapter, () => ".authors-toolbox/drafts");
  const day = 86400000, now = Date.now();
  await S.add("Stories/Faro.md", "uno", 1, { name: "Start of Monday", auto: true, now: now - 40 * day });
  await S.add("Stories/Faro.md", "dos", 1, { name: "Draft 1", now: now - 39 * day });
  await S.add("Stories/Faro.md", "tres", 1, { name: "Start of today", auto: true, now: now - 1000 });
  const file = Object.keys(files).find((k) => k.endsWith(".json"));
  assert.match(file, /^\.authors-toolbox\/drafts\/faro-[0-9a-f]{8}\.json$/);
  assert.equal(JSON.parse(files[file]).drafts.length, 3);
  assert.equal(await S.pruneAuto("Stories/Faro.md", 30, now), 1, "the old automatic draft goes");
  assert.deepEqual((await S.list("Stories/Faro.md")).map((d) => d.name), ["Draft 1", "Start of today"]);
  const d1 = (await S.list("Stories/Faro.md"))[0];
  await S.setGoal("Stories/Faro.md", { kind: "cut", value: 10, from: d1.id });
  await S.rename("Stories/Faro.md", "Stories/El faro.md");
  assert.ok(!(file in files), "old file removed");
  const S2 = new T.revStore.DraftStore(adapter, () => ".authors-toolbox/drafts");
  const df = await S2.load("Stories/El faro.md");
  assert.equal(df.drafts.length, 2); assert.equal(df.goal.from, d1.id);
  await S2.remove("Stories/El faro.md", d1.id);
  assert.equal((await S2.load("Stories/El faro.md")).goal, undefined, "the goal goes with its draft");
});

test("Word file with tracked changes", () => {
  const ms = T.trackedManuscript(STORY, REVISED, { fallbackTitle: "x", authorNames: [] });
  const o = { layout: "manuscript", font: "times", spacing: 2, page: "letter", author: "Ana Pérez", contact: "", pseudonym: "", chapterBreaks: false, keepJustify: false, sceneBreak: "#", coverPage: false, lang: "es", track: { author: "Ana Pérez", date: "2026-10-14T10:00:00Z" } };
  const doc = Buffer.from(T.buildDocx(ms, o)).toString("utf8");
  assert.match(doc, /<w:ins w:id="\d+" w:author="Ana Pérez" w:date="2026-10-14T10:00:00Z"><w:r><w:t xml:space="preserve">gemían/);
  assert.match(doc, /<w:del w:id="\d+"[^>]*><w:r><w:delText xml:space="preserve">crujían/);
  assert.match(doc, /<w:delText xml:space="preserve">Esa noche no pudo dormir/, "the cut paragraph is a deletion");
  assert.match(doc, /<w:pPr>.*?<w:rPr><w:del w:id/, "its paragraph mark too");
  assert.match(doc, /<w:trackRevisions\/>/);
  const ids = [...doc.matchAll(/<w:(?:ins|del) w:id="(\d+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "revision ids are unique");
  // without tracking, the same writer marks nothing
  const plain = Buffer.from(T.buildDocx(T.manuscript.buildManuscript(REVISED, { fallbackTitle: "x", authorNames: [] }), { ...o, track: undefined })).toString("utf8");
  assert.doesNotMatch(plain, /<w:ins |<w:del |trackRevisions/);
});

test("revision mode in the plugin", async (t) => {
  const { app, plugin } = await loadPlugin();
  plugin.prefs.writingFolders = "Stories";
  const path = "Stories/El cuaderno del faro.md";
  app.files[path] = STORY;
  app.vault.getAbstractFileByPath = (p) => (p in app.files ? M.file(p) : null);
  const view = await openNote(app, plugin, path, STORY);
  await tick(50);
  const drafts = () => plugin.revision.store.list(path);

  await t.test("a daily draft is kept the first time the note is opened", async () => {
    const d = await drafts();
    assert.equal(d.length, 1); assert.equal(d[0].auto, true); assert.match(d[0].name, /^Start of /);
    plugin.computeState(view); await tick();
    assert.equal((await drafts()).length, 1, "only once a day");
  });

  await t.test("saving a named draft", async () => {
    await plugin.revision.saveDraft(M.file(path));
    const modal = M.Modal.last;
    assert.equal(modal.contentEl.querySelector("input").value, "Draft 1");
    modal.contentEl.querySelector("input").value = "Antes de corregir";
    modal.contentEl.querySelector("textarea").value = "Versión enviada al taller";
    modal.contentEl.querySelector("button.mod-cta").click();
    await tick(50);
    const d = await drafts();
    assert.equal(d.length, 2); assert.equal(d[1].name, "Antes de corregir"); assert.equal(d[1].note, "Versión enviada al taller");
  });

  await t.test("the Revise tab shows the changes since the draft", async () => {
    view.cmView.dispatch({ changes: { from: 0, to: view.editor.getValue().length, insert: REVISED } });
    plugin.computeState(view);
    const panel = plugin.panels()[0];
    plugin.prefs.panelTab = "revise"; panel.render();
    await tick(30); panel.render();
    const txt = panel.contentEl.textContent;
    assert.match(txt, /Since “Antes de corregir”/);
    assert.match(txt, /Paragraphs: 2 rewritten · 1 new · 1 cut · 1 moved/);
  });

  await t.test("marks in the editor", async () => {
    await plugin.revision.toggleMarks(path);
    await tick(30);
    const dom = view.cmView.dom;
    assert.ok(dom.classList.contains("at-rev-on"));
    assert.ok(dom.querySelectorAll(".cm-line.at-rev-chg").length >= 1);
    assert.ok(dom.querySelectorAll(".cm-line.at-rev-add").length >= 1);
    assert.equal(plugin.revision.marksBase(path), "Antes de corregir");
    await plugin.revision.toggleMarks(path);
    assert.ok(!view.cmView.dom.classList.contains("at-rev-on"));
  });

  let rv;
  await t.test("the revision view", async () => {
    rv = new T.RevisionView({ app }, plugin);
    await rv.onOpen();
    await rv.setState({ path }, {});
    const txt = rv.contentEl.textContent;
    assert.match(txt, /Revision · El cuaderno del faro/);
    assert.match(txt, /words added/); assert.match(txt, /Chapters and sections/); assert.match(txt, /Style/);
    assert.ok(rv.contentEl.querySelectorAll(".at-rev-p.is-changed .at-ins").length >= 1);
    assert.equal(rv.contentEl.querySelectorAll(".at-rev-p.is-removed").length, 1);
    assert.equal(rv.contentEl.querySelectorAll(".at-rev-p.is-moved").length, 1);
    assert.match(txt, /unchanged paragraphs/, "changes only by default");
    assert.equal(rv.contentEl.querySelectorAll(".at-rev-draft").length, 2);
  });

  await t.test("restoring a cut paragraph and undoing a rewrite", async () => {
    rv.contentEl.querySelector(".at-rev-p.is-removed .at-rev-restore").click();
    await tick(120);
    assert.ok(view.editor.getValue().includes("Esa noche no pudo dormir."), "cut paragraph back");
    assert.ok(view.editor.getValue().indexOf("Esa noche no pudo dormir.") < view.editor.getValue().indexOf("## %%center%%Marzo"), "in its place");
    const changed = [...rv.contentEl.querySelectorAll(".at-rev-p.is-changed")].find((p) => p.textContent.includes("gemían"));
    changed.querySelector(".at-rev-restore").click();
    await tick(120);
    assert.ok(view.editor.getValue().includes("Los peldaños crujían bajo sus botas"));
    assert.equal(rv.contentEl.querySelectorAll(".at-rev-p.is-removed").length, 0);
  });

  await t.test("restoring a whole draft keeps the note's properties and saves the current text first", async () => {
    view.cmView.dispatch({ changes: { from: 0, to: view.editor.getValue().length, insert: REVISED.replace("status: draft", "status: revising") } });
    const first = (await drafts())[0];
    plugin.revision.restoreDraft(path, first);
    M.Modal.last.contentEl.querySelector("button.mod-cta").click();
    await tick(80);
    const now = view.editor.getValue();
    assert.match(now, /status: revising/);
    assert.ok(now.includes("Los peldaños crujían"));
    assert.ok((await drafts()).some((d) => /^Before restoring/.test(d.name)));
  });

  await t.test("a revision goal", async () => {
    const d = await drafts();
    await plugin.revision.store.setGoal(path, { kind: "cut", value: 10, from: d[0].id });
    await rv.reload();
    assert.match(rv.contentEl.textContent, /Cut 10%: \d+ → \d+ words/);
  });

  await t.test("exporting the changes as a Word file", async () => {
    view.cmView.dispatch({ changes: { from: 0, to: view.editor.getValue().length, insert: REVISED } });
    await plugin.revision.exportTracked(path, (await drafts())[0].id);
    const out = Object.keys(app.files).find((k) => k.endsWith(".docx"));
    assert.match(out, /^Stories\/Exports\/El cuaderno del faro \(cambios desde .+\)\.docx$/);
    assert.match(Buffer.from(app.files[out]).toString("utf8"), /<w:ins /);
  });

  await t.test("renaming the note keeps its drafts", async () => {
    const n = (await drafts()).length;
    await plugin.revision.rename(path, "Stories/El faro.md");
    assert.equal((await plugin.revision.store.list("Stories/El faro.md")).length, n);
  });
});
