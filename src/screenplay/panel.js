import { Menu, setIcon } from "obsidian";
import { cueName, fmtEighths } from "./fountain.js";
import { fmtN } from "../view/helpers.js";

/* ---------- panel tabs for scripts ---------- */

export const scriptTabMethods = {
  renderScriptStats(el, st) {
    const sp = st.script, P = this.plugin;
    const hero = el.createDiv({ cls: "at-hero" });
    hero.createDiv({ cls: "at-hero-num", text: "≈ " + (sp.pages < 10 ? sp.pages.toFixed(1) : Math.round(sp.pages)) });
    const mins = Math.max(1, Math.round(sp.minutes));
    const kind = mins <= 40 ? "Short film" : mins < 70 ? "Medium-length film" : "Feature film";
    hero.createDiv({ cls: "at-hero-sub", text: `pages · ≈ ${mins} min on screen · ${kind}` });
    const fmt = String((st.fm && st.fm.format) || "").toLowerCase();
    const ranges = { short: [5, 30], corto: [5, 30], feature: [90, 120], largo: [90, 120], pilot: [30, 60], piloto: [30, 60], tv: [30, 60] };
    if (ranges[fmt]) {
      const [lo, hi] = ranges[fmt];
      const g = el.createDiv({ cls: "at-goal" });
      const bar = g.createDiv({ cls: "at-bar" }); bar.createDiv({ cls: "at-bar-fill" }).setCssProps({ "--at-pct": Math.min(100, (sp.pages / hi) * 100) + "%" });
      g.createDiv({ cls: "at-goal-row" }).createSpan({ text: `Typical ${fmt}: ${lo}–${hi} pages` });
    }
    el.createDiv({ cls: "at-hint", text: "One page of screenplay ≈ one minute of screen time (Courier 12 pt, standard margins)." });
    if (st.selection && st.selection.words > 0) {
      const box = el.createDiv({ cls: "at-selection" });
      box.createDiv({ cls: "at-label", text: "Selection" });
      box.createDiv({ text: `${fmtN(st.selection.words)} words` });
    }
    const grid = el.createDiv({ cls: "at-grid" });
    const tile = (label, value, hint) => { const d = grid.createDiv({ cls: "at-tile" }); d.createDiv({ cls: "at-tile-v", text: value }); d.createDiv({ cls: "at-tile-l", text: label }); if (hint) d.setAttr("title", hint); };
    const totalW = sp.dialogueWords + sp.actionWords;
    tile("Scenes", fmtN(sp.scenes.length));
    tile("Speaking characters", fmtN(sp.characters.length));
    tile("Locations", fmtN(sp.locations.length));
    tile("Avg. scene", sp.scenes.length ? fmtEighths(Math.round(sp.scenes.reduce((t, s) => t + s.eighths, 0) / sp.scenes.length)) + " pg" : "—", "Scene length in eighths of a page, as on a production board");
    tile("Dialogue", totalW ? Math.round((sp.dialogueWords / totalW) * 100) + "%" : "—", "Share of words spoken vs. action lines");
    tile("Words", fmtN(totalW));
    tile("INT / EXT", `${sp.ie.INT} / ${sp.ie.EXT}${sp.ie["INT/EXT"] ? " / " + sp.ie["INT/EXT"] : ""}`);
    tile("Format notes", fmtN(sp.notes.length), "See the Notes tab");
    const times = Object.entries(sp.times).sort((a, b) => b[1] - a[1]);
    if (times.length) {
      const s = el.createDiv({ cls: "at-section" });
      s.createDiv({ cls: "at-label", text: "Time of day" });
      const box = s.createDiv({ cls: "at-chips" });
      for (const [t, n] of times) { const c = box.createEl("button", { cls: "at-chip" }); c.createSpan({ text: t }); c.createSpan({ cls: "at-chip-n", text: "×" + n }); c.onclick = () => this.cycleFind("time:" + t, sp.scenes.filter((x) => x.time === t).map((x) => P.lineRange(x.line))); }
    }
    if (sp.scenes.length > 1) {
      const s = el.createDiv({ cls: "at-section" });
      s.createDiv({ cls: "at-label", text: "Scene lengths" });
      s.createDiv({ cls: "at-hint", text: "Each bar is a scene, in order. Tap one to go there." });
      const chart = s.createDiv({ cls: "at-rhythm" });
      const max = Math.max(...sp.scenes.map((x) => x.eighths));
      sp.scenes.slice(0, 150).forEach((x) => {
        const b = chart.createDiv({ cls: "at-rbar" + (x.eighths > 24 ? " is-long" : "") });
        b.setCssProps({ "--at-h": Math.max(5, (x.eighths / max) * 100) + "%" });
        b.setAttr("title", `${x.heading} — ${fmtEighths(x.eighths)} pg`);
        b.onclick = () => P.jumpToLine(x.line);
      });
    }
    const ref = el.createEl("details", { cls: "at-section at-ref" });
    ref.createEl("summary", { text: "Format quick reference" });
    const rows = [
      ["Scene heading", "INT. CAFÉ - NIGHT   (or start a line with .)"],
      ["Action", "Plain paragraph, present tense"],
      ["Character", "NAME in caps, dialogue on the next line"],
      ["Extension", "ANA (V.O.) · (O.S.) · (CONT'D)"],
      ["Parenthetical", "(beat) on its own line under the name"],
      ["Transition", "CUT TO:   or   > any text"],
      ["Centered", "> THE END <"],
      ["Force action", "!Line in caps that isn't a name"],
      ["Force character", "@McCLANE"],
      ["Dual dialogue", "Add ^ after the second name"],
      ["Act / sequence", "# Act One  (not printed in Fountain)"],
      ["Page break", "==="],
      ["Notes", "%% invisible note %%"],
      ["Enter key", "After a name: new dialogue line. After dialogue: new element."],
    ];
    const tbl = ref.createDiv({ cls: "at-ref-grid" });
    for (const [a, b] of rows) { tbl.createDiv({ cls: "at-ref-k", text: a }); tbl.createDiv({ cls: "at-ref-v", text: b }); }
  },

  renderScenes(el, st) {
    const o = st.sOutline, sp = st.script, P = this.plugin;
    const byLine = new Map(sp.scenes.map((s, i) => [s.line, { s, i }]));
    const rows = [];
    const walk = (n, depth) => {
      if (n.id) rows.push({ node: n, kind: "act", depth });
      n.scenes.forEach((s, i) => rows.push({ node: s, kind: "c", depth: depth + (n.id ? 1 : 0), siblings: n.scenes, idx: i, parentId: n.id }));
      n.children.forEach((c) => walk(c, depth + (n.id ? 1 : 0)));
    };
    walk(o.root, 0);
    if (!sp.scenes.length) {
      el.createDiv({ cls: "at-empty", text: "No scenes yet. Start a scene with a heading like INT. KITCHEN - NIGHT on its own line (blank line before and after)." });
      return;
    }
    el.createDiv({ cls: "at-hint", text: "Scenes numbered in order, with length in eighths of a page. Drag ⠿ or use ⋯ to reorder scenes within an act (# headings)." });
    const list = el.createDiv({ cls: "at-outline" });
    this.listEl = list;
    const groups = new Map();
    for (const r of rows) {
      const n = r.node;
      const row = list.createDiv({ cls: "at-orow " + (r.kind === "act" ? "at-orow-h" : "at-orow-sc") });
      row.setCssProps({ "--at-indent": (6 + r.depth * 14) + "px" });
      if (st.cursorLine != null && st.cursorLine >= n.start && st.cursorLine < n.end && r.kind === "c") row.addClass("is-here");
      const grip = row.createDiv({ cls: "at-grip" });
      if (r.kind === "c" && r.siblings.length > 1) {
        setIcon(grip, "grip-vertical");
        const key = r.parentId + "|c";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
        grip.addEventListener("pointerdown", (e) => this.startDrag(e, row, key, groups, r));
      } else grip.addClass("is-off");
      const t = row.createDiv({ cls: "at-otitle" });
      const info = byLine.get(n.start);
      if (r.kind === "c" && info) t.createSpan({ cls: "at-scnum", text: String(info.i + 1) });
      t.createSpan({ text: n.title });
      t.onclick = () => P.jumpToLine(n.start);
      row.createDiv({ cls: "at-owords", text: r.kind === "c" && info ? fmtEighths(info.s.eighths) : "" });
      if (r.kind === "c") {
        const more = row.createDiv({ cls: "at-omore" }); setIcon(more, "more-horizontal");
        more.onclick = (e) => {
          const m = new Menu();
          const mv = (to) => P.moveSection(r.parentId, "c", r.idx, to);
          if (r.idx > 0) m.addItem((i) => i.setTitle("Move up").setIcon("arrow-up").onClick(() => mv(r.idx - 1)));
          if (r.idx < r.siblings.length - 1) m.addItem((i) => i.setTitle("Move down").setIcon("arrow-down").onClick(() => mv(r.idx + 1)));
          if (r.idx > 1) m.addItem((i) => i.setTitle("Move to top").setIcon("chevrons-up").onClick(() => mv(0)));
          if (r.idx < r.siblings.length - 2) m.addItem((i) => i.setTitle("Move to bottom").setIcon("chevrons-down").onClick(() => mv(r.siblings.length - 1)));
          m.addItem((i) => i.setTitle("Select scene").setIcon("text-cursor").onClick(() => P.selectLines(n.start, n.end)));
          m.showAtMouseEvent(e);
        };
        if (info && info.s.cast.size) row.setAttr("title", "Cast: " + [...info.s.cast].join(", "));
      }
    }
  },

  renderCast(el, st) {
    const sp = st.script, P = this.plugin;
    const sec = el.createDiv({ cls: "at-section" });
    sec.createDiv({ cls: "at-label", text: `Characters — ${sp.characters.length}` });
    sec.createDiv({ cls: "at-hint", text: "Speeches · words spoken · scenes. Tap a name to step through their lines." });
    if (!sp.characters.length) sec.createDiv({ cls: "at-hint", text: "No dialogue yet." });
    const maxW = Math.max(1, ...sp.characters.map((c) => c.words));
    for (const c of sp.characters) {
      const it = sec.createDiv({ cls: "at-cast" });
      const top = it.createDiv({ cls: "at-cast-top" });
      top.createSpan({ cls: "at-cast-name", text: c.name });
      top.createSpan({ cls: "at-cast-n", text: `${c.speeches} · ${fmtN(c.words)} w · ${c.scenes.size} sc` });
      it.createDiv({ cls: "at-bar" }).createDiv({ cls: "at-bar-fill" }).setCssProps({ "--at-pct": (c.words / maxW) * 100 + "%" });
      it.onclick = () => this.cycleFind("cast:" + c.name, sp.types.map((x, n) => (x && x.t === "character" && cueName(sp.lines[n]) === c.name ? n : -1)).filter((n) => n >= 0).map((n) => P.lineRange(n)));
    }
    const ls = el.createDiv({ cls: "at-section" });
    ls.createDiv({ cls: "at-label", text: `Locations — ${sp.locations.length}` });
    for (const l of sp.locations) {
      const it = ls.createDiv({ cls: "at-item" });
      it.createSpan({ cls: "at-item-n", text: "×" + l.scenes });
      it.createSpan({ text: `${[...l.ie].join("/")} ${l.name}${l.times.size ? " — " + [...l.times].join(", ") : ""}` });
      it.onclick = () => this.cycleFind("loc:" + l.name, sp.scenes.filter((s) => s.location === l.name).map((s) => P.lineRange(s.line)));
    }
  },

  renderNotes(el, st) {
    const sp = st.script, P = this.plugin;
    el.createDiv({ cls: "at-hint", text: "Screenwriting conventions worth checking — guidance, not rules. Tap one to go to the line." });
    if (!sp.notes.length) { el.createDiv({ cls: "at-ok", text: "Nothing to flag. ✓" }); return; }
    const LBL = { dense: "Dense action", speech: "Long speech", heading: "Scene heading", camera: "Camera direction", unfilmable: "Not filmable", intro: "Character introduction", paren: "Parenthetical" };
    const counts = {};
    sp.notes.forEach((n) => (counts[n.kind] = (counts[n.kind] || 0) + 1));
    const filt = this.noteFilter || null;
    const chips = el.createDiv({ cls: "at-chips" });
    for (const [k, n] of Object.entries(counts)) {
      const c = chips.createEl("button", { cls: "at-chip" + (filt === k ? " is-active" : "") });
      c.createSpan({ text: LBL[k] || k }); c.createSpan({ cls: "at-chip-n", text: String(n) });
      c.onclick = () => { this.noteFilter = filt === k ? null : k; this.render(); };
    }
    const list = el.createDiv({ cls: "at-issues" });
    for (const n of sp.notes.filter((x) => !filt || x.kind === filt).slice(0, 120)) {
      const card = list.createDiv({ cls: "at-issue-card at-kind-style" });
      const top = card.createDiv({ cls: "at-ic-top" });
      top.createSpan({ cls: "at-dot" }); top.createSpan({ cls: "at-ic-kind", text: LBL[n.kind] || n.kind });
      card.createDiv({ cls: "at-ic-msg", text: n.msg });
      card.createDiv({ cls: "at-ic-ctx", text: (sp.lines[n.line] || "").trim().slice(0, 90) });
      card.onclick = () => P.showRanges([P.lineRange(n.line)], 0);
    }
  },
};
