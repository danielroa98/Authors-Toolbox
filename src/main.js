/* Authors Toolbox — tools for fiction writers and screenwriters in Obsidian (desktop, iPhone and iPad).
 * See README.md for the feature list. Plain JavaScript (ES modules) bundled with esbuild; no Node/Electron APIs.
 */
import { Plugin, Notice, MarkdownView, Menu, Platform, requestUrl, debounce, TFile, TFolder, normalizePath } from "obsidian";
import { ViewPlugin, EditorView } from "@codemirror/view";
import { DEFAULTS, MARK, MODES, VIEW_WRITING } from "./constants.js";
import { alignView, applyAlign } from "./editor/alignment.js";
import { issueAt, issueField, issueRange, removeIssue, setFind, setIssues } from "./editor/issues.js";
import { convertDialogueDashes, rayaExtension } from "./editor/raya.js";
import { InsertImageModal } from "./modals/insert-image.js";
import { NumberPrompt, TextPrompt } from "./modals/prompts.js";
import { SCRIPTS_FOLDER_DEFAULT, ScriptSuggest, scriptTemplate, spAttrs, spKeymap, spPostProcess, spView } from "./screenplay/editor.js";
import { SP_SCENE, SP_TRANS_WORDS, analyzeScript, buildScriptOutline, classifyScript, isScriptFM, isScriptText, isUpperLine, reorderScenes, toFountain } from "./screenplay/fountain.js";
import { ToolboxSettings } from "./settings.js";
import { DEFAULT_CRUTCH, analyze, baseLang, buildOutline, detectLang, ltChunks, mapMatches, plainToDoc, proseMap, reorder, splitSentences, words } from "./text/analysis.js";
import { LANGS, normLang, todayKey } from "./view/helpers.js";
import { WritingView } from "./view/writing-view.js";

/* ======================================================================
   PLUGIN
   ====================================================================== */

export function selectionWatcherFor(plugin) {
  return ViewPlugin.fromClass(class {
    update(u) { if (u.selectionSet && !u.docChanged) plugin.onSelection(u.view); }
  });
}
export function clickHandlerFor(plugin) {
  return EditorView.domEventHandlers({ click: (e, view) => plugin.onEditorClick(e, view) });
}

export default class AuthorsToolbox extends Plugin {
  async onload() {
    this.prefs = Object.assign({}, DEFAULTS, await this.loadData());
    this.state = null; this.target = null; this.check = null; this.checking = false; this.checkStatus = "";
    this.sent = []; this.issueSeq = 0;
    this.saveSettingsSoon = debounce(() => this.saveSettings(), 4000, true);

    const selectionWatcher = selectionWatcherFor(this);
    const clicks = clickHandlerFor(this);
    this.registerEditorExtension([alignView, issueField, selectionWatcher, clicks, spView, spAttrs]);
    if (this.prefs.smartEnter) this.registerEditorExtension(spKeymap);
    this.registerEditorExtension(rayaExtension(this));
    this.registerMarkdownPostProcessor((el, ctx) => spPostProcess(el, ctx));
    this.registerEditorSuggest(new ScriptSuggest(this.app, this));

    // Reading view: tag each rendered paragraph whose source starts with an alignment marker
    this.registerMarkdownPostProcessor((el, ctx) => {
      const info = ctx.getSectionInfo(el);
      if (!info) return;
      const line = info.text.split("\n")[info.lineStart];
      const m = line && MARK.exec(line);
      if (m) el.addClasses(["at-sec", `at-sec-${m[2]}`]);
    });

    this.registerView(VIEW_WRITING, (leaf) => new WritingView(leaf, this));
    this.addRibbonIcon("pen-line", "Writing panel", () => this.activatePanel());

    for (const [mode, info] of Object.entries(MODES)) {
      this.addCommand({ id: `align-${mode}`, name: `${info.label} selected text`, icon: info.icon, editorCallback: (editor) => applyAlign(editor, mode) });
    }
    this.addCommand({ id: "align-clear", name: "Clear alignment of selected text", editorCallback: (editor) => applyAlign(editor, "none") });
    this.addCommand({ id: "insert-image", name: "Insert image…", icon: "image-plus", editorCallback: (editor, view) => new InsertImageModal(this.app, this, editor, view).open() });
    this.addCommand({ id: "open-writing-panel", name: "Open writing panel", icon: "pen-line", callback: () => this.activatePanel() });
    this.addCommand({ id: "check-selection", name: "Check spelling & grammar: selection", icon: "spell-check", editorCallback: () => this.runCheck("selection") });
    this.addCommand({ id: "check-section", name: "Check spelling & grammar: current section", icon: "spell-check", editorCallback: () => this.runCheck("section") });
    this.addCommand({ id: "check-note", name: "Check spelling & grammar: whole note", icon: "spell-check", editorCallback: () => this.runCheck("note") });
    this.addCommand({ id: "check-clear", name: "Clear spelling & grammar underlines", callback: () => this.clearCheck() });
    this.addCommand({ id: "script-new", name: "Screenplay: new script…", icon: "clapperboard", callback: () => this.newScript() });
    this.addCommand({ id: "script-adapt", name: "Screenplay: adapt this story into a script", icon: "clapperboard", callback: () => this.adaptStory() });
    this.addCommand({ id: "script-export", name: "Screenplay: export as .fountain", icon: "file-output", callback: () => this.exportFountain() });
    this.addCommand({ id: "script-toggle", name: "Screenplay: turn script formatting on/off for this note", icon: "film", callback: () => this.toggleScriptMode() });
    for (const [k, label, icon] of [["scene", "Scene heading", "clapperboard"], ["action", "Action", "pilcrow"], ["character", "Character", "user"], ["paren", "Parenthetical", "parentheses"], ["transition", "Transition", "arrow-right"], ["centered", "Centered", "align-center"]]) {
      this.addCommand({ id: "script-el-" + k, name: `Screenplay: format line as ${label}`, icon, editorCallback: (editor) => this.formatLine(editor, k) });
    }
    this.addCommand({ id: "script-pagebreak", name: "Screenplay: insert page break", icon: "separator-horizontal", editorCallback: (editor) => { const c = editor.getCursor(); editor.replaceRange("\n===\n\n", { line: c.line, ch: editor.getLine(c.line).length }); } });
    this.addCommand({ id: "raya-convert", name: "Convert dialogue dashes (- → —) in this note", icon: "minus", editorCallback: (editor) => {
      const r = convertDialogueDashes(editor.getValue());
      if (!r.changed) { new Notice("No lines starting with a dash found."); return; }
      const last = editor.lastLine();
      editor.replaceRange(r.text, { line: 0, ch: 0 }, { line: last, ch: editor.getLine(last).length });
      new Notice(`${r.changed} dialogue line${r.changed === 1 ? "" : "s"} now start with a raya (—).`);
    } });
    this.addCommand({ id: "lang-es", name: "Set note language: Español", callback: () => this.setNoteLang("es") });
    this.addCommand({ id: "lang-en", name: "Set note language: English", callback: () => this.setNoteLang("en-US") });
    this.addCommand({ id: "lang-auto", name: "Set note language: auto-detect", callback: () => this.setNoteLang("auto") });

    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, view) => {
      menu.addSeparator();
      for (const [mode, info] of Object.entries(MODES)) {
        menu.addItem((i) => i.setTitle(info.label).setIcon(info.icon).setSection("authors-toolbox").onClick(() => applyAlign(editor, mode)));
      }
      menu.addItem((i) => i.setTitle("Clear alignment").setIcon("eraser").setSection("authors-toolbox").onClick(() => applyAlign(editor, "none")));
      menu.addItem((i) => i.setTitle("Insert image…").setIcon("image-plus").setSection("authors-toolbox").onClick(() => new InsertImageModal(this.app, this, editor, view).open()));
      if (view && view.file && isScriptText(editor.getValue())) {
        for (const [k, label, icon] of [["scene", "Scene heading", "clapperboard"], ["character", "Character", "user"], ["paren", "Parenthetical", "parentheses"], ["transition", "Transition", "arrow-right"], ["action", "Action", "pilcrow"]]) {
          menu.addItem((i) => i.setTitle("Format as " + label).setIcon(icon).setSection("authors-toolbox-script").onClick(() => this.formatLine(editor, k)));
        }
      }
      if (editor.somethingSelected()) menu.addItem((i) => i.setTitle("Check spelling & grammar").setIcon("spell-check").setSection("authors-toolbox").onClick(() => this.runCheck("selection")));
    }));

    this.refreshSoon = debounce(() => this.refresh(), Platform.isMobile ? 1200 : 600, true);
    this.selectionSoon = debounce(() => this.updateSelection(), 350, true);
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      if (leaf && leaf.view instanceof MarkdownView) { this.setTarget(leaf.view); }
    }));
    this.registerEvent(this.app.workspace.on("file-open", () => {
      const v = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (v) this.setTarget(v, true); else this.refreshSoon();
    }));
    this.registerEvent(this.app.workspace.on("editor-change", (editor, info) => {
      if (this.target && info && info.file && this.target.file && info.file.path === this.target.file.path) this.refreshSoon();
    }));
    this.registerEvent(this.app.metadataCache.on("changed", (file) => {
      if (this.target && this.target.file && file.path === this.target.file.path) this.refreshSoon();
    }));
    this.registerEvent(this.app.vault.on("rename", () => this.refreshSoon()));

    this.addSettingTab(new ToolboxSettings(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      const v = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (v) this.setTarget(v);
      if (!this.prefs.panelAutoOpened) {
        this.prefs.panelAutoOpened = true;
        void this.saveSettings();
        void this.activatePanel(false);
      }
    });
  }

  onunload() {
    this.app.workspace.getLeavesOfType(VIEW_WRITING).forEach((l) => l.detach());
  }

  async saveSettings() { await this.saveData(this.prefs); }

  /* ---------- panel plumbing ---------- */

  async activatePanel(reveal = true) {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_WRITING)[0];
    if (!leaf) {
      leaf = ws.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW_WRITING, active: reveal });
    }
    if (reveal) await ws.revealLeaf(leaf);
    this.refresh();
  }

  panels() { return this.app.workspace.getLeavesOfType(VIEW_WRITING).map((l) => l.view).filter((v) => v instanceof WritingView); }
  renderPanels() { this.panels().forEach((p) => p.render()); }

  setTarget(view, force) {
    const changed = !this.target || this.target !== view || (this.state && view.file && this.state.file && this.state.file.path !== view.file.path);
    if (changed && this.check && (!view.file || this.check.path !== view.file.path)) { this.check = null; this.checkStatus = ""; }
    this.target = view;
    if (changed || force) this.refresh(); else this.refreshSoon();
  }

  cmOf(view) { return view && view.editor && view.editor.cm ? view.editor.cm : null; }

  noteLang(file) {
    const fm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter || {};
    const v = normLang(fm.lang);
    if (v) return { code: v, source: "note" };
    const d = normLang(this.prefs.defaultLang);
    return { code: d || "auto", source: d ? "default" : "auto" };
  }

  refresh() {
    const v = this.target;
    if (!v || !v.file) { this.state = null; this.renderPanels(); return; }
    if (!this.panels().length) {
      // panel closed: only keep today's word count up to date (cheap)
      const text = v.editor ? v.editor.getValue() : v.data || "";
      const n = proseMap(text).paras.reduce((t, p) => t + (p.kind === "heading" ? 0 : words(p.plain).length), 0);
      this.trackDaily(v.file.path, n);
      return;
    }
    this.computeState(v);
    this.renderPanels();
  }

  computeState(view) {
    const file = view.file;
    if (!file) { this.state = null; return; }
    const text = view.editor ? view.editor.getValue() : view.data || "";
    const L = this.noteLang(file);
    const s = this.prefs;
    const crutch = { en: s.crutchEn || DEFAULT_CRUTCH.en, es: s.crutchEs || DEFAULT_CRUTCH.es };
    const analysis = analyze(text, { lang: L.code, longSentence: s.longSentence, echoWindow: s.echoWindow, crutch });
    const outline = buildOutline(text);
    const fm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter || {};
    const goal = parseInt(fm.word_goal, 10) || s.defaultGoal || 0;
    let cursorLine = null;
    try { cursorLine = view.editor.getCursor().line; } catch { /* reading view */ }
    const isSp = isScriptFM(fm) || isScriptText(text);
    const script = isSp ? analyzeScript(text, analysis.lang) : null;
    const sOutline = isSp ? buildScriptOutline(text) : null;
    this.state = {
      file, text, analysis, outline, goal, cursorLine, script, sOutline, fm,
      langCode: L.code, langSource: L.source, ltLang: L.code,
      selection: this.state && this.state.file === file ? this.state.selection : null,
    };
    // hyphenation & screen readers follow the note language
    try { view.contentEl.setAttr("lang", L.code === "auto" ? analysis.lang : L.code.slice(0, 2)); } catch { /* ignore */ }
    this.trackDaily(file.path, analysis.words);
  }

  onSelection(cmView) {
    const cm = this.cmOf(this.target);
    if (cm && cm === cmView) this.selectionSoon();
  }

  updateSelection() {
    const v = this.target;
    if (!v || !v.editor || !this.state) return;
    const txt = v.editor.getSelection() || "";
    let selection = null;
    if (txt.trim()) {
      const { paras } = proseMap(txt);
      let w = 0, c = 0, sents = 0;
      for (const p of paras) { if (p.kind === "heading") continue; w += words(p.plain).length; c += p.plain.length; sents += splitSentences(p.plain).length; }
      selection = { words: w, chars: c, sentences: sents };
    }
    try { this.state.cursorLine = v.editor.getCursor().line; } catch { /* ignore */ }
    const prev = this.state.selection;
    this.state.selection = selection;
    const tab = this.prefs.panelTab;
    if (JSON.stringify(prev) !== JSON.stringify(selection) || tab === "outline") this.renderPanels();
  }

  /* ---------- daily progress ---------- */

  trackDaily(path, words) {
    const d = this.prefs.daily || (this.prefs.daily = {});
    const key = todayKey();
    for (const k of Object.keys(d)) if (k < key && Object.keys(d).length > 14) delete d[k];
    const day = d[key] || (d[key] = {});
    const e = day[path];
    if (!e) { day[path] = { s: words, l: words }; this.saveSettingsSoon(); }
    else if (e.l !== words) { e.l = words; this.saveSettingsSoon(); }
  }
  todayWords(path) {
    const day = (this.prefs.daily || {})[todayKey()] || {};
    let total = 0;
    for (const e of Object.values(day)) total += e.l - e.s;
    const e = day[path];
    return { total, note: e ? e.l - e.s : 0 };
  }

  /* ---------- note properties ---------- */

  async setNoteLang(code) {
    const f = this.target && this.target.file;
    if (!f) { new Notice("Open a note first."); return; }
    await this.app.fileManager.processFrontMatter(f, (fm) => {
      if (code === "auto") delete fm.lang; else fm.lang = code;
    });
    if (this.check && this.check.path === f.path) this.clearCheck();
    new Notice(code === "auto" ? "Language: auto-detect" : `Language for this note: ${LANGS[code]}`);
    window.setTimeout(() => this.refresh(), 250);
  }

  editGoal() {
    const f = this.target && this.target.file;
    if (!f) return;
    new NumberPrompt(this.app, "Word goal for this note", this.state ? this.state.goal : 0, async (n) => {
      await this.app.fileManager.processFrontMatter(f, (fm) => { if (n > 0) fm.word_goal = n; else delete fm.word_goal; });
      window.setTimeout(() => this.refresh(), 250);
    }).open();
  }

  /* ---------- navigation & highlights ---------- */

  wordDocRange(w) { const p = this.state.analysis.paras[w.para]; return this.plainDocRange(p, w.a, w.b); }
  plainDocRange(p, a, b) { return { from: plainToDoc(p, a), to: plainToDoc(p, b) }; }

  highlightSentences(sents) {
    const a = this.state.analysis;
    this.showRanges(sents.map((s) => this.plainDocRange(a.paras[s.para], s.a, s.b)), 0);
  }

  ensureEditable() {
    const v = this.target;
    if (!v) return null;
    if (v.getMode && v.getMode() === "preview") return null;
    return this.cmOf(v);
  }

  closeDrawerOnPhone() {
    if (Platform.isPhone) { try { this.app.workspace.rightSplit.collapse(); } catch { /* ignore */ } }
  }

  showRanges(ranges, current, select) {
    const v = this.target;
    if (!v || !ranges.length) return;
    const r = ranges[current] || ranges[0];
    const cm = this.ensureEditable();
    if (!cm) {
      const line = v.editor.offsetToPos(r.from).line;
      v.setEphemeralState({ line });
      this.closeDrawerOnPhone();
      return;
    }
    const list = ranges.slice(); list.current = current;
    const effects = [setFind.of(list), EditorView.scrollIntoView(r.from, { y: "center" })];
    const tr = { effects };
    if (select) tr.selection = { anchor: r.from, head: r.to };
    cm.dispatch(tr);
    if (ranges.length > 1) new Notice(`${current + 1} of ${ranges.length}`, 1200);
    this.closeDrawerOnPhone();
  }

  jumpToLine(line) {
    const v = this.target;
    if (!v) return;
    const cm = this.ensureEditable();
    if (!cm) { v.setEphemeralState({ line }); this.closeDrawerOnPhone(); return; }
    const pos = v.editor.posToOffset({ line, ch: 0 });
    cm.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 40 }) });
    if (!Platform.isMobile) cm.focus();
    this.closeDrawerOnPhone();
  }

  selectLines(a, b) {
    const v = this.target;
    if (!v) return;
    const ed = v.editor;
    while (b - 1 > a && !ed.getLine(b - 1).trim()) b--;
    ed.setSelection({ line: a, ch: 0 }, { line: b - 1, ch: ed.getLine(b - 1).length });
    ed.scrollIntoView({ from: { line: a, ch: 0 }, to: { line: a, ch: 0 } }, true);
    ed.focus();
    this.closeDrawerOnPhone();
  }

  moveSection(parentId, kind, from, to) {
    const v = this.target;
    if (!v || !v.editor) return;
    const ed = v.editor;
    const r = kind === "c" ? reorderScenes(buildScriptOutline(ed.getValue()), parentId, from, to)
      : reorder(buildOutline(ed.getValue()), parentId, kind, from, to);
    if (!r) { new Notice("Couldn't move that section — the text changed. Try again."); this.refresh(); return; }
    ed.replaceRange(r.text, { line: r.fromLine, ch: 0 }, { line: r.toLine, ch: ed.getLine(r.toLine).length });
    this.refresh();
  }

  /* ---------- spelling & grammar (LanguageTool) ---------- */

  scopeRange(scope, ed, text) {
    if (scope === "selection" && ed.somethingSelected()) {
      const s = ed.listSelections()[0];
      let a = ed.posToOffset(s.anchor), b = ed.posToOffset(s.head);
      if (a > b) [a, b] = [b, a];
      return { from: a, to: b, label: "the selection" };
    }
    if (scope === "note") return { from: 0, to: text.length, label: "the whole note" };
    // current section: the innermost heading section or scene containing the cursor
    const o = buildOutline(text);
    const line = ed.getCursor().line;
    let best = { start: o.root.start, end: o.lines.length };
    for (const n of o.all) {
      if (n.id && line >= n.start && line < n.end && (n.end - n.start) <= (best.end - best.start)) best = n;
      for (const sc of n.scenes) if (line >= sc.start && line < sc.end && (sc.end - sc.start) <= (best.end - best.start)) best = sc;
    }
    const a = ed.posToOffset({ line: best.start, ch: 0 });
    const lastLine = Math.max(best.start, best.end - 1);
    const b = ed.posToOffset({ line: lastLine, ch: ed.getLine(lastLine).length });
    return { from: a, to: b, label: "this section" };
  }

  async waitForRateLimit(bytes) {
    const s = this.prefs;
    const official = /api\.languagetool\.org/.test(s.ltServer || "");
    if (!official || (s.ltKey && s.ltUser)) return;
    for (;;) {
      const now = Date.now();
      this.sent = this.sent.filter((x) => now - x.t < 60000);
      const used = this.sent.reduce((t, x) => t + x.bytes, 0);
      if (this.sent.length < 18 && used + bytes <= 72000) break;
      const wait = Math.max(1000, 60000 - (now - this.sent[0].t) + 500);
      this.checkStatus = `Waiting ${Math.ceil(wait / 1000)} s for LanguageTool's free-tier limit…`;
      this.renderPanels();
      await new Promise((r) => window.setTimeout(r, Math.min(wait, 5000)));
    }
    this.sent.push({ t: Date.now(), bytes });
  }

  async runCheck(scope) {
    const view = this.target || this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.editor || !view.file) { new Notice("Open a note in editing view first."); return; }
    this.target = view;
    if (!this.prefs.ltConsent) {
      this.prefs.panelTab = "check"; await this.activatePanel();
      new Notice("Allow the spelling & grammar service in the Writing panel first.");
      return;
    }
    if (this.checking) return;
    const s = this.prefs, ed = view.editor, cm = this.cmOf(view);
    const text = ed.getValue();
    const L = this.noteLang(view.file);
    const lang = L.code;
    const rng = this.scopeRange(scope, ed, text);
    const { pieces } = proseMap(text);
    const premium = !!(s.ltKey && s.ltUser);
    const chunks = ltChunks(pieces, rng.from, rng.to, premium ? 60000 : 18000);
    if (!chunks.length) { new Notice("Nothing to check there."); return; }
    this.checking = true;
    this.check = { path: view.file.path, issues: new Map(), scopeLabel: rng.label, lang };
    this.renderPanels();
    const server = (s.ltServer || "https://api.languagetool.org").replace(/\/+$/, "").replace(/\/v2(\/check)?$/, "");
    const dict = new Set(String(s.ltDictionary || "").split(/[\n,]/).map((x) => x.trim().toLowerCase()).filter(Boolean));
    const disabled = String(s.ltDisabledRules || "").split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
    const found = [];
    let failed = null;
    const spTypes = isScriptText(text) ? classifyScript(text).types : null;
    try {
      for (let k = 0; k < chunks.length; k++) {
        const ch = chunks[k];
        await this.waitForRateLimit(ch.bytes);
        this.checkStatus = chunks.length > 1 ? `Checking part ${k + 1} of ${chunks.length}…` : "Checking…";
        this.renderPanels();
        const params = new URLSearchParams();
        params.set("data", JSON.stringify({ annotation: ch.annotation }));
        params.set("language", lang === "auto" ? "auto" : lang);
        if (lang === "auto") params.set("preferredVariants", "en-US");
        if (s.ltPicky) params.set("level", "picky");
        if (disabled.length) params.set("disabledRules", disabled.join(","));
        if (premium) { params.set("username", s.ltUser); params.set("apiKey", s.ltKey); }
        const res = await requestUrl({ url: server + "/v2/check", method: "POST", contentType: "application/x-www-form-urlencoded", body: params.toString(), throw: false });
        if (res.status !== 200) {
          failed = res.status === 429 ? "LanguageTool's free limit was reached. Wait a minute and try again." :
            res.status === 413 ? "That text is too long for one request." : `LanguageTool answered with an error (${res.status}). ${String(res.text || "").slice(0, 120)}`;
          break;
        }
        if (ed.getValue() !== text) { failed = "The text changed while it was being checked — run the check again."; break; }
        for (const m of mapMatches(res.json, ch, text)) {
          if (m.kind === "spelling" && dict.has(m.text.toLowerCase())) continue;
          if (spTypes) {
            const ln = text.slice(0, m.from).split("\n").length - 1;
            const tt = spTypes[ln] && spTypes[ln].t;
            if (tt === "scene" || tt === "character" || tt === "transition" || tt === "pagebreak" || tt === "section") continue;
          }
          found.push(m);
        }
      }
    } catch (e) {
      console.error(e);
      failed = "Couldn't reach LanguageTool. Check your internet connection. (" + (e && e.message ? e.message : e) + ")";
    }
    this.checking = false;
    for (const m of found) { m.id = "i" + ++this.issueSeq; this.check.issues.set(m.id, m); }
    if (cm) cm.dispatch({ effects: setIssues.of(found.map((m) => ({ from: m.from, to: m.to, kind: m.kind, id: m.id }))) });
    this.checkStatus = failed || (found.length ? `${found.length} suggestion${found.length === 1 ? "" : "s"} in ${rng.label}.` : "");
    if (failed) new Notice(failed);
    this.prefs.panelTab = "check";
    if (!this.panels().length) await this.activatePanel();
    this.renderPanels();
  }

  clearCheck() {
    const cm = this.cmOf(this.target);
    if (cm) cm.dispatch({ effects: setIssues.of([]) });
    this.check = null; this.checkStatus = "";
    this.renderPanels();
  }

  dropIssue(id) {
    const cm = this.cmOf(this.target);
    if (cm) cm.dispatch({ effects: removeIssue.of(id) });
    if (this.check) this.check.issues.delete(id);
    this.renderPanels();
  }

  applyFix(id, value) {
    const cm = this.cmOf(this.target);
    const it = this.check && this.check.issues.get(id);
    if (!cm || !it) return;
    const r = issueRange(cm, id);
    if (!r || cm.state.sliceDoc(r.from, r.to) !== it.text) { new Notice("That text has changed — run the check again."); this.dropIssue(id); return; }
    cm.dispatch({ changes: { from: r.from, to: r.to, insert: value }, effects: removeIssue.of(id) });
    this.check.issues.delete(id);
    this.refreshSoon();
    this.renderPanels();
  }

  ignoreIssue(id) { this.dropIssue(id); }

  async addToDictionary(id) {
    const it = this.check && this.check.issues.get(id);
    if (!it) return;
    const w = it.text.trim();
    const list = String(this.prefs.ltDictionary || "").split(/\n/).map((x) => x.trim()).filter(Boolean);
    if (!list.some((x) => x.toLowerCase() === w.toLowerCase())) list.push(w);
    this.prefs.ltDictionary = list.join("\n");
    await this.saveSettings();
    // drop every other occurrence of the same word too
    for (const [k, v] of [...this.check.issues]) if (v.kind === "spelling" && v.text.toLowerCase() === w.toLowerCase()) this.dropIssue(k);
    new Notice(`“${w}” added to your dictionary.`);
  }

  onEditorClick(e, view) {
    if (!this.check || !this.check.issues.size) return false;
    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos == null) return false;
    const hit = issueAt(view, pos);
    if (!hit) return false;
    const it = this.check.issues.get(hit.id);
    if (!it) return false;
    if (this.target && this.cmOf(this.target) !== view) {
      const leaf = this.app.workspace.getLeavesOfType("markdown").find((l) => this.cmOf(l.view) === view);
      if (leaf) this.target = leaf.view;
    }
    const m = new Menu();
    m.addItem((i) => i.setTitle(it.message.length > 90 ? it.message.slice(0, 88) + "…" : it.message).setIcon("info").setDisabled(true));
    for (const rep of it.replacements.slice(0, 5)) m.addItem((i) => i.setTitle(rep === "" ? "(delete)" : rep).setIcon("check").onClick(() => this.applyFix(it.id, rep)));
    m.addSeparator();
    m.addItem((i) => i.setTitle("Ignore").setIcon("x").onClick(() => this.ignoreIssue(it.id)));
    if (it.kind === "spelling") m.addItem((i) => i.setTitle(`Add “${it.text}” to dictionary`).setIcon("book-plus").onClick(() => this.addToDictionary(it.id)));
    if (it.rule) m.addItem((i) => i.setTitle("Turn off this rule").setIcon("ban").onClick(async () => {
      const rules = String(this.prefs.ltDisabledRules || "").split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
      if (!rules.includes(it.rule)) rules.push(it.rule);
      this.prefs.ltDisabledRules = rules.join(", "); await this.saveSettings();
      for (const [k, v] of [...this.check.issues]) if (v.rule === it.rule) this.dropIssue(k);
      new Notice(`Rule turned off: ${it.ruleName || it.rule}`);
    }));
    window.setTimeout(() => m.showAtPosition({ x: e.clientX, y: e.clientY + 8 }), 0);
    return false;
  }

  /* ---------- screenplay ---------- */

  lineRange(n) {
    const ed = this.target && this.target.editor;
    if (!ed) return { from: 0, to: 0 };
    const from = ed.posToOffset({ line: n, ch: 0 });
    return { from, to: from + ed.getLine(n).length };
  }

  formatLine(editor, kind) {
    const c = editor.getCursor();
    const n = c.line;
    let t = editor.getLine(n);
    let core = t.trim().replace(/^[.!@>~]\s*/, "").replace(/\s*<\s*$/, "").replace(/\^\s*$/, "");
    let out = core, needBlankBefore = true, needBlankAfter = false;
    const up = (s) => s.toUpperCase();
    if (kind === "scene") {
      out = core ? (SP_SCENE.test(core) ? up(core) : up("INT. " + core)) : "INT. ";
      needBlankAfter = !!core;
    } else if (kind === "character") {
      out = up(core);
    } else if (kind === "transition") {
      out = up(core || "CUT TO:"); if (!/(TO|A):$/.test(out) && !SP_TRANS_WORDS.test(out)) out = "> " + out; needBlankAfter = true;
    } else if (kind === "centered") {
      out = "> " + (core || "THE END") + " <"; needBlankAfter = true;
    } else if (kind === "paren") {
      out = "(" + core.replace(/^\(|\)$/g, "") + ")"; needBlankBefore = false;
    } else if (kind === "action") {
      out = isUpperLine(core) || SP_SCENE.test(core) ? "!" + core : core;
    }
    const prevBlank = n === 0 || !editor.getLine(n - 1).trim();
    const nextBlank = n >= editor.lastLine() || !editor.getLine(n + 1).trim();
    const pre = needBlankBefore && !prevBlank ? "\n" : "";
    const post = needBlankAfter && !nextBlank ? "\n" : "";
    editor.replaceRange(pre + out + post, { line: n, ch: 0 }, { line: n, ch: t.length });
    const ln = n + (pre ? 1 : 0);
    editor.setCursor({ line: ln, ch: kind === "paren" ? out.length - 1 : out.length });
  }

  scriptsFolder() { return normalizePath(this.prefs.scriptsFolder || SCRIPTS_FOLDER_DEFAULT); }

  async createScript(title, opts) {
    const folder = this.scriptsFolder();
    if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) await this.app.vault.createFolder(folder);
    const safe = title.replace(/[\\/:*?"<>|#^[\]]/g, "").trim() || "Untitled script";
    let path = `${folder}/${safe}.md`, k = 2;
    while (this.app.vault.getAbstractFileByPath(path)) path = `${folder}/${safe} ${k++}.md`;
    const d = new Date(), p = (x) => String(x).padStart(2, "0");
    const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const guide = !!this.app.metadataCache.getFirstLinkpathDest("Screenplay Format Guide", "");
    return await this.app.vault.create(path, scriptTemplate({ title, date, author: this.prefs.authorName, guide, ...(opts || {}) }));
  }

  newScript() {
    new TextPrompt(this.app, "New script", "", async (title) => {
      const f = await this.createScript(title, {});
      await this.app.workspace.getLeaf(false).openFile(f);
    }, "Created in " + this.scriptsFolder()).open();
  }

  async adaptStory() {
    const v = this.target || this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!v || !v.file) { new Notice("Open the story you want to adapt first."); return; }
    const story = v.file;
    const text = v.editor ? v.editor.getValue() : await this.app.vault.read(story);
    const lang = baseLang(this.noteLang(story).code === "auto" ? detectLang(text) : this.noteLang(story).code);
    const suffix = lang === "es" ? " (guion)" : " (screenplay)";
    new TextPrompt(this.app, "Adapt into a script", story.basename + suffix, async (title) => {
      const f = await this.createScript(title, { adapted: story.basename, lang, format: "short" });
      // story on the left, script on the right
      const leaf = this.app.workspace.getLeaf("split", "vertical");
      await leaf.openFile(f);
      new Notice("Script created next to the story. Turn each scene of the story into a scene heading, action and dialogue.");
    }, "The script opens to the right of the story so you can adapt it scene by scene.").open();
  }

  async exportFountain() {
    const v = this.target || this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!v || !v.file) { new Notice("Open a script first."); return; }
    const text = v.editor ? v.editor.getValue() : await this.app.vault.read(v.file);
    if (!isScriptText(text)) { new Notice("This note isn't a script (type: script)."); return; }
    const fm = (this.app.metadataCache.getFileCache(v.file) || {}).frontmatter || {};
    const out = toFountain(text, Object.assign({ title: v.file.basename }, fm));
    const dir = v.file.parent && v.file.parent.path !== "/" ? v.file.parent.path + "/" : "";
    const path = normalizePath(`${dir}Exports/${v.file.basename}.fountain`);
    const folder = path.slice(0, path.lastIndexOf("/"));
    if (folder && !(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) await this.app.vault.createFolder(folder);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) await this.app.vault.process(existing, () => out);
    else await this.app.vault.create(path, out);
    try { await navigator.clipboard.writeText(out); } catch { /* clipboard may be unavailable */ }
    new Notice(`Exported to ${path} (also copied to the clipboard). Open it in Final Draft, Fade In, Highland, WriterSolo or Beat.`, 8000);
  }

  async toggleScriptMode() {
    const v = this.target || this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!v || !v.file) return;
    const on = !isScriptText(v.editor ? v.editor.getValue() : "");
    await this.app.fileManager.processFrontMatter(v.file, (fm) => {
      const cls = Array.isArray(fm.cssclasses) ? fm.cssclasses : fm.cssclasses ? [fm.cssclasses] : [];
      if (on) { fm.type = "script"; if (!cls.includes("screenplay")) cls.push("screenplay"); fm.cssclasses = cls; }
      else { if (String(fm.type).toLowerCase() === "script") delete fm.type; const c2 = cls.filter((x) => x !== "screenplay"); if (c2.length) fm.cssclasses = c2; else delete fm.cssclasses; }
    });
    new Notice(on ? "Script formatting on for this note." : "Script formatting off.");
    window.setTimeout(() => this.refresh(), 300);
  }

  async saveUpload(file, sourcePath) {
    const folder = normalizePath(this.prefs.imageFolder || "");
    const data = await file.arrayBuffer();
    if (!this.prefs.imageFolder) {
      // follow Obsidian's own "Default location for new attachments" setting
      const path = await this.app.fileManager.getAvailablePathForAttachment(file.name, sourcePath || "");
      return await this.app.vault.createBinary(path, data);
    }
    if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) await this.app.vault.createFolder(folder);
    const dot = file.name.lastIndexOf(".");
    const base = dot > 0 ? file.name.slice(0, dot) : file.name;
    const ext = dot > 0 ? file.name.slice(dot) : "";
    let path = normalizePath(`${folder}/${base}${ext}`), n = 1;
    while (this.app.vault.getAbstractFileByPath(path)) path = normalizePath(`${folder}/${base} ${n++}${ext}`);
    return await this.app.vault.createBinary(path, data);
  }
}
