import { ItemView, MarkdownView, Menu, Platform, setIcon, WorkspaceLeaf } from "obsidian";
import type { PoemAnalysis } from "../poetry/metrics";
import { renderPoem } from "../poetry/panel";
import { CheckScope, ToolboxPrefs, VIEW_WRITING } from "../constants";
import { DocRange, issueRange } from "../editor/issues";
import { scriptTabMethods, ScriptPanelState } from "../screenplay/panel";
import { Analysis, Outline, OutlineNode, Para, Scene, Sentence, WordToken, lengthCategory } from "../text/analysis";
import { IssueKind, KIND_LABEL, LANGS, fmtMin, fmtN } from "./helpers";
import type { LtIssue } from "../text/analysis";
import type { EditorView } from "@codemirror/view";

/** Panel state for any note; `script` and `sOutline` are null for prose. */
export interface PluginState extends Omit<ScriptPanelState, "script" | "sOutline"> {
  script: ScriptPanelState["script"] | null;
  /** Poem analysis for notes marked as poems. */
  poem: PoemAnalysis | null;
  sOutline: ScriptPanelState["sOutline"] | null;
  file: { basename: string; path: string };
  text: string;
  analysis: Analysis;
  outline: Outline;
  goal: number;
  langCode: string;
  langSource: "note" | "default" | "auto";
  ltLang: string;
}

export interface WritingViewPlugin {
  state: PluginState | null;
  prefs: ToolboxPrefs;
  check: {
    path: string;
    issues: Map<string, LtIssue>;
    scopeLabel: string;
  } | null;
  checking: boolean;
  checkStatus: string;
  target: MarkdownView | null;
  saveSettings(): Promise<void>;
  saveSettingsSoon(): void;
  setNoteLang(code: string): Promise<void>;
  editGoal(): void;
  todayWords(path: string): { total: number; note: number };
  highlightSentences(sents: Sentence[]): void;
  jumpToLine(line: number): void;
  moveSection(parentId: string, kind: string, from: number, to: number): void;
  selectLines(from: number, to: number): void;
  wordDocRange(w: WordToken): DocRange;
  plainDocRange(p: Para, a: number, b: number): DocRange;
  lineRange(line: number): DocRange;
  showRanges(ranges: DocRange[], current: number, select?: boolean): void;
  runCheck(scope: string): Promise<void>;
  clearCheck(): void;
  applyFix(id: string, rep: string): void;
  ignoreIssue(id: string): void;
  addToDictionary(id: string): Promise<void>;
  cmOf(view: MarkdownView | null): EditorView | null;
}

interface OutlineRow {
  node: OutlineNode | Scene;
  kind: "h" | "s";
  depth: number;
  siblings: (OutlineNode | Scene)[];
  idx: number;
  parentId: string;
}

interface ChipItem {
  key: string;
  label: string;
  count?: number;
  ranges: () => DocRange[];
}

/* ======================================================================
   WRITING PANEL (right sidebar)
   ====================================================================== */

export class WritingView extends ItemView {
  plugin: WritingViewPlugin;
  cycle: Record<string, number>;
  dragging: boolean = false;
  listEl!: HTMLElement;
  kindFilter: string | null = null;
  noteFilter: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: WritingViewPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.cycle = {};
  }

  getViewType(): string { return VIEW_WRITING; }
  getDisplayText(): string { return "Writing"; }
  override getIcon(): string { return "pen-line"; }

  override async onOpen(): Promise<void> {
    this.contentEl.addClass("at-wp");
    this.render();
  }

  override async onClose(): Promise<void> { this.contentEl.empty(); }

  render(): void {
    if (this.dragging) return;
    const el = this.contentEl;
    const scroll = el.scrollTop;
    el.empty();
    const st = this.plugin.state;
    const head = el.createDiv({ cls: "at-wp-head" });
    if (!st || !st.file) {
      head.createDiv({ cls: "at-wp-title", text: "Writing" });
      el.createDiv({ cls: "at-empty", text: "Open a note to see its statistics, outline and style insights." });
      return;
    }
    const titleRow = head.createDiv({ cls: "at-wp-titlerow" });
    titleRow.createDiv({ cls: "at-wp-title", text: st.file.basename });
    const sel = titleRow.createEl("select", { cls: "dropdown at-lang", attr: { "aria-label": "Language of this note" } });
    for (const [k, v] of Object.entries(LANGS)) {
      const label = k === "auto" ? `Auto (${st.analysis.lang === "es" ? "Español" : "English"})` : v;
      sel.createEl("option", { value: k, text: label });
    }
    sel.value = st.langSource === "note" ? st.langCode : "auto";
    sel.onchange = (): void => { void this.plugin.setNoteLang(sel.value); };

    const tabs = head.createDiv({ cls: "at-tabs" });
    const isSp = !!st.script;
    const T: [string, string, string][] = isSp
      ? [["sp-stats", "clapperboard", "Script"], ["sp-scenes", "list-video", "Scenes"], ["sp-cast", "users", "Cast"], ["sp-notes", "lightbulb", "Notes"], ["check", "spell-check", "Check"]]
      : st.poem
        ? [["poem", "feather", "Poem"], ["overview", "bar-chart-2", "Stats"], ["style", "sparkles", "Style"], ["check", "spell-check", "Check"]]
        : [["overview", "bar-chart-2", "Stats"], ["outline", "list-tree", "Outline"], ["style", "sparkles", "Style"], ["check", "spell-check", "Check"]];
    const tabKey = isSp ? "panelTabScript" : "panelTab";
    let cur = String(this.plugin.prefs[tabKey] || "");
    if (!T.some((x) => x[0] === cur)) cur = T[0][0];
    for (const [id, icon, label] of T) {
      const b = tabs.createEl("button", { cls: "at-tab" + (cur === id ? " is-active" : ""), attr: { "aria-label": label } });
      setIcon(b.createSpan({ cls: "at-tab-icon" }), icon);
      b.createSpan({ text: label, cls: "at-tab-label" });
      if (id === "check" && this.plugin.check && this.plugin.check.path === st.file.path && this.plugin.check.issues.size)
        b.createSpan({ cls: "at-badge", text: String(this.plugin.check.issues.size) });
      b.onclick = (): void => { this.plugin.prefs[tabKey] = id; this.plugin.saveSettingsSoon(); this.render(); };
    }
    const body = el.createDiv({ cls: "at-wp-body" });
    try {
      const spSt: ScriptPanelState | null = st.script && st.sOutline ? { ...st, script: st.script, sOutline: st.sOutline } : null;
      if (spSt && cur === "sp-stats") this.renderScriptStats(body, spSt);
      else if (spSt && cur === "sp-scenes") this.renderScenes(body, spSt);
      else if (spSt && cur === "sp-cast") this.renderCast(body, spSt);
      else if (spSt && cur === "sp-notes") this.renderNotes(body, spSt);
      else if (st.poem && cur === "poem") renderPoem(body, st.poem, this.plugin);
      else if (cur === "outline") this.renderOutline(body, st);
      else if (cur === "style") this.renderStyle(body, st);
      else if (cur === "check") this.renderCheck(body, st);
      else this.renderOverview(body, st);
    } catch (e: unknown) {
      console.error("Authors Toolbox:", e);
      const msg = e instanceof Error ? e.message : String(e);
      body.createDiv({ cls: "at-empty", text: "Something went wrong rendering this tab: " + msg });
    }
    el.scrollTop = scroll;
  }

  // Mixed in from scriptTabMethods (bottom of this file). `declare` emits nothing, so these
  // never become instance fields that would hide the prototype methods.
  declare renderScriptStats: (el: HTMLElement, st: ScriptPanelState) => void;
  declare renderScenes: (el: HTMLElement, st: ScriptPanelState) => void;
  declare renderCast: (el: HTMLElement, st: ScriptPanelState) => void;
  declare renderNotes: (el: HTMLElement, st: ScriptPanelState) => void;

  /* ---------- Stats ---------- */
  renderOverview(el: HTMLElement, st: PluginState): void {
    const a = st.analysis, s = this.plugin.prefs;
    const hero = el.createDiv({ cls: "at-hero" });
    hero.createDiv({ cls: "at-hero-num", text: fmtN(a.words) });
    hero.createDiv({ cls: "at-hero-sub", text: "words · " + lengthCategory(a.words) });
    const goal = st.goal;
    const g = el.createDiv({ cls: "at-goal" });
    if (goal > 0) {
      const pct = Math.min(100, (a.words / goal) * 100);
      const bar = g.createDiv({ cls: "at-bar" }); bar.createDiv({ cls: "at-bar-fill" }).setCssProps({ "--at-pct": pct + "%" });
      const row = g.createDiv({ cls: "at-goal-row" });
      row.createSpan({ text: `${fmtN(a.words)} / ${fmtN(goal)} words (${Math.round(pct)}%)` });
      const edit = row.createEl("button", { cls: "at-link", text: "Edit goal" });
      edit.onclick = (): void => this.plugin.editGoal();
    } else {
      const b = g.createEl("button", { cls: "at-link", text: "Set a word goal for this note" });
      b.onclick = (): void => this.plugin.editGoal();
    }

    if (st.selection && st.selection.words > 0) {
      const box = el.createDiv({ cls: "at-selection" });
      box.createDiv({ cls: "at-label", text: "Selection" });
      box.createDiv({ text: `${fmtN(st.selection.words)} words · ${fmtN(st.selection.chars)} characters · ${st.selection.sentences} sentence${st.selection.sentences === 1 ? "" : "s"}` });
    }

    const today = this.plugin.todayWords(st.file.path);
    if (today.total !== 0 || today.note !== 0) {
      const t = el.createDiv({ cls: "at-today" });
      const sign = (n: number): string => (n > 0 ? "+" : "") + fmtN(n);
      t.setText(`Today: ${sign(today.total)} words in all notes · ${sign(today.note)} in this one`);
    }

    const grid = el.createDiv({ cls: "at-grid" });
    const tile = (label: string, value: string, hint?: string): void => {
      const d = grid.createDiv({ cls: "at-tile" });
      d.createDiv({ cls: "at-tile-v", text: value });
      d.createDiv({ cls: "at-tile-l", text: label });
      if (hint) d.setAttr("title", hint);
    };
    tile("Characters", fmtN(a.chars));
    tile("Without spaces", fmtN(a.charsNoSp));
    tile("Paragraphs", fmtN(a.paragraphs));
    tile("Sentences", fmtN(a.sentences));
    tile("Words / sentence", a.avgSentence.toFixed(1), "Average sentence length");
    tile("Words / paragraph", a.avgPara.toFixed(0));
    tile("Reading time", fmtMin(a.words, Number(s.readingWpm) || 230));
    tile("Read aloud", fmtMin(a.words, Number(s.speakingWpm) || 150));
    tile("Dialogue", Math.round(a.dialogue * 100) + "%", "Share of words inside quotes or after a dialogue dash (—)");
    tile("Lexical variety", Math.round(a.variety * 100) + "%", "Moving-average type/token ratio (100-word window). Higher = richer vocabulary.");
    if (a.readability) {
      const r = a.readability;
      tile(r.name === "INFLESZ" ? "Readability (INFLESZ)" : "Readability (Flesch)", `${Math.round(r.score)} · ${r.label}`,
        r.grade != null ? `Flesch–Kincaid grade ${r.grade.toFixed(1)}` : "Szigriszt-Pazos / INFLESZ scale for Spanish");
      if (r.grade != null) tile("Grade level", r.grade.toFixed(1), "Flesch–Kincaid");
    }

    if (a.lens.length > 2) {
      const sec = el.createDiv({ cls: "at-section" });
      sec.createDiv({ cls: "at-label", text: "Sentence rhythm" });
      sec.createDiv({ cls: "at-hint", text: `Each bar is a sentence, in order. Variety keeps prose alive — spread here: ±${a.sentenceSD.toFixed(1)} words.` });
      const chart = sec.createDiv({ cls: "at-rhythm" });
      const max = Math.max(...a.lens), N = 90;
      const step = Math.max(1, Math.ceil(a.lens.length / N));
      for (let i = 0; i < a.lens.length; i += step) {
        const slice = a.lens.slice(i, i + step);
        const v = slice.reduce((x, y) => x + y, 0) / slice.length;
        const b = chart.createDiv({ cls: "at-rbar" + (v > a.longThreshold ? " is-long" : "") });
        b.setCssProps({ "--at-h": Math.max(4, (v / max) * 100) + "%" });
        const sIdx = i;
        b.onclick = (): void => this.plugin.highlightSentences([a.S[sIdx]]);
      }
    }
    el.createDiv({ cls: "at-foot", text: "Headings, comments, callouts, code and front matter are not counted." });
  }

  /* ---------- Outline ---------- */
  renderOutline(el: HTMLElement, st: PluginState): void {
    const o = st.outline, a = st.analysis;
    const wordsIn = (from: number, to: number): number => a.paras.reduce((t, p) => t + (p.fromLine >= from && p.fromLine < to ? (p.words ?? 0) : 0), 0);
    const rows: OutlineRow[] = [];
    const walk = (n: OutlineNode, depth: number): void => {
      if (n.id && n.parent) {
        rows.push({ node: n, kind: "h", depth, siblings: n.parent.children, idx: n.parent.children.indexOf(n), parentId: n.parent.id });
      }
      n.scenes.forEach((s, i) => rows.push({ node: s, kind: "s", depth: depth + (n.id ? 1 : 0), siblings: n.scenes, idx: i, parentId: n.id }));
      n.children.forEach((c) => walk(c, depth + (n.id ? 1 : 0)));
    };
    walk(o.root, 0);
    if (!rows.length) {
      el.createDiv({ cls: "at-empty", text: "Add headings (#, ##, ###) for chapters or scene breaks (a line with ---, * * * or #) to see your story's structure here and reorder it." });
      return;
    }
    el.createDiv({ cls: "at-hint", text: Platform.isMobile ? "Tap a section to jump to it. Drag ⠿ or use ⋯ to move it." : "Click a section to jump to it. Drag ⠿ or use ⋯ to move chapters and scenes." });
    const list = el.createDiv({ cls: "at-outline" });
    this.listEl = list;
    const cursorLine = st.cursorLine;
    const groups = new Map<string, HTMLElement[]>();
    for (const r of rows) {
      const n = r.node;
      const row = list.createDiv({ cls: "at-orow at-orow-" + r.kind });
      row.setCssProps({ "--at-indent": (6 + r.depth * 14) + "px" });
      const end = n.end;
      if (cursorLine != null && cursorLine >= n.start && cursorLine < end) row.addClass("is-here");
      const key = r.parentId + "|" + r.kind;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
      const grip = row.createDiv({ cls: "at-grip", attr: { "aria-label": "Drag to reorder" } });
      if (r.siblings.length > 1) setIcon(grip, "grip-vertical"); else grip.addClass("is-off");
      const t = row.createDiv({ cls: "at-otitle" });
      if (r.kind === "s") setIcon(t.createSpan({ cls: "at-oicon" }), "asterisk");
      t.createSpan({ text: n.title });
      row.createDiv({ cls: "at-owords", text: fmtN(wordsIn(n.start, end)) });
      const more = row.createDiv({ cls: "at-omore", attr: { "aria-label": "More" } });
      setIcon(more, "more-horizontal");
      const isScene = r.kind === "s";
      const hasBreak = isScene && "hasBreak" in n && n.hasBreak;
      t.onclick = (): void => this.plugin.jumpToLine(hasBreak ? n.start + 1 : n.start);
      more.onclick = (e: MouseEvent): void => {
        const m = new Menu();
        const mv = (to: number): void => this.plugin.moveSection(r.parentId, r.kind, r.idx, to);
        if (r.idx > 0) m.addItem((i) => i.setTitle("Move up").setIcon("arrow-up").onClick(() => mv(r.idx - 1)));
        if (r.idx < r.siblings.length - 1) m.addItem((i) => i.setTitle("Move down").setIcon("arrow-down").onClick(() => mv(r.idx + 1)));
        if (r.idx > 1) m.addItem((i) => i.setTitle("Move to top").setIcon("chevrons-up").onClick(() => mv(0)));
        if (r.idx < r.siblings.length - 2) m.addItem((i) => i.setTitle("Move to bottom").setIcon("chevrons-down").onClick(() => mv(r.siblings.length - 1)));
        m.addItem((i) => i.setTitle("Select text").setIcon("text-cursor").onClick(() => this.plugin.selectLines(hasBreak ? n.start + 1 : n.start, end)));
        m.showAtMouseEvent(e);
      };
      if (r.siblings.length > 1) grip.addEventListener("pointerdown", (e) => this.startDrag(e, row, key, groups, r));
    }
  }

  startDrag(e: PointerEvent, row: HTMLElement, key: string, groups: Map<string, HTMLElement[]>, r: { idx: number; parentId: string; kind: string }): void {
    e.preventDefault();
    const grip = e.currentTarget as HTMLElement | null;
    if (grip) {
      try { grip.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    const sibs = groups.get(key) || [];
    const listRect = this.listEl.getBoundingClientRect();
    const rects = sibs.map((x) => x.getBoundingClientRect());
    const startY = e.clientY;
    let target = r.idx;
    this.dragging = true;
    row.addClass("is-dragging");
    const ind = this.listEl.createDiv({ cls: "at-drop" });
    const move = (ev: PointerEvent): void => {
      const y = ev.clientY;
      row.setCssProps({ "--at-dy": (y - startY) + "px" });
      let t = 0;
      rects.forEach((rc, k) => { if (k !== r.idx && rc.top + rc.height / 2 < y) t++; });
      target = t;
      const others = rects.filter((_, k) => k !== r.idx);
      const top = t === 0 ? (others[0]?.top ?? 0) : (others[t - 1]?.bottom ?? 0);
      ind.setCssProps({ "--at-top": (top - listRect.top - 1) + "px" });
      ind.toggleClass("is-visible", target !== r.idx);
    };
    const up = (): void => {
      if (grip) {
        grip.removeEventListener("pointermove", move as EventListener);
        grip.removeEventListener("pointerup", up);
        grip.removeEventListener("pointercancel", up);
      }
      this.dragging = false;
      row.removeClass("is-dragging"); row.setCssProps({ "--at-dy": "0px" }); ind.remove();
      if (target !== r.idx) this.plugin.moveSection(r.parentId, r.kind, r.idx, target);
      else this.render();
    };
    if (grip) {
      grip.addEventListener("pointermove", move as EventListener);
      grip.addEventListener("pointerup", up);
      grip.addEventListener("pointercancel", up);
    }
  }

  /* ---------- Style ---------- */
  renderStyle(el: HTMLElement, st: PluginState): void {
    const a = st.analysis, P = this.plugin;
    if (a.words < 30) { el.createDiv({ cls: "at-empty", text: "Write a little more to get style insights." }); return; }
    const per1k = (n: number): string => (a.words ? (n / a.words) * 1000 : 0).toFixed(1);
    const section = (title: string, hint?: string): HTMLElement => {
      const s = el.createDiv({ cls: "at-section" });
      s.createDiv({ cls: "at-label", text: title });
      if (hint) s.createDiv({ cls: "at-hint", text: hint });
      return s;
    };
    const chips = (parent: HTMLElement, items: ChipItem[]): HTMLElement => {
      const box = parent.createDiv({ cls: "at-chips" });
      for (const it of items) {
        const c = box.createEl("button", { cls: "at-chip" });
        c.createSpan({ text: it.label });
        if (it.count != null) c.createSpan({ cls: "at-chip-n", text: "×" + it.count });
        c.onclick = (): void => this.cycleFind(it.key, it.ranges());
      }
      return box;
    };
    const wordRanges = (idxs: number[]) => (): DocRange[] => idxs.map((i) => P.wordDocRange(a.W[i]));
    const hitRanges = (hits: { para: number; a: number; b: number }[]) => (): DocRange[] => hits.map((h) => P.plainDocRange(a.paras[h.para], h.a, h.b));

    // long sentences
    const ls = section(`Long sentences (over ${a.longThreshold} words) — ${a.longSentences.length}`,
      a.longSentences.length ? "Tap one to find it. Long sentences aren't wrong, but check they're intentional." : "None. 👍");
    for (const s of a.longSentences.slice(0, 8)) {
      const it = ls.createDiv({ cls: "at-item" });
      it.createSpan({ cls: "at-item-n", text: s.n + "w" });
      it.createSpan({ text: a.paras[s.para].plain.slice(s.a, s.a + 70).trim() + "…" });
      it.onclick = (): void => P.highlightSentences([s]);
    }

    // echoes
    const ec = section(`Repeated words nearby`, `The same word again within ${String(P.prefs.echoWindow)} words. Tap to step through them.`);
    if (a.echoes.length) chips(ec, a.echoes.map((e) => ({ key: "echo:" + e.word, label: e.word, count: e.count + 1, ranges: wordRanges(e.idx) })));
    else ec.createDiv({ cls: "at-hint", text: "None found." });

    // openers
    if (a.openers.length) {
      const op = section("Repeated sentence openers", "Three or more sentences in a row that start with the same word.");
      chips(op, a.openers.map((o, k) => ({
        key: "op:" + k,
        label: o.word,
        count: o.sents.length,
        ranges: (): DocRange[] => o.sents.map((s) => {
          const p = a.paras[s.para]; const m = /[\p{L}\p{N}]+/u.exec(p.plain.slice(s.a)); const st0 = s.a + (m ? m.index : 0);
          return P.plainDocRange(p, st0, st0 + (m ? m[0].length : 1));
        }),
      })));
    }

    // adverbs
    const adv = section(`Adverbs (${a.lang === "es" ? "-mente" : "-ly"}) — ${a.adverbCount} · ${per1k(a.adverbCount)} per 1,000 words`);
    if (a.adverbs.length) chips(adv, a.adverbs.slice(0, 20).map((x) => ({ key: "adv:" + x.word, label: x.word, count: x.idx.length, ranges: wordRanges(x.idx) })));

    // crutch words
    const cr = section("Crutch words", "Edit the list in Settings → Authors Toolbox.");
    if (a.crutch.length) chips(cr, a.crutch.map((x) => ({ key: "cr:" + x.word, label: x.word, count: x.hits.length, ranges: hitRanges(x.hits) })));
    else cr.createDiv({ cls: "at-hint", text: "None found." });

    // most used
    if (a.top.length) {
      const tp = section("Most used words", "Excluding common words and names.");
      chips(tp, a.top.map(([w, n]) => ({ key: "top:" + w, label: w, count: n, ranges: (): DocRange[] => a.W.filter((x) => x.lw === w).map((x) => P.wordDocRange(x)) })));
    }
    // names
    if (a.names.length) {
      const nm = section("Names & places", "Capitalised words, by mentions.");
      chips(nm, a.names.map((x) => ({ key: "nm:" + x.word, label: x.shown, count: x.count, ranges: (): DocRange[] => a.W.filter((y) => y.lw === x.word).map((y) => P.wordDocRange(y)) })));
    }
    // longest paragraphs
    const lp = section("Longest paragraphs");
    for (const p of a.longestParas) {
      const it = lp.createDiv({ cls: "at-item" });
      it.createSpan({ cls: "at-item-n", text: p.n + "w" });
      const pp = a.paras[p.i], from = p.a ?? 0, to = p.b ?? pp.plain.length;
      it.createSpan({ text: pp.plain.slice(from, Math.min(to, from + 70)).trim() + "…" });
      it.onclick = (): void => { P.showRanges([P.plainDocRange(pp, from, to)], 0); };
    }
  }

  cycleFind(key: string, ranges: DocRange[]): void {
    if (!ranges.length) return;
    const i = this.cycle[key] == null ? 0 : (this.cycle[key] + 1) % ranges.length;
    this.cycle = { [key]: i };
    this.plugin.showRanges(ranges, i);
  }

  /* ---------- Check ---------- */
  renderCheck(el: HTMLElement, st: PluginState): void {
    const P = this.plugin, s = P.prefs;
    const ltLangKey = st.ltLang as keyof typeof LANGS;
    const langName = st.ltLang === "auto" ? `Auto-detect (likely ${st.analysis.lang === "es" ? "Español" : "English"})` : (LANGS[ltLangKey] || st.ltLang);
    el.createDiv({ cls: "at-hint", text: `Spelling & grammar in ${langName}${st.langSource === "note" ? " — set for this note" : ""}. Change it with the language menu above.` });

    if (!s.ltConsent) {
      const box = el.createDiv({ cls: "at-consent" });
      box.createDiv({ cls: "at-label", text: "Before the first check" });
      box.createEl("p", { text: "Obsidian has no grammar checker of its own, so Authors Toolbox uses LanguageTool. When you tap Check, the text in the chosen scope is sent to " + (s.ltServer || "languagetool.org") + " and the suggestions come back here. Nothing is sent automatically." });
      box.createEl("p", { cls: "at-hint", text: "The free service allows roughly 20,000 characters per request and 75,000 per minute, so long notes are checked in parts. A premium key or your own server can be set in the plugin settings." });
      const b = box.createEl("button", { cls: "mod-cta", text: "Allow and continue" });
      b.onclick = async (): Promise<void> => { s.ltConsent = true; await P.saveSettings(); this.render(); };
      return;
    }

    const scopeRow = el.createDiv({ cls: "at-seg" });
    const hasSel = st.selection && st.selection.words > 0;
    const scopes: [CheckScope, string][] = [["selection", "Selection"], ["section", "This section"], ["note", "Whole note"]];
    let scope = String(s.checkScope || "section");
    if (scope === "selection" && !hasSel) scope = "section";
    for (const [id, label] of scopes) {
      const b = scopeRow.createEl("button", { text: label, cls: scope === id ? "is-active" : "" });
      if (id === "selection" && !hasSel) { b.disabled = true; b.title = "Select some text first"; }
      b.onclick = (): void => { s.checkScope = id; P.saveSettingsSoon(); this.render(); };
    }
    const actions = el.createDiv({ cls: "at-actions" });
    const run = actions.createEl("button", { cls: "mod-cta", text: P.checking ? "Checking…" : "Check" });
    run.disabled = !!P.checking;
    run.onclick = (): void => { void P.runCheck(scope); };
    const chk = P.check && P.check.path === st.file.path ? P.check : null;
    if (chk && chk.issues.size) {
      const clr = actions.createEl("button", { text: "Clear underlines" });
      clr.onclick = (): void => P.clearCheck();
    }
    if (P.checkStatus) el.createDiv({ cls: "at-status", text: P.checkStatus });
    if (!chk) return;

    const issues = [...chk.issues.values()];
    if (!issues.length) { el.createDiv({ cls: "at-ok", text: `No issues found in ${chk.scopeLabel}. ✓` }); return; }
    const counts: Record<string, number> = {};
    issues.forEach((i) => (counts[i.kind] = (counts[i.kind] || 0) + 1));
    const filt = this.kindFilter || null;
    const sum = el.createDiv({ cls: "at-chips" });
    for (const k of Object.keys(KIND_LABEL) as IssueKind[]) {
      if (!counts[k]) continue;
      const c = sum.createEl("button", { cls: `at-chip at-kind-${k}` + (filt === k ? " is-active" : "") });
      c.createSpan({ cls: "at-dot" }); c.createSpan({ text: KIND_LABEL[k] }); c.createSpan({ cls: "at-chip-n", text: String(counts[k]) });
      c.onclick = (): void => { this.kindFilter = filt === k ? null : k; this.render(); };
    }
    const cm = P.cmOf(P.target);
    const doc = cm ? cm.state.doc : null;
    const list = el.createDiv({ cls: "at-issues" });
    for (const it of issues.filter((i) => !filt || i.kind === filt).slice(0, 150)) {
      const rg = cm ? issueRange(cm, it.id) : null;
      const card = list.createDiv({ cls: `at-issue-card at-kind-${it.kind}` });
      const top = card.createDiv({ cls: "at-ic-top" });
      top.createSpan({ cls: "at-ic-kind", text: it.short || KIND_LABEL[it.kind] || it.kind });
      card.createDiv({ cls: "at-ic-msg", text: it.message });
      if (rg && doc) {
        const ctx = card.createDiv({ cls: "at-ic-ctx" });
        const a = Math.max(0, rg.from - 45), b = Math.min(doc.length, rg.to + 45);
        ctx.createSpan({ text: (a > 0 ? "…" : "") + doc.sliceString(a, rg.from).replace(/\s+/g, " ") });
        ctx.createSpan({ cls: "at-ic-err", text: doc.sliceString(rg.from, rg.to) });
        ctx.createSpan({ text: doc.sliceString(rg.to, b).replace(/\s+/g, " ") + (b < doc.length ? "…" : "") });
        ctx.onclick = (): void => P.showRanges([rg], 0, true);
      }
      const btns = card.createDiv({ cls: "at-ic-btns" });
      for (const rep of it.replacements.slice(0, 5)) {
        const b = btns.createEl("button", { cls: "at-fix", text: rep === "" ? "(delete)" : rep });
        b.onclick = (): void => P.applyFix(it.id, rep);
      }
      const ig = btns.createEl("button", { cls: "at-ghost", text: "Ignore" });
      ig.onclick = (): void => P.ignoreIssue(it.id);
      if (it.kind === "spelling") {
        const ad = btns.createEl("button", { cls: "at-ghost", text: "Add to dictionary" });
        ad.onclick = (): void => { void P.addToDictionary(it.id); };
      }
    }
    if (issues.length > 150) list.createDiv({ cls: "at-hint", text: `Showing 150 of ${issues.length}. Fix or ignore some to see more.` });
  }
}

Object.assign(WritingView.prototype, scriptTabMethods);
