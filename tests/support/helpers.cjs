// Shared helpers for the test files.
const fs = require("node:fs");
const path = require("node:path");
const M = require("./obsidian-mock.cjs");
const T = require("../.build/toolbox.cjs");

const fixture = (name) => fs.readFileSync(path.join(__dirname, "..", "fixtures", name), "utf8");
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

/** A loaded plugin in a fresh mock app. */
async function loadPlugin() {
  const app = M.makeApp();
  const plugin = new T.AuthorsToolbox(app);
  await plugin.onload();
  return { app, plugin };
}

/** Opens `text` as the active note (path in the vault) and points the writing panel at it. */
async function openNote(app, plugin, filePath, text) {
  const view = new M.MarkdownView(app, M.file(filePath), text);
  app.activeView = view;
  if (app.ready) { const r = app.ready; app.ready = null; r(); await tick(); }
  plugin.setTarget(view, true);
  return view;
}

module.exports = { M, T, fixture, tick, loadPlugin, openNote };
