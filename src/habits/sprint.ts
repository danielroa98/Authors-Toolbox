import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import type { DailyLog } from "../constants";
import { addDays, writtenOn } from "./log";

/* ======================================================================
   WRITING SPRINTS — a timer with a word target. Words are measured from the daily log,
   so writing in any note counts (and a sprint that crosses midnight keeps counting).
   ====================================================================== */

export interface SprintState { start: number; minutes: number; target: number; startDay: string; startWords: number }
export interface SprintRecord { start: string; minutes: number; elapsed: number; target: number; words: number }

/** Words written since the sprint started. */
export function sprintWords(log: DailyLog, s: SprintState, today: string): number {
  let w = writtenOn(log, s.startDay) - s.startWords;
  for (let k = addDays(s.startDay, 1); k <= today; k = addDays(k, 1)) w += writtenOn(log, k);
  return Math.max(0, w);
}

export const fmtClock = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export class StartSprintModal extends Modal {
  private minutes: number;
  private target: number;
  constructor(app: App, minutes: number, target: number, private onStart: (minutes: number, target: number) => void) {
    super(app);
    this.minutes = minutes; this.target = target;
  }
  onOpen(): void {
    this.titleEl.setText("Writing sprint");
    const { contentEl } = this;
    contentEl.createEl("p", { cls: "setting-item-description", text: "Write without stopping until the timer ends. Words in any note count." });
    const presets = contentEl.createDiv({ cls: "at-seg" });
    let minutesInput: HTMLInputElement | null = null;
    for (const m of [10, 15, 25, 45]) {
      const b = presets.createEl("button", { text: `${m} min`, cls: this.minutes === m ? "is-active" : "" });
      b.onclick = () => {
        this.minutes = m;
        if (minutesInput) minutesInput.value = String(m);
        presets.querySelectorAll("button").forEach((x) => x.toggleClass("is-active", x === b));
      };
    }
    new Setting(contentEl).setName("Minutes").addText((t) => {
      minutesInput = t.inputEl; t.inputEl.type = "number";
      t.setValue(String(this.minutes)).onChange((v) => { this.minutes = Math.max(1, parseInt(v, 10) || this.minutes); });
    });
    new Setting(contentEl).setName("Word target").setDesc("Leave at zero for no target.").addText((t) => {
      t.inputEl.type = "number";
      t.setValue(String(this.target)).onChange((v) => { this.target = Math.max(0, parseInt(v, 10) || 0); });
    });
    new Setting(contentEl).addButton((b) => b.setButtonText("Start").setCta().onClick(() => { this.close(); this.onStart(this.minutes, this.target); }));
  }
  onClose(): void { this.contentEl.empty(); }
}

export class SprintSummaryModal extends Modal {
  constructor(app: App, private r: SprintRecord, private best: number, private early: boolean) { super(app); }
  onOpen(): void {
    const r = this.r;
    this.titleEl.setText(this.early ? "Sprint stopped" : "Sprint finished");
    const el = this.contentEl.createDiv({ cls: "at-sprint-summary" });
    el.createDiv({ cls: "at-hero-num", text: r.words.toLocaleString() });
    el.createDiv({ cls: "at-hero-sub", text: `words in ${Math.max(1, Math.round(r.elapsed))} min · ${(r.words / Math.max(1, r.elapsed)).toFixed(1)} words per minute` });
    if (r.target) {
      const pct = Math.min(100, Math.round((r.words / r.target) * 100));
      const bar = el.createDiv({ cls: "at-bar" });
      bar.createDiv({ cls: "at-bar-fill" }).setCssProps({ "--at-pct": pct + "%" });
      el.createDiv({ cls: "at-hint", text: r.words >= r.target ? `Target of ${r.target.toLocaleString()} reached.` : `${pct}% of the ${r.target.toLocaleString()}-word target.` });
    }
    if (r.words > 0 && r.words >= this.best) el.createDiv({ cls: "at-ok", text: "Your best sprint so far." });
    new Setting(this.contentEl).addButton((b) => b.setButtonText("Done").setCta().onClick(() => this.close()));
  }
  onClose(): void { this.contentEl.empty(); }
}
