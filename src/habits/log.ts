import type { DailyEntry, DailyLog } from "../constants";

/* ======================================================================
   WRITING HISTORY — pure functions over the daily log:
   daily[YYYY-MM-DD][notePath] = { s: words at the first visit that day, l: latest count }.
   "Words written" counts what each note grew by (deletions don't subtract from a day's work).
   ====================================================================== */

/** How many days of history are kept. */
export const HISTORY_DAYS = 400;

export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** Words written in one note on one day. */
export const grew = (e: DailyEntry): number => Math.max(0, e.l - e.s);

/** Words written on a day, across all notes. */
export function writtenOn(log: DailyLog, key: string): number {
  const day = log[key];
  if (!day) return 0;
  let t = 0;
  for (const e of Object.values(day)) t += grew(e);
  return t;
}

/** The last `n` day keys, oldest first, ending today. */
export function lastDays(today: string, n: number): string[] {
  const out: string[] = [];
  for (let k = n - 1; k >= 0; k--) out.push(addDays(today, -k));
  return out;
}

/** Drop days older than the history window. Returns true when something was removed. */
export function prune(log: DailyLog, today: string, keep = HISTORY_DAYS): boolean {
  const oldest = addDays(today, -keep);
  let changed = false;
  for (const k of Object.keys(log)) if (k < oldest) { delete log[k]; changed = true; }
  return changed;
}

/** Move a note's history to its new path after a rename. */
export function renamePath(log: DailyLog, from: string, to: string): boolean {
  let changed = false;
  for (const day of Object.values(log)) {
    if (day[from]) { day[to] = day[from]; delete day[from]; changed = true; }
  }
  return changed;
}

/**
 * Current and best streak: consecutive days that reach the daily goal (any writing when there's no goal).
 * Today only extends the streak once it's reached; not having written yet today doesn't break it.
 */
export function streaks(log: DailyLog, today: string, goal: number): { current: number; best: number; todayDone: boolean } {
  const target = Math.max(1, goal);
  const ok = (k: string) => writtenOn(log, k) >= target;
  const keys = Object.keys(log).sort();
  let best = 0, run = 0, prev = "";
  for (const k of keys) {
    if (!ok(k)) { run = 0; prev = k; continue; }
    run = prev && addDays(prev, 1) === k && run > 0 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  const todayDone = ok(today);
  let current = 0;
  for (let k = todayDone ? today : addDays(today, -1); ok(k); k = addDays(k, -1)) current++;
  return { current, best: Math.max(best, current), todayDone };
}

/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();   // 0 = Sunday
  return addDays(key, -((day + 6) % 7));
}

export interface Totals { today: number; week: number; month: number; last30: number; all: number; days: number }

export function totals(log: DailyLog, today: string): Totals {
  const ws = weekStart(today), ms = today.slice(0, 8) + "01", d30 = addDays(today, -29);
  const t: Totals = { today: 0, week: 0, month: 0, last30: 0, all: 0, days: 0 };
  for (const k of Object.keys(log)) {
    const w = writtenOn(log, k);
    if (w > 0) t.days++;
    t.all += w;
    if (k === today) t.today += w;
    if (k >= ws && k <= today) t.week += w;
    if (k >= ms && k <= today) t.month += w;
    if (k >= d30 && k <= today) t.last30 += w;
  }
  return t;
}

/** Words written per group (genre, form, project) between two days, inclusive. A note in two groups counts for both. */
export function wordsByGroup(log: DailyLog, from: string, to: string, groupsOf: (path: string) => string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const [k, day] of Object.entries(log)) {
    if (k < from || k > to) continue;
    for (const [path, e] of Object.entries(day)) {
      const w = grew(e);
      if (!w) continue;
      for (const g of groupsOf(path)) out.set(g, (out.get(g) ?? 0) + w);
    }
  }
  return out;
}

/** Words written per day over a range, grouped by week when `weekly`. */
export function series(log: DailyLog, today: string, days: number, weekly: boolean): { label: string; key: string; words: number }[] {
  const keys = lastDays(today, days);
  if (!weekly) return keys.map((k) => ({ key: k, label: k.slice(5), words: writtenOn(log, k) }));
  const weeks = new Map<string, number>();
  for (const k of keys) { const w = weekStart(k); weeks.set(w, (weeks.get(w) ?? 0) + writtenOn(log, k)); }
  return [...weeks.entries()].map(([k, w]) => ({ key: k, label: k.slice(5), words: w }));
}
