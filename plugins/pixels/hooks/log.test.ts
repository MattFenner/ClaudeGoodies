import { expect, test } from "claude-code/testing";

import { staleLogs, toJsonl } from "./log";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 13);

test("toJsonl writes one line per event", () => {
  const out = toJsonl([{ type: "a", attributes: { n: 1 } }, { type: "b" }]);
  expect(out.split("\n")).toEqual(['{"type":"a","attributes":{"n":1}}', '{"type":"b"}', ""]);
});

test("staleLogs picks only .jsonl files older than 7 days, never the kept one", () => {
  const entries = [
    { name: "old.jsonl", kind: "file", mtimeMs: now - 8 * DAY },
    { name: "recent.jsonl", kind: "file", mtimeMs: now - 6 * DAY },
    { name: "mine.jsonl", kind: "file", mtimeMs: now - 9 * DAY },
    { name: "notes.txt", kind: "file", mtimeMs: now - 9 * DAY },
    { name: "old.jsonl.d", kind: "directory", mtimeMs: now - 9 * DAY },
  ];
  expect(staleLogs(entries, "logs", "logs/mine.jsonl", now)).toEqual(["logs/old.jsonl"]);
});
