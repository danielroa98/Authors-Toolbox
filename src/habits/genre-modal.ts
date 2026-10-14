import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import { normaliseGenre } from "./genres";

/** Pick one or more genres for a work: the genres you already use, plus new ones. */
export class GenreModal extends Modal {
  private chosen: string[];
  constructor(app: App, private title: string, current: string[], private known: string[], private onSave: (genres: string[]) => void) {
    super(app);
    this.chosen = [...current];
  }
  onOpen(): void {
    this.titleEl.setText(`Genre of “${this.title}”`);
    this.render();
  }
  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    const all = [...new Set([...this.known, ...this.chosen])].sort((a, b) => a.localeCompare(b));
    if (all.length) {
      contentEl.createDiv({ cls: "setting-item-description", text: "Tap to add or remove. A work can have several genres." });
      const box = contentEl.createDiv({ cls: "at-chips" });
      for (const g of all) {
        const on = this.chosen.includes(g);
        const c = box.createEl("button", { cls: "at-chip" + (on ? " is-active" : ""), text: g });
        c.onclick = () => { this.chosen = on ? this.chosen.filter((x) => x !== g) : [...this.chosen, g]; this.render(); };
      }
    }
    let input = "";
    new Setting(contentEl).setName("New genre").addText((t) => {
      t.setPlaceholder("Terror, romance, ciencia ficción…").onChange((v) => { input = v; });
      t.inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
    }).addButton((b) => b.setButtonText("Add").onClick(() => add()));
    const add = () => {
      for (const g of input.split(",").map(normaliseGenre).filter(Boolean)) if (!this.chosen.includes(g)) this.chosen.push(g);
      this.render();
    };
    new Setting(contentEl).addButton((b) => b.setButtonText("Save").setCta().onClick(() => { this.close(); this.onSave(this.chosen); }));
  }
  onClose(): void { this.contentEl.empty(); }
}
