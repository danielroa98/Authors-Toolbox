// Writing habits: the daily log, streaks, sprints and the dashboard with genres, forms and projects.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { M, T, loadPlugin } = require("./support/helpers.cjs");

after(M.teardown);
const L = T.habitsLog;
const key = (d) => L.dayKey(d);
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return key(d); };

test("log helpers", () => {
  assert.equal(L.addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(L.addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(L.weekStart("2026-10-14"), "2026-10-12", "weeks start on Monday");
  const log = { "2026-10-13": { "a.md": { s: 100, l: 50 } }, "2026-10-14": { "a.md": { s: 10, l: 60 }, "b.md": { s: 0, l: 5 } } };
  assert.equal(L.writtenOn(log, "2026-10-13"), 0, "deleting text never counts as negative words");
  assert.equal(L.writtenOn(log, "2026-10-14"), 55);
  assert.equal(L.renamePath(log, "a.md", "c.md"), true);
  assert.ok(log["2026-10-14"]["c.md"] && !log["2026-10-14"]["a.md"]);
  const g = L.wordsByGroup(log, "2026-10-01", "2026-10-14", (p) => (p === "c.md" ? ["terror", "misterio"] : []));
  assert.equal(g.get("terror"), 50);
  assert.equal(g.get("misterio"), 50);
});

test("genres", () => {
  const G = T.genres;
  assert.deepEqual(G.genresOf({ genre: ["terror", "Ciencia ficción"] }), ["Terror", "Ciencia ficción"]);
  assert.deepEqual(G.genresOf({ genre: "romance, drama" }), ["Romance", "Drama"]);
  assert.deepEqual(G.genresOf({}), []);
  assert.equal(G.formOf({ type: "poema" }), "Poem");
  assert.deepEqual(G.projectsOf({ anthology: ["[[La Ciudad Perdida]]"] }), ["La Ciudad Perdida"]);
});

test("daily goal, streaks, sprints and the dashboard", async () => {
  const { app, plugin } = await loadPlugin();
  plugin.prefs.dailyGoal = 300;
  // 40 days of 400 words a day, a gap 10 days ago, nothing yet today, and one entry past the history window
  const daily = {};
  for (let n = 40; n >= 1; n--) if (n !== 10) daily[ago(n)] = { "S/Terror story.md": { s: 1000, l: 1250 }, "S/Love poem.md": { s: 100, l: 250 } };
  daily["2020-01-01"] = { "old.md": { s: 0, l: 999 } };
  plugin.prefs.daily = daily;

  plugin.trackDaily("S/Terror story.md", 1300);
  assert.equal(plugin.prefs.daily["2020-01-01"], undefined, "history older than ~13 months is pruned");
  assert.ok(Object.keys(plugin.prefs.daily).length >= 40);
  let hs = plugin.habitSummary();
  assert.equal(hs.streak, 9); assert.equal(hs.todayDone, false);
  plugin.trackDaily("S/Terror story.md", 1650);
  hs = plugin.habitSummary();
  assert.equal(hs.today, 350); assert.equal(hs.streak, 10, "reaching today's goal extends the streak");

  plugin.startSprint(15, 100);
  assert.equal(plugin.sprint.startWords, 350);
  plugin.trackDaily("S/Love poem.md", 400);
  plugin.trackDaily("S/Love poem.md", 520);
  plugin.sprintTick();
  assert.match(plugin.status.textContent, /Sprint \d+:\d\d · 120\/100 words/);
  plugin.finishSprint(true);
  assert.equal(plugin.prefs.sprints.length, 1); assert.equal(plugin.prefs.sprints[0].words, 120); assert.equal(plugin.sprint, null);

  const fm = { "S/Terror story.md": { type: "story", genre: ["terror"], anthology: ["[[La Ciudad Perdida]]"] }, "S/Love poem.md": { type: "poem", genre: "Romance" }, "S/Untagged.md": { type: "story" } };
  const files = Object.keys(fm).map((p) => Object.assign(M.file(p), { stat: { mtime: 1 } }));
  plugin.writingFiles = () => files;
  app.metadataCache.getFileCache = (f) => ({ frontmatter: fm[f.path] || {} });
  app.vault.cachedRead = async (f) => "---\ntype: x\n---\n" + "palabra ".repeat(f.path.includes("Terror") ? 1650 : f.path.includes("Love") ? 520 : 80);
  app.vault.getAbstractFileByPath = (p) => files.find((f) => f.path === p) || null;
  const view = new T.HabitsView({ app }, plugin);
  await view.onOpen();
  const txt = view.contentEl.textContent;
  assert.match(txt, /You write most in Terror: \d+%/);
  assert.match(txt, /Romance/); assert.match(txt, /No genre/); assert.match(txt, /1 work has no genre yet/);
  assert.match(txt, /Story/); assert.match(txt, /Poem/);
  assert.match(txt, /La Ciudad Perdida/);
  assert.match(txt, /10 days/);
  assert.equal(view.contentEl.querySelectorAll(".at-h-bar").length, 30);
  assert.match(txt, /1 sprint/);
});
