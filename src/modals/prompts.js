import { Modal } from "obsidian";

export class NumberPrompt extends Modal {
  constructor(app, title, value, onDone) { super(app); this.t = title; this.v = value; this.onDone = onDone; }
  onOpen() {
    this.contentEl.createEl("h3", { text: this.t });
    const input = this.contentEl.createEl("input", { type: "number", attr: { inputmode: "numeric", min: "0" } });
    input.value = this.v ? String(this.v) : "";
    input.addClass("at-full");
    const row = this.contentEl.createDiv({ cls: "at-modal-btns" });
    const save = () => { this.onDone(parseInt(input.value, 10) || 0); this.close(); };
    row.createEl("button", { text: "Remove" }).onclick = () => { this.onDone(0); this.close(); };
    row.createEl("button", { text: "Save", cls: "mod-cta" }).onclick = save;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
    window.setTimeout(() => input.focus(), 30);
  }
  onClose() { this.contentEl.empty(); }
}

/* ---------- small text prompt ---------- */

export class TextPrompt extends Modal {
  constructor(app, title, value, onDone, hint) { super(app); this.t = title; this.v = value; this.onDone = onDone; this.hint = hint; }
  onOpen() {
    this.contentEl.createEl("h3", { text: this.t });
    if (this.hint) this.contentEl.createDiv({ cls: "setting-item-description", text: this.hint });
    const input = this.contentEl.createEl("input", { type: "text" });
    input.value = this.v || ""; input.addClass("at-full");
    const row = this.contentEl.createDiv({ cls: "at-modal-btns" });
    const ok = () => { const v = input.value.trim(); if (v) { this.close(); this.onDone(v); } };
    row.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    row.createEl("button", { text: "Create", cls: "mod-cta" }).onclick = ok;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") ok(); });
    window.setTimeout(() => { input.focus(); input.select(); }, 30);
  }
  onClose() { this.contentEl.empty(); }
}
