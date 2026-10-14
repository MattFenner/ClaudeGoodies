import { expect, test } from "claude-code/testing";

import { gridOf, spanToCellCount, type Cell } from "./grid";
import { COLOR_NONE } from "./spanStyle";

import type { Span, ToolSpan } from "./spans";
import { modelSpan, toolSpan, userSpan } from "./spanFixtures";

const chars = (spans: Span[], columns: number): string => gridOf(spans, columns)[0]!.map((c: Cell) => c.char).join("");

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
  expect(chars([toolSpan({ type: "tool_Glob", durationMs: 3000 })], 6)).toBe("      ");
});

test("long model calls show blank cells", () => {
  expect(chars([modelSpan({ type: "api_request", durationMs: 6000 })], 6)).toBe("      ");
});

test("user_prompt never shows text", () => {
  expect(chars([userSpan({ type: "user_prompt", durationMs: 9000 })], 9)).toBe("         ");
});

test("each span styles its own cells", () => {
  const row = gridOf([toolSpan({ type: "tool_Glob", durationMs: 1000 }), modelSpan({ type: "api_request", durationMs: 1000 })], 3)[0]!;
  expect(row[0]!.background).toBe(0xBB9C6D);
  expect(row[1]!.background).toBe(0xbebebe);
  expect(row[2]!).toEqual({ char: " ", foreground: COLOR_NONE, background: COLOR_NONE });
});

test("a row too long for the width keeps the most recent cells", () => {
  const cells = gridOf([toolSpan({ type: "tool_Glob", durationMs: 5000 }), modelSpan({ type: "api_request", durationMs: 1000 })], 4)[0]!;
  expect(cells.length).toBe(4);
  expect(cells.map((c: Cell) => c.background)).toEqual([0xBB9C6D, 0xBB9C6D, 0xBB9C6D, 0xbebebe]);
});
