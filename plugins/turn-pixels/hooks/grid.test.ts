import { expect, test } from "claude-code/testing";

import { cellsFor, gridOf } from "./grid";

import type { Span } from "./spans";

const span = (type: string, durationMs?: number): Span => ({
  kind: "instant",
  type,
  start: 0,
  durationMs,
  events: [],
});

const chars = (spans: Span[], columns: number) => gridOf(spans, columns)[0].map((c) => c.char).join("");

test("a span takes one cell per second, rounded", () => {
  expect(cellsFor({ durationMs: 3000 })).toBe(3);
  expect(cellsFor({ durationMs: 2400 })).toBe(2);
  expect(cellsFor({ durationMs: 2600 })).toBe(3);
});

test("a span always takes at least one cell", () => {
  expect(cellsFor({ durationMs: 0 })).toBe(1);
  expect(cellsFor({ durationMs: 40 })).toBe(1);
  expect(cellsFor({ durationMs: undefined })).toBe(1);
});

test("a long span shows its letter then spaces", () => {
  expect(chars([span("tool_Glob", 3000)], 6)).toBe("G     ");
});

test("a span that repeats the one before shows only spaces", () => {
  expect(chars([span("tool_Glob", 1000), span("tool_Grep", 1000)], 3)).toBe("G  ");
});

test("different spans each show their letter", () => {
  expect(chars([span("tool_Glob", 1000), span("api_request", 1000)], 3)).toBe("Ga ");
});

test("a row too long for the width keeps the most recent cells", () => {
  const cells = gridOf([span("tool_Glob", 5000), span("api_request", 1000)], 4)[0];
  expect(cells.length).toBe(4);
  expect(cells.map((c) => c.char).join("")).toBe("   a");
});
