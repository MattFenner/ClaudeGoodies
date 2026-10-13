import { expect, test } from "claude-code/testing";

import { COLOR_NONE, gridOf, spanToCellCount, type Cell } from "./grid";

import type { Span } from "./spans";

const span = (type: string, durationMs?: number): Span => ({
  kind: "other",
  type,
  start: 0,
  durationMs,
  events: [],
});

const chars = (spans: Span[], columns: number) => gridOf(spans, columns)[0]!.map((c: Cell) => c.char).join("");

test("a span takes one cell per second, rounded", () => {
  expect(spanToCellCount({ durationMs: 3000 })).toBe(3);
  expect(spanToCellCount({ durationMs: 2400 })).toBe(2);
  expect(spanToCellCount({ durationMs: 2600 })).toBe(3);
});

test("a span always takes at least one cell", () => {
  expect(spanToCellCount({ durationMs: 0 })).toBe(1);
  expect(spanToCellCount({ durationMs: 40 })).toBe(1);
  expect(spanToCellCount({ durationMs: undefined })).toBe(1);
});

test("a span under five seconds shows blank cells", () => {
  expect(chars([span("tool_Glob", 3000)], 6)).toBe("      ");
});

test("a tool call of four seconds or more shows its summary", () => {
  const tool: Span = { ...span("tool_Bash", 6000), kind: "tool", call: { tool: "Bash", summary: "ls" } };
  expect(chars([tool], 6)).toBe("ls    ");
});

test("other long spans show blank cells", () => {
  expect(chars([span("tool_Glob", 6000)], 6)).toBe("      ");
});

test("user_prompt never shows text", () => {
  expect(chars([span("user_prompt", 9000)], 9)).toBe("         ");
});

test("each span styles its own cells", () => {
  const row = gridOf([span("tool_Glob", 1000), span("api_request", 1000)], 3)[0]!;
  expect(row[0]!.background).toBe(0xaaaaff);
  expect(row[1]!.background).toBe(0xffaaff);
  expect(row[2]!).toEqual({ char: " ", foreground: COLOR_NONE, background: COLOR_NONE });
});

test("a row too long for the width keeps the most recent cells", () => {
  const cells = gridOf([span("tool_Glob", 5000), span("api_request", 1000)], 4)[0]!;
  expect(cells.length).toBe(4);
  expect(cells.map((c: Cell) => c.background)).toEqual([0xaaaaff, 0xaaaaff, 0xaaaaff, 0xffaaff]);
});
