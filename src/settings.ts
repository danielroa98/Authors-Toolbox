import { Setting, PluginSettingTab } from "obsidian";
import type { App, SettingDefinitionGroup, SettingDefinitionItem, SettingGroupItem } from "obsidian";
import { DEFAULTS } from "./constants";
import type { ToolboxPrefs } from "./constants";
import { SCRIPTS_FOLDER_DEFAULT } from "./screenplay/editor";
import { DEFAULT_CRUTCH } from "./text/analysis";
import { LANGS } from "./view/helpers";

/** What the settings tab needs from the plugin. */
export interface SettingsPlugin {
  prefs: ToolboxPrefs;
  saveSettings(): Promise<void>;
  refreshSoon(): void;
}

/* ======================================================================
   SETTINGS — one table drives both the declarative settings of Obsidian 1.13+
   (searchable from the settings search box) and the classic display() used by older versions.
   ====================================================================== */

type FieldKind = "text" | "textarea" | "number" | "toggle" | "dropdown" | "folder" | "password";
type Key = keyof ToolboxPrefs;

interface Field {
  key: Key;
  name: string;
  desc?: string;
  kind: FieldKind;
  options?: Record<string, string>;
  /** Shown (and used as placeholder) when the stored text is empty. */
  emptyShows?: string;
  /** Text: value saved when the field is cleared. Number: value used when the input isn't a positive number. */
  fallback?: string | number;
  /** Number fields where 0 is a valid choice. */
  allowZero?: boolean;
}

interface Group { heading: string; fields: Field[] }

const GROUPS: Group[] = [
  {
    heading: "Images",
    fields: [
      { key: "imageFolder", kind: "folder", name: "Folder for uploaded images", desc: "Images chosen from your device are copied here. Leave empty to use the attachment location from Obsidian's own settings." },
      { key: "defaultWidth", kind: "number", name: "Default image width (px)", allowZero: true },
      { key: "defaultAlign", kind: "dropdown", name: "Default image alignment", options: { none: "Inline", center: "Centered", left: "Left", right: "Right" } },
    ],
  },
  {
    heading: "Writing panel",
    fields: [
      { key: "defaultLang", kind: "dropdown", name: "Default language", options: LANGS, desc: "Used when a note has no “lang” property. Auto-detect reads the text and picks the language." },
      { key: "defaultGoal", kind: "number", name: "Default word goal", desc: "Applies to notes without a “word_goal” property. 0 = none.", allowZero: true },
      { key: "readingWpm", kind: "number", name: "Reading speed (words per minute)", fallback: 230 },
      { key: "speakingWpm", kind: "number", name: "Reading-aloud speed (words per minute)", fallback: 150 },
      { key: "longSentence", kind: "number", name: "Long sentence threshold (words)", fallback: 35 },
      { key: "echoWindow", kind: "number", name: "Repetition window (words)", desc: "Flag a word that appears again within this many words.", fallback: 40 },
      { key: "crutchEn", kind: "textarea", name: "English crutch words", desc: "Comma-separated words or phrases.", emptyShows: DEFAULT_CRUTCH.en },
      { key: "crutchEs", kind: "textarea", name: "Spanish crutch words", desc: "Palabras o frases separadas por comas.", emptyShows: DEFAULT_CRUTCH.es },
    ],
  },
  {
    heading: "Stories",
    fields: [
      { key: "autoRaya", kind: "toggle", name: "Dialogue dash (raya)", desc: "In story notes, a - typed at the start of a line becomes — (so it doesn't turn into a bullet), and -- anywhere becomes —. Undo right after gives you the plain hyphen back." },
      { key: "storyFolders", kind: "textarea", name: "Story folders", desc: "Notes in these folders (one per line), or any note with type: story, count as stories." },
    ],
  },
  {
    heading: "Screenplays",
    fields: [
      { key: "scriptsFolder", kind: "folder", name: "Scripts folder", desc: "Folder where new scripts and story adaptations are created.", fallback: SCRIPTS_FOLDER_DEFAULT },
      { key: "authorName", kind: "text", name: "Author name", desc: "Written on the title page of new scripts." },
      { key: "smartEnter", kind: "toggle", name: "Smart line breaks in scripts", desc: "After a character name or parenthetical, the return key starts the next dialogue line; after dialogue or action it starts a new element (blank line). Shift+Enter always inserts a plain line break. Reload the plugin after changing." },
    ],
  },
  {
    heading: "Spelling & grammar",
    fields: [
      { key: "ltConsent", kind: "toggle", name: "Allow sending text to the grammar service", desc: "Checks run only when you ask: from the panel, a command, or the editor's context menu. The text in the chosen scope is sent to the server below (LanguageTool). Obsidian's built-in spellcheck keeps working alongside it; on macOS and iOS it follows your keyboard languages." },
      { key: "ltServer", kind: "text", name: "Server", desc: "Default: https://api.languagetool.org (free). You can point this to your own LanguageTool server.", fallback: DEFAULTS.ltServer },
      { key: "ltUser", kind: "text", name: "Premium username (email)", desc: "Optional. A premium account gives higher limits and more checks." },
      { key: "ltKey", kind: "password", name: "Premium API key" },
      { key: "ltPicky", kind: "toggle", name: "Picky mode", desc: "Extra style and punctuation suggestions." },
      { key: "ltDictionary", kind: "textarea", name: "Personal dictionary", desc: "One word per line (character names, places, invented words). These are never flagged as misspelled." },
      { key: "ltDisabledRules", kind: "textarea", name: "Turned-off rules", desc: "Rule IDs from the grammar service, comma-separated." },
    ],
  },
];

const FIELDS = new Map<string, Field>(GROUPS.flatMap((g) => g.fields.map((f): [string, Field] => [f.key, f])));

export class ToolboxSettings extends PluginSettingTab {
  constructor(app: App, private plugin: SettingsPlugin & ConstructorParameters<typeof PluginSettingTab>[1]) { super(app, plugin); }

  private get prefs(): Record<string, unknown> {
    return this.plugin.prefs as unknown as Record<string, unknown>;
  }

  /** The value a field shows. */
  private shown(f: Field): string | number | boolean {
    const v = this.prefs[f.key];
    if (f.kind === "toggle") return v === true;
    if (f.kind === "number") return typeof v === "number" ? v : Number(DEFAULTS[f.key]);
    const s = typeof v === "string" ? v : "";
    return s || f.emptyShows || "";
  }

  /** Clean a value and store it. */
  private async store(f: Field, value: unknown): Promise<void> {
    let v: string | number | boolean;
    if (f.kind === "toggle") v = value === true;
    else if (f.kind === "number") {
      const n = typeof value === "number" ? value : parseInt(String(value), 10);
      const ok = Number.isFinite(n) && (n > 0 || (f.allowZero === true && n === 0));
      v = ok ? Math.round(n) : typeof f.fallback === "number" ? f.fallback : 0;
    } else {
      const s = typeof value === "string" ? value : "";
      v = f.kind === "textarea" ? s : s.trim();
      if (!v && typeof f.fallback === "string") v = f.fallback;
    }
    this.prefs[f.key] = v;
    await this.plugin.saveSettings();
    this.plugin.refreshSoon();
  }

  /* ---------- Obsidian 1.13+: declarative, searchable settings ---------- */

  getSettingDefinitions(): SettingDefinitionItem[] {
    return GROUPS.map((g): SettingDefinitionGroup => ({
      type: "group",
      heading: g.heading,
      items: g.fields.map((f) => this.definition(f)),
    }));
  }

  private definition(f: Field): SettingGroupItem {
    const base = { name: f.name, desc: f.desc };
    switch (f.kind) {
      case "toggle": return { ...base, control: { type: "toggle", key: f.key } };
      case "number": return { ...base, control: { type: "number", key: f.key, min: 0 } };
      case "dropdown": return { ...base, control: { type: "dropdown", key: f.key, options: f.options ?? {} } };
      case "folder": return { ...base, control: { type: "folder", key: f.key, placeholder: typeof f.fallback === "string" ? f.fallback : "" } };
      case "textarea": return { ...base, control: { type: "textarea", key: f.key, placeholder: f.emptyShows } };
      case "text": return { ...base, control: { type: "text", key: f.key } };
      case "password": return { ...base, render: (setting: Setting) => { this.addControl(setting, f); } };
    }
  }

  getControlValue(key: string): unknown {
    const f = FIELDS.get(key);
    return f ? this.shown(f) : this.prefs[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const f = FIELDS.get(key);
    if (f) await this.store(f, value);
  }

  /* ---------- older Obsidian versions ---------- */

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    for (const g of GROUPS) {
      new Setting(containerEl).setName(g.heading).setHeading();
      for (const f of g.fields) {
        const s = new Setting(containerEl).setName(f.name);
        if (f.desc) s.setDesc(f.desc);
        this.addControl(s, f);
      }
    }
  }

  /** Classic control for one field (also renders the password field in the declarative layout). */
  private addControl(s: Setting, f: Field): void {
    const v = this.shown(f);
    const save = (x: unknown) => { void this.store(f, x); };
    switch (f.kind) {
      case "toggle": s.addToggle((t) => t.setValue(v === true).onChange(save)); break;
      case "dropdown": s.addDropdown((d) => d.addOptions(f.options ?? {}).setValue(String(v)).onChange(save)); break;
      case "textarea": s.addTextArea((t) => { if (f.emptyShows) t.setPlaceholder(f.emptyShows); t.setValue(String(v)).onChange(save); }); break;
      case "password": s.addText((t) => { t.inputEl.type = "password"; t.setValue(String(v)).onChange(save); }); break;
      default: s.addText((t) => t.setValue(String(v)).onChange(save)); break;
    }
  }
}
