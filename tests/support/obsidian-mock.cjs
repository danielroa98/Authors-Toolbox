// A small stand-in for the Obsidian API, enough to load the plugin in Node and drive it like a user would.
// The DOM comes from jsdom and the editor is the real CodeMirror 6, so editor extensions run for real.
// Only what the plugin uses is implemented; extend it when a test needs more.
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
for (const k of ["Window", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "navigator", "KeyboardEvent", "MouseEvent", "Event"]) {
  try { if (!(k in global)) global[k] = dom.window[k]; } catch (e) {}
}
global.window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
dom.window.document.createRange = () => ({ setStart() {}, setEnd() {}, getClientRects: () => [], getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }) });
const H = dom.window.HTMLElement.prototype;
function applyOpts(el, o) {
  if (!o) return el;
  if (typeof o === "string") { el.className = o; return el; }
  if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
  if (o.text != null) el.textContent = o.text;
  if (o.attr) for (const [k, v] of Object.entries(o.attr)) el.setAttribute(k, v);
  if (o.type) el.type = o.type;
  if (o.value != null) el.value = o.value;
  if (o.placeholder) el.placeholder = o.placeholder;
  return el;
}
H.createEl = function (tag, o, cb) { const e = applyOpts(document.createElement(tag), o); this.appendChild(e); if (cb) cb(e); return e; };
H.createDiv = function (o) { return this.createEl("div", o); };
H.createSpan = function (o) { return this.createEl("span", o); };
H.empty = function () { while (this.firstChild) this.removeChild(this.firstChild); };
H.addClass = function (...c) { this.classList.add(...c); };
H.addClasses = function (c) { this.classList.add(...c); };
H.removeClass = function (...c) { this.classList.remove(...c); };
H.toggleClass = function (c, v) { this.classList.toggle(c, v); };
H.setText = function (t) { this.textContent = t; };
H.setAttr = function (k, v) { this.setAttribute(k, v); };
H.setCssProps = function (o) { for (const [k, v] of Object.entries(o)) this.style.setProperty(k, v); };
H.appendText = function (t) { this.appendChild(document.createTextNode(t)); };
global.createEl = (tag, o) => applyOpts(document.createElement(tag), o);

const { EditorView } = require("@codemirror/view");
const { EditorState } = require("@codemirror/state");

const log = [];
const intervals = [];
/** Stops the plugin's timers and closes the DOM so the test process can exit. */
function teardown() { for (const i of intervals.splice(0)) dom.window.clearInterval(i); dom.window.close(); }
class Notice { constructor(m) { log.push("NOTICE: " + m); } setMessage(m) { log.push("NOTICE: " + m); return this; } hide() {} }
class Component {}
class Plugin {
  constructor(app) { this.app = app; this.data = {}; }
  async loadData() { return this.data; } async saveData(d) { this.data = JSON.parse(JSON.stringify(d)); }
  registerView(t, f) { this.app.workspace.factories[t] = f; }
  addStatusBarItem() { const e = document.createElement("div"); this.status = e; return e; } registerInterval(i) { intervals.push(i); return i; }
  addRibbonIcon() {} addCommand(c) { (this.cmds = this.cmds || []).push(c); }
  registerEvent() {} registerEditorExtension(x) { this.app.extensions = (this.app.extensions || []).concat(x); }
  registerMarkdownPostProcessor(f) { (this.pps = this.pps || []).push(f); } registerEditorSuggest(s) { this.suggest = s; } addSettingTab(t) { this.tab = t; }
}
class ItemView { constructor(leaf) { this.leaf = leaf; this.app = leaf.app; this.contentEl = document.createElement("div"); document.body.appendChild(this.contentEl); } }
class Modal { constructor(app) { this.app = app; this.titleEl = document.createElement("div"); this.modalEl = document.createElement("div"); this.contentEl = document.createElement("div"); } open() { Modal.last = this; this.onOpen(); } close() { this.onClose && this.onClose(); } }
class MenuItem { constructor() { this.t = ""; } setTitle(t) { this.t = t; return this; } setIcon() { return this; } setSection() { return this; } setDisabled(d) { this.d = d; return this; } onClick(f) { this.f = f; return this; } }
class Menu { constructor() { this.items = []; Menu.last = this; } addItem(cb) { const i = new MenuItem(); cb(i); this.items.push(i); return this; } addSeparator() { return this; } showAtMouseEvent() {} showAtPosition() {} }
class Setting { constructor() { const p = new Proxy(this, { get: (t, k) => (k in t ? t[k] : (...a) => { for (const x of a) if (typeof x === "function") try { x(p.ctl); } catch (e) {} return p; }) }); this.ctl = new Proxy({}, { get: (t, k) => (k === "inputEl" ? { type: "" } : () => this.ctl) }); return p; } }
class PluginSettingTab { constructor(app) { this.app = app; this.containerEl = document.createElement("div"); } }

class TAbstractFile { constructor(path, parent) { this.path = path; this.name = path.split("/").pop(); this.parent = parent || null; } }
class TFolder extends TAbstractFile { constructor(p, parent) { super(p, parent); this.children = []; } isRoot() { return this.path === ""; } }
class TFile extends TAbstractFile {
  constructor(p, parent) { super(p || "", parent); this.extension = this.name.split(".").pop(); this.basename = this.name.replace(/\.[^.]+$/, ""); this.stat = { mtime: 0, ctime: 0, size: 0 }; }
}
/** A TFile for `path` (the parent folder is a plain object with its path). */
const file = (path) => { const f = new TFile(path); f.parent = { path: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "" }; return f; };
class MarkdownView {
  constructor(app, file, text) {
    this.app = app; this.file = file; this.contentEl = document.createElement("div"); document.body.appendChild(this.contentEl);
    const parent = document.createElement("div"); document.body.appendChild(parent);
    this.cmView = new EditorView({ state: EditorState.create({ doc: text, extensions: app.extensions || [] }), parent });
    const cm = this.cmView;
    const posToOffset = (p) => cm.state.doc.line(p.line + 1).from + p.ch;
    const offsetToPos = (o) => { const l = cm.state.doc.lineAt(o); return { line: l.number - 1, ch: o - l.from }; };
    this.editor = {
      cm,
      getValue: () => cm.state.doc.toString(),
      getLine: (n) => cm.state.doc.line(n + 1).text,
      lastLine: () => cm.state.doc.lines - 1,
      getCursor: () => offsetToPos(cm.state.selection.main.head),
      listSelections: () => [{ anchor: offsetToPos(cm.state.selection.main.anchor), head: offsetToPos(cm.state.selection.main.head) }],
      getSelection: () => cm.state.sliceDoc(cm.state.selection.main.from, cm.state.selection.main.to),
      somethingSelected: () => !cm.state.selection.main.empty,
      posToOffset, offsetToPos,
      replaceRange: (t, a, b) => cm.dispatch({ changes: { from: posToOffset(a), to: posToOffset(b || a), insert: t } }),
      setSelection: (a, b) => cm.dispatch({ selection: { anchor: posToOffset(a), head: posToOffset(b || a) } }),
      setCursor: (p) => cm.dispatch({ selection: { anchor: posToOffset(p) } }), scrollIntoView() {}, focus() {},
    };
  }
  getMode() { return "source"; }
  setEphemeralState(s) { this.eph = s; }
}

function parseFM(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return {};
  const o = {};
  for (const l of m[1].split("\n")) { const k = /^([\w_]+):\s*(.*)$/.exec(l); if (k) o[k[1]] = k[2].replace(/^"|"$/g, ""); }
  return o;
}

function makeApp() {
  const app = { extensions: null };
  const leaves = [];
  app.workspace = {
    factories: {}, leaves,
    getLeavesOfType: (t) => leaves.filter((l) => l.type === t),
    getRightLeaf: () => { const l = { app, type: null, async setViewState(s) { this.type = s.type; this.view = app.workspace.factories[s.type](this); await this.view.onOpen(); } }; leaves.push(l); return l; },
    revealLeaf() {}, on() {}, onLayoutReady(cb) { app.ready = cb; },
    getActiveViewOfType: () => app.activeView || null,
    rightSplit: { collapse() { log.push("collapse"); } },
  };
  app.metadataCache = {
    on() {},
    getFirstLinkpathDest: () => null,
    getFileCache: () => ({ frontmatter: app.activeView ? parseFM(app.activeView.editor.getValue()) : {} }),
  };
  app.fileManager = {
    processFrontMatter: async (file, fn) => {
      const ed = app.activeView.editor; const t = ed.getValue();
      const fm = parseFM(t); fn(fm);
      const body = /^---\n[\s\S]*?\n---\n?/.test(t) ? t.replace(/^---\n[\s\S]*?\n---\n?/, "") : t;
      const y = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join("\n");
      const nt = "---\n" + y + "\n---\n" + body;
      app.activeView.cmView.dispatch({ changes: { from: 0, to: t.length, insert: nt } });
    },
  };
  const files = {};
  app.files = files;
  app.vault = { on() {}, getFiles: () => [], read: async (f) => files[f.path],
    getAbstractFileByPath: (p) => (p in files ? { path: p } : null), process: async (f, fn) => { files[f.path] = fn(files[f.path]); },
    adapter: { exists: async (p) => p in files || Object.keys(files).some((k) => k.startsWith(p + "/")), write: async (p, t) => { files[p] = t; } },
    createFolder: async (p) => { files[p + "/.keep"] = ""; },
    create: async (p, t) => { files[p] = t; return { path: p, basename: p.split("/").pop().replace(/\.md$/, ""), parent: { path: p.slice(0, p.lastIndexOf("/")) } }; } };
  app.workspace.getLeaf = () => ({ openFile: async (f) => { app.opened = f; } });
  return app;
}

let ltMode = "full";
async function requestUrl(req) {
  log.push("REQUEST " + req.url);
  const params = new URLSearchParams(req.body);
  const data = JSON.parse(params.get("data"));
  const full = data.annotation.map((a) => (a.text !== undefined ? a.text : a.markup)).join("");
  const plain = data.annotation.map((a) => (a.text !== undefined ? a.text : a.interpretAs || "")).join("");
  const src = ltMode === "full" ? full : plain;
  const matches = [];
  for (const [w, rep, type] of [["tenia", "tenía", "misspelling"], ["muchoo", "mucho", "misspelling"], ["un un", "un", "duplication"], ["Carlos", "Carla", "misspelling"]]) {
    let i = -1;
    while ((i = src.indexOf(w, i + 1)) >= 0) {
      const ctxA = Math.max(0, i - 20);
      matches.push({ message: `Possible error: ${w}`, shortMessage: "Spelling", offset: i, length: w.length, replacements: [{ value: rep }],
        context: { text: src.slice(ctxA, i + w.length + 20), offset: i - ctxA, length: w.length }, rule: { id: "R_" + type.toUpperCase(), issueType: type, category: { id: type === "misspelling" ? "TYPOS" : "MISC" } } });
    }
  }
  return { status: 200, json: { matches, language: { code: params.get("language") } }, text: "" };
}

module.exports = {
  obsidian: { Plugin, Modal, Setting, PluginSettingTab, Notice, editorLivePreviewField: undefined, ItemView, MarkdownView, Menu, Platform: { isMobile: false, isPhone: false },
    requestUrl, TFolder, TAbstractFile, EditorSuggest: class { constructor(app) { this.app = app; } }, TFile, normalizePath: (p) => p.replace(/\/+/g, "/").replace(/^\/|\/$/g, ""), setIcon: (el, n) => { el.setAttribute("data-icon", n); }, debounce: (f) => { const d = (...a) => f(...a); d.cancel = () => {}; return d; }, Component },
  makeApp, log, Menu, Modal, setLtMode: (m) => (ltMode = m), MarkdownView, file, teardown,
};
