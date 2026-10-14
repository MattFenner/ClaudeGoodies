import type { UiLogOptions } from "claude-code";

export const LOG_DIR = "logs";
const MAX_LOG_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type Logger = {
  logDebug(text: string, options?: UiLogOptions): void;
};

export function toJsonl(things: unknown[] | Record<string, unknown>): string {
  if (Array.isArray(things)) {
    return things.map((ev) => JSON.stringify(ev)).join("\n") + "\n";
  } else {
    return toJsonl(Object.values(things));
  }
}

type DirEntry = { name: string; kind: string; mtimeMs: number };

// The log files in `dir` that are older than a week, never `keep` (this session's).
export function staleLogs(
  entries: readonly DirEntry[],
  dir: string,
  keep: string,
  now: number,
): string[] {
  const cutoff = now - MAX_LOG_AGE_MS;
  return entries
    .filter(
      ({ name, kind, mtimeMs }) =>
        kind === "file" && name.endsWith(".jsonl") && mtimeMs < cutoff,
    )
    .map(({ name }) => `${dir}/${name}`)
    .filter((path) => path !== keep);
}
