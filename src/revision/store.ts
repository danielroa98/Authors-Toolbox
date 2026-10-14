import { normalizePath } from "obsidian";
import type { DataAdapter } from "obsidian";

/* ======================================================================
   DRAFTS — copies of a note kept for revision.
   One JSON file per note in a (by default hidden) folder of the vault, so
   drafts sync with the vault but never appear in search, the graph,
   Dataview or word counts, and survive uninstalling the plugin.
   ====================================================================== */

export interface Draft {
  id: string;
  name: string;
  /** Milliseconds since 1970. */
  created: number;
  /** Kept automatically (daily checkpoint, before a restore); pruned after some days. */
  auto?: boolean;
  /** The writer's note about this draft. */
  note?: string;
  words: number;
  /** The whole note, front matter included. */
  text: string;
}

export interface RevisionGoal {
  /** "cut": cut `value` percent of the words; "words": reach `value` words. */
  kind: "cut" | "words";
  value: number;
  /** Draft the goal is measured from. */
  from: string;
}

export interface DraftFile {
  version: 1;
  path: string;
  drafts: Draft[];
  goal?: RevisionGoal;
}

/** FNV-1a hash of a string, as 8 hex digits. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** File name for a note's drafts: a readable part plus a hash of the full path. */
export function draftFileName(path: string): string {
  const base = (path.split("/").pop() ?? path).replace(/\.md$/i, "");
  const slug = base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).toLowerCase();
  return `${slug || "note"}-${hash(path)}.json`;
}

const DAY = 86400000;

/** Short date (and time) of a draft: "14 Oct, 09:30"; the year only when it isn't this year. */
export function draftWhen(d: Draft | number, withTime = true): string {
  const t = new Date(typeof d === "number" ? d : d.created);
  const date = t.toLocaleDateString(undefined, { day: "numeric", month: "short", year: t.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  return withTime ? `${date}, ${t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : date;
}

export class DraftStore {
  private readonly cache = new Map<string, DraftFile>();

  constructor(private readonly adapter: DataAdapter, private readonly folder: () => string) {}

  private dir(): string { return normalizePath(this.folder().trim() || ".authors-toolbox/drafts"); }
  private fileOf(path: string): string { return `${this.dir()}/${draftFileName(path)}`; }

  async load(path: string): Promise<DraftFile> {
    const hit = this.cache.get(path);
    if (hit) return hit;
    const f = this.fileOf(path);
    let df: DraftFile = { version: 1, path, drafts: [] };
    try {
      if (await this.adapter.exists(f)) {
        const parsed = JSON.parse(await this.adapter.read(f)) as Partial<DraftFile>;
        if (parsed && Array.isArray(parsed.drafts)) df = { version: 1, path, drafts: parsed.drafts, goal: parsed.goal };
      }
    } catch (e) {
      console.error("Authors Toolbox: could not read drafts of", path, e);
    }
    df.drafts.sort((x, y) => x.created - y.created);
    this.cache.set(path, df);
    return df;
  }

  async save(df: DraftFile): Promise<void> {
    const dir = this.dir();
    // create each missing level (the adapter needs the parent folders)
    let acc = "";
    for (const part of dir.split("/")) {
      acc = acc ? `${acc}/${part}` : part;
      if (!(await this.adapter.exists(acc))) await this.adapter.mkdir(acc);
    }
    const f = this.fileOf(df.path);
    if (!df.drafts.length && !df.goal) {
      if (await this.adapter.exists(f)) await this.adapter.remove(f);
    } else {
      await this.adapter.write(f, JSON.stringify(df));
    }
    this.cache.set(df.path, df);
  }

  async list(path: string): Promise<Draft[]> { return (await this.load(path)).drafts; }

  async latest(path: string): Promise<Draft | null> { const d = await this.list(path); return d.length ? d[d.length - 1] : null; }

  async get(path: string, id: string): Promise<Draft | null> { return (await this.list(path)).find((d) => d.id === id) ?? null; }

  async add(path: string, text: string, words: number, opts: { name: string; note?: string; auto?: boolean; now?: number }): Promise<Draft> {
    const df = await this.load(path);
    const created = opts.now ?? Date.now();
    const d: Draft = { id: created.toString(36) + Math.floor(Math.random() * 1296).toString(36).padStart(2, "0"), name: opts.name, created, words, text };
    if (opts.note) d.note = opts.note;
    if (opts.auto) d.auto = true;
    df.drafts.push(d);
    df.drafts.sort((x, y) => x.created - y.created);
    await this.save(df);
    return d;
  }

  async update(path: string, id: string, change: Partial<Pick<Draft, "name" | "note" | "auto">>): Promise<void> {
    const df = await this.load(path);
    const d = df.drafts.find((x) => x.id === id);
    if (!d) return;
    Object.assign(d, change);
    if (!d.note) delete d.note;
    if (!d.auto) delete d.auto;
    await this.save(df);
  }

  async remove(path: string, id: string): Promise<void> {
    const df = await this.load(path);
    df.drafts = df.drafts.filter((d) => d.id !== id);
    if (df.goal && df.goal.from === id) delete df.goal;
    await this.save(df);
  }

  async setGoal(path: string, goal: RevisionGoal | null): Promise<void> {
    const df = await this.load(path);
    if (goal) df.goal = goal; else delete df.goal;
    await this.save(df);
  }

  /** Automatic drafts older than `days` are dropped (never the latest draft, never the goal's draft). */
  async pruneAuto(path: string, days: number, now = Date.now()): Promise<number> {
    const df = await this.load(path);
    const last = df.drafts[df.drafts.length - 1];
    const keep = df.drafts.filter((d) => !d.auto || d === last || d.id === df.goal?.from || now - d.created < days * DAY);
    const n = df.drafts.length - keep.length;
    if (n) { df.drafts = keep; await this.save(df); }
    return n;
  }

  /** A renamed note keeps its drafts. */
  async rename(from: string, to: string): Promise<void> {
    const src = this.fileOf(from);
    const cached = this.cache.get(from);
    if (!cached && !(await this.adapter.exists(src))) return;
    const df = await this.load(from);
    this.cache.delete(from);
    df.path = to;
    await this.save(df);
    if (await this.adapter.exists(src)) await this.adapter.remove(src);
  }

  /** Forget cached files (after the folder setting changes). */
  clear(): void { this.cache.clear(); }
}
