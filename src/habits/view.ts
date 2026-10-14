import { ItemView, TFile, TFolder, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import { proseMap, words } from "../text/analysis";
import { NO_GENRE, formOf, genresOf, projectsOf } from "./genres";
import { addDays, dayKey, series, streaks, totals, wordsByGroup } from "./log";
import { fmtClock, sprintWords } from "./sprint";
import type AuthorsToolbox from "../main";

/* ======================================================================
   WRITING HABITS — words per day, goal and streaks, sprints, and where the words go:
   by genre, by form and by project.
   ====================================================================== */

export const VIEW_HABITS = "authors-toolbox-habits";

interface Work { file: TFile; genres: string[]; form: string; projects: string[]; words: number }

/** "2026-10-14 14:25" in local time. */
const localTime = (iso: string) => { const d = new Date(iso); return `${dayKey(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const fmt = (n: number) => Math.round(n).toLocaleString();
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export class HabitsView extends ItemView {
  private works: Work[] | null = null;
  private loading = false;

  constructor(leaf: WorkspaceLeaf, private plugin: AuthorsToolbox) { super(leaf); }
  getViewType(): string { return VIEW_HABITS; }
  getDisplayText(): string { return "Writing habits"; }
  getIcon(): string { return "flame"; }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("at-habits");
    this.render();
    await this.loadWorks();
  }
  async onClose(): Promise<void> { this.contentEl.empty(); await Promise.resolve(); }

  /** Read the works in the writing folders (counts and properties). */
  async loadWorks(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const out: Work[] = [];
      for (const f of this.plugin.writingFiles()) {
        const fm = (this.app.metadataCache.getFileCache(f)?.frontmatter ?? {}) as Record<string, unknown>;
        if (typeof fm.type === "string" && ["hub", "anthology"].includes(fm.type)) continue;
        const text = await this.app.vault.cachedRead(f);
        const n = proseMap(text).paras.reduce((t, p) => t + (p.kind === "heading" ? 0 : words(p.plain).length), 0);
        out.push({ file: f, genres: genresOf(fm), form: formOf(fm), projects: projectsOf(fm), words: n });
      }
      this.works = out;
    } finally {
      this.loading = false;
    }
    this.render();
  }

  render(): void {
    const el = this.contentEl;
    const scroll = el.scrollTop;
    el.empty();
    const P = this.plugin, s = P.prefs, log = s.daily ?? {};
    const today = dayKey(new Date());
    const range = s.habitsRange === "90" ? 90 : s.habitsRange === "365" ? 365 : 30;
    const from = addDays(today, -(range - 1));

    // header
    const head = el.createDiv({ cls: "at-h-head" });
    head.createEl("h2", { text: "Writing habits" });
    const actions = head.createDiv({ cls: "at-h-actions" });
    const seg = actions.createDiv({ cls: "at-seg" });
    for (const r of ["30", "90", "365"]) {
      const b = seg.createEl("button", { text: `${r} days`, cls: s.habitsRange === r || (r === "30" && !["90", "365"].includes(s.habitsRange)) ? "is-active" : "" });
      b.onclick = () => { s.habitsRange = r; P.saveSettingsSoon(); this.render(); };
    }
    const sprintBtn = actions.createEl("button", { cls: P.sprint ? "" : "mod-cta", text: P.sprint ? "Stop sprint" : "Start sprint" });
    sprintBtn.onclick = () => { if (P.sprint) P.finishSprint(true); else P.openSprint(); };
    const refresh = actions.createEl("button", { attr: { "aria-label": "Refresh" } });
    setIcon(refresh, "refresh-cw");
    refresh.onclick = () => { this.works = null; this.render(); void this.loadWorks(); };

    if (P.sprint) {
      const sp = P.sprint;
      const box = el.createDiv({ cls: "at-sprint-live" });
      const w = sprintWords(log, sp, today);
      box.createSpan({ cls: "at-sprint-clock", text: fmtClock(sp.start + sp.minutes * 60000 - Date.now()) });
      box.createSpan({ text: ` left · ${fmt(w)}${sp.target ? ` / ${fmt(sp.target)}` : ""} words` });
    }

    // tiles
    const t = totals(log, today);
    const st = streaks(log, today, s.dailyGoal);
    const grid = el.createDiv({ cls: "at-grid at-h-grid" });
    const tile = (label: string, value: string, hint?: string) => {
      const d = grid.createDiv({ cls: "at-tile" });
      d.createDiv({ cls: "at-tile-v", text: value });
      d.createDiv({ cls: "at-tile-l", text: label });
      if (hint) d.setAttr("title", hint);
    };
    tile(s.dailyGoal ? `Today · goal ${fmt(s.dailyGoal)}` : "Today", s.dailyGoal ? `${fmt(t.today)} (${pct(t.today, s.dailyGoal)}%)` : fmt(t.today));
    tile("Current streak", `${st.current} ${st.current === 1 ? "day" : "days"}${st.todayDone ? " ✓" : ""}`, s.dailyGoal ? "Days in a row that reached the daily goal" : "Days in a row with some writing");
    tile("Best streak", `${st.best} ${st.best === 1 ? "day" : "days"}`);
    tile("This week", fmt(t.week));
    tile("This month", fmt(t.month));
    tile("Writing days", fmt(t.days), "Days with any writing in the recorded history");
    if (!s.dailyGoal) el.createDiv({ cls: "at-hint", text: "Set a daily word goal in the settings to track streaks against it." });

    // chart
    const weekly = range === 365;
    const data = series(log, today, range, weekly);
    const sec = this.section(el, weekly ? "Words per week" : "Words per day");
    const max = Math.max(1, ...data.map((d) => d.words), weekly ? 0 : s.dailyGoal);
    const chart = sec.createDiv({ cls: "at-h-chart" });
    if (s.dailyGoal && !weekly) chart.createDiv({ cls: "at-h-goal" }).setCssProps({ "--at-h": `${(s.dailyGoal / max) * 100}%` });
    for (const d of data) {
      const b = chart.createDiv({ cls: "at-h-bar" + (s.dailyGoal && !weekly && d.words >= s.dailyGoal ? " is-goal" : "") });
      b.setCssProps({ "--at-h": `${Math.max(d.words ? 2 : 0, (d.words / max) * 100)}%` });
      b.setAttr("title", `${weekly ? "Week of " : ""}${d.key}: ${fmt(d.words)} words`);
    }
    const axis = sec.createDiv({ cls: "at-h-axis" });
    axis.createSpan({ text: data[0]?.label ?? "" });
    axis.createSpan({ text: `${fmt(data.reduce((a, d) => a + d.words, 0))} words in ${range} days` });
    axis.createSpan({ text: data[data.length - 1]?.label ?? "" });

    // genres, forms, projects
    if (!this.works) {
      el.createDiv({ cls: "at-hint", text: this.loading ? "Reading your works…" : "" });
    } else {
      const byPath = new Map(this.works.map((w) => [w.file.path, w]));
      const groupOfPath = (pick: (w: Work) => string[]) => (path: string) => {
        const w = byPath.get(path);
        if (w) return pick(w);
        // notes outside the writing folders still count if they have a genre or type
        const f = this.app.vault.getAbstractFileByPath(path);
        if (!(f instanceof TFile)) return [];
        const fm = (this.app.metadataCache.getFileCache(f)?.frontmatter ?? {}) as Record<string, unknown>;
        return pick({ file: f, genres: genresOf(fm), form: formOf(fm), projects: projectsOf(fm), words: 0 });
      };
      this.renderGroups(el, "Genres", from, today, range, groupOfPath((w) => (w.genres.length ? w.genres : [NO_GENRE])), (w) => (w.genres.length ? w.genres : [NO_GENRE]), true);
      this.renderGroups(el, "Forms", from, today, range, groupOfPath((w) => [w.form]), (w) => [w.form], false);
      this.renderProjects(el, from, today, range, groupOfPath((w) => w.projects));
    }

    // sprints
    this.renderSprints(el);
    el.scrollTop = scroll;
  }

  private section(el: HTMLElement, title: string, hint?: string): HTMLElement {
    const s = el.createDiv({ cls: "at-section" });
    s.createDiv({ cls: "at-label", text: title });
    if (hint) s.createDiv({ cls: "at-hint", text: hint });
    return s;
  }

  /** Words written per group in the period, plus works and words per group overall. */
  private renderGroups(el: HTMLElement, title: string, from: string, today: string, range: number,
    groupsOfPath: (path: string) => string[], groupsOfWork: (w: Work) => string[], isGenre: boolean): void {
    const works = this.works ?? [];
    const recent = wordsByGroup(this.plugin.prefs.daily ?? {}, from, today, groupsOfPath);
    const lib = new Map<string, { works: number; words: number }>();
    for (const w of works) for (const g of groupsOfWork(w)) {
      const e = lib.get(g) ?? { works: 0, words: 0 };
      e.works++; e.words += w.words; lib.set(g, e);
    }
    const names = [...new Set([...recent.keys(), ...lib.keys()])];
    const sec = this.section(el, title);
    if (!names.length) { sec.createDiv({ cls: "at-hint", text: "No works found in the writing folders yet." }); return; }
    const totalRecent = [...recent.values()].reduce((a, b) => a + b, 0);
    const totalLib = [...lib.values()].reduce((a, b) => a + b.words, 0);
    // headline: where most words go (recently, or in the library when nothing was written in the period)
    const rankBy = totalRecent ? (n: string) => recent.get(n) ?? 0 : (n: string) => lib.get(n)?.words ?? 0;
    const ranked = names.filter((n) => !(isGenre && n === NO_GENRE)).sort((a, b) => rankBy(b) - rankBy(a));
    const top = ranked[0];
    if (top && rankBy(top) > 0) {
      const share = pct(rankBy(top), totalRecent || totalLib);
      sec.createDiv({ cls: "at-h-top", text: totalRecent
        ? `You write most ${isGenre ? "in" : "as"} ${top}: ${share}% of the words written in the last ${range} days.`
        : `Most of your work is ${top}: ${share}% of the words in your writing folders.` });
    }
    const max = Math.max(1, ...names.map((n) => recent.get(n) ?? 0));
    const table = sec.createDiv({ cls: "at-h-table" });
    const header = table.createDiv({ cls: "at-h-row at-h-row-head" });
    for (const h of [title.replace(/s$/, ""), `Last ${range} days`, "Works", "Words"]) header.createSpan({ text: h });
    for (const n of names.sort((a, b) => (recent.get(b) ?? 0) - (recent.get(a) ?? 0) || (lib.get(b)?.words ?? 0) - (lib.get(a)?.words ?? 0))) {
      const row = table.createDiv({ cls: "at-h-row" });
      row.createSpan({ cls: "at-h-name", text: n });
      const cell = row.createSpan({ cls: "at-h-barcell" });
      cell.createDiv({ cls: "at-h-hbar" }).setCssProps({ "--at-pct": `${((recent.get(n) ?? 0) / max) * 100}%` });
      cell.createSpan({ cls: "at-h-num", text: fmt(recent.get(n) ?? 0) });
      row.createSpan({ cls: "at-h-num", text: fmt(lib.get(n)?.works ?? 0) });
      row.createSpan({ cls: "at-h-num", text: fmt(lib.get(n)?.words ?? 0) });
    }
    if (isGenre) {
      const untagged = works.filter((w) => !w.genres.length).sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
      if (untagged.length) {
        const box = sec.createEl("details", { cls: "at-h-untagged" });
        box.createEl("summary", { text: `${untagged.length} ${untagged.length === 1 ? "work has" : "works have"} no genre yet` });
        for (const w of untagged.slice(0, 40)) {
          const r = box.createDiv({ cls: "at-item" });
          r.createSpan({ cls: "at-item-n", text: w.form });
          const name = r.createSpan({ cls: "at-h-link", text: w.file.basename });
          name.onclick = () => { void this.app.workspace.getLeaf(false).openFile(w.file); };
          const b = r.createEl("button", { cls: "at-ghost", text: "Set genre" });
          b.onclick = () => this.plugin.openGenre(w.file, () => { this.works = null; void this.loadWorks(); });
        }
      }
    }
  }

  private renderProjects(el: HTMLElement, from: string, today: string, range: number, groupsOfPath: (path: string) => string[]): void {
    const works = this.works ?? [];
    const projects = new Map<string, Work[]>();
    for (const w of works) for (const p of w.projects) projects.set(p, [...(projects.get(p) ?? []), w]);
    if (!projects.size) return;
    const recent = wordsByGroup(this.plugin.prefs.daily ?? {}, from, today, groupsOfPath);
    const sec = this.section(el, "Projects", "Anthologies and collections, from each work's “anthology” property. Add a word_goal property to the project note to track progress.");
    for (const [name, ws] of [...projects.entries()].sort((a, b) => (recent.get(b[0]) ?? 0) - (recent.get(a[0]) ?? 0))) {
      const total = ws.reduce((a, w) => a + w.words, 0);
      const note = this.app.metadataCache.getFirstLinkpathDest(name, ws[0].file.path);
      const fm = note ? (this.app.metadataCache.getFileCache(note)?.frontmatter ?? {}) as Record<string, unknown> : {};
      const goal = typeof fm.word_goal === "number" ? fm.word_goal : typeof fm.word_goal === "string" ? parseInt(fm.word_goal, 10) || 0 : 0;
      const card = sec.createDiv({ cls: "at-h-project" });
      const top = card.createDiv({ cls: "at-h-project-top" });
      const title = top.createSpan({ cls: "at-h-link at-h-name", text: name });
      if (note) title.onclick = () => { void this.app.workspace.getLeaf(false).openFile(note); };
      top.createSpan({ cls: "at-h-num", text: `${ws.length} ${ws.length === 1 ? "work" : "works"} · ${fmt(total)} words · +${fmt(recent.get(name) ?? 0)} in ${range} days` });
      if (goal) {
        card.createDiv({ cls: "at-bar" }).createDiv({ cls: "at-bar-fill" }).setCssProps({ "--at-pct": `${Math.min(100, pct(total, goal))}%` });
        card.createDiv({ cls: "at-hint", text: `${pct(total, goal)}% of ${fmt(goal)} words` });
      }
    }
  }

  private renderSprints(el: HTMLElement): void {
    const list = this.plugin.prefs.sprints ?? [];
    const sec = this.section(el, "Sprints");
    if (!list.length) { sec.createDiv({ cls: "at-hint", text: "No sprints yet. A sprint is a timed burst of writing with a word target." }); return; }
    const words = list.reduce((a, r) => a + r.words, 0), minutes = list.reduce((a, r) => a + r.elapsed, 0);
    const best = list.reduce((a, r) => Math.max(a, r.words), 0);
    sec.createDiv({ cls: "at-hint", text: `${list.length} ${list.length === 1 ? "sprint" : "sprints"} · ${fmt(minutes)} min · ${fmt(words)} words · ${(words / Math.max(1, minutes)).toFixed(1)} words per minute · best ${fmt(best)} words` });
    for (const r of list.slice(-6).reverse()) {
      const row = sec.createDiv({ cls: "at-item" });
      row.createSpan({ cls: "at-item-n", text: `${fmt(r.words)}w` });
      row.createSpan({ text: `${localTime(r.start)} · ${Math.round(r.elapsed)} min${r.target ? ` · target ${fmt(r.target)}${r.words >= r.target ? " ✓" : ""}` : ""}` });
    }
  }
}

/** Markdown files inside the given folders (recursively), skipping export folders. */
export function filesIn(folders: TFolder[]): TFile[] {
  const out: TFile[] = [];
  const walk = (f: TFolder) => {
    for (const c of f.children) {
      if (c instanceof TFile && c.extension === "md") out.push(c);
      else if (c instanceof TFolder && c.name !== "Exports") walk(c);
    }
  };
  folders.forEach(walk);
  return [...new Set(out)];
}
