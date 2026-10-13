import type { Event } from "../types";

export const LOG_DIR = "logs";
const MAX_LOG_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// One JSON object per line.
export function toJsonl(events: Event[]): string {
  return events
    .map((ev) => JSON.stringify(ev))
    .join("\n") + "\n";
}

type DirEntry = { name: string; kind: string; mtimeMs: number };

// The log files in `dir` that are older than a week, never `keep` (this session's).
export function staleLogs(entries: readonly DirEntry[], dir: string, keep: string, now: number): string[] {
  const cutoff = now - MAX_LOG_AGE_MS;
  return entries
    .filter(({ name, kind, mtimeMs }) => kind === "file" && name.endsWith(".jsonl") && mtimeMs < cutoff)
    .map(({ name }) => `${dir}/${name}`)
    .filter((path) => path !== keep);
}
