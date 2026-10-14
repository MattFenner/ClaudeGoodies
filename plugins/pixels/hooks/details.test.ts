import { expect, test } from "claude-code/testing";

import { spanRow, spanRows } from "./details";

import type { Span } from "./spans";

const start = Date.UTC(2026, 9, 13, 4, 5, 6);
const span = (over: Partial<Span>): Span =>
  ({
    kind: "other",
    type: "api_request",
    start,
    end: start,
    durationMs: 0,
    events: [],
    ...over,
  }) as Span;

test("a finished tool call shows its name, time, duration and ok", () => {
  expect(
    spanRow(
      span({
        kind: "tool",
        type: "tool_Glob",
        end: start + 2400,
        durationMs: 2400,
        success: true,
      }),
    ),
  ).toEqual({
    time: "04:05:06",
    label: "Glob",
    duration: "2.4s",
    status: "ok",
    details: [],
  });
});

test("durations under a second are in ms", () => {
  expect(
    spanRow(
      span({
        kind: "tool",
        type: "tool_Read",
        end: start,
        durationMs: 68,
        success: true,
      }),
    ).duration,
  ).toBe("68ms");
});

test("a failed tool call says failed", () => {
  expect(
    spanRow(
      span({ kind: "tool", type: "tool_Bash", durationMs: 10, success: false }),
    ).status,
  ).toBe("failed");
});

test("an open tool call says running with no duration yet", () => {
  const row = spanRow(
    span({
      kind: "tool",
      type: "tool_Bash",
      end: undefined,
      durationMs: undefined,
    }),
  );
  expect(row).toMatchObject({ status: "running", duration: "…" });
});

test("an api request keeps its type and shows a duration but no status", () => {
  expect(
    spanRow(span({ kind: "other", type: "api_request", durationMs: 2109 })),
  ).toMatchObject({
    label: "api_request",
    duration: "2.1s",
    status: "",
  });
});

test("an instant shows no duration or status", () => {
  expect(spanRow(span({ kind: "user", type: "user_prompt" }))).toMatchObject({
    label: "user_prompt",
    duration: "",
    status: "",
  });
});

const withAttrs = (
  type: string,
  attributes: Record<string, unknown>,
  over: Partial<Span> = {},
): Span => span({ type, events: [{ type, attributes }], ...over });

test("a tool call hides its sizes, the builtin source and an accepted decision", () => {
  const s = span({
    kind: "tool",
    type: "tool_Glob",
    events: [
      {
        type: "tool_decision",
        attributes: {
          decision: "accept",
          source: "config",
          tool_source: "builtin",
        },
      },
      {
        type: "tool_result",
        attributes: {
          tool_input_size_bytes: "18",
          tool_result_size_bytes: "325",
        },
      },
    ],
  });
  expect(spanRow(s).details).toEqual([]);
});

test("a span with nothing worth showing has no detail lines", () => {
  expect(spanRow(span({})).details).toEqual([]);
});

test("what the tool.call hook saw leads the detail lines", () => {
  const s = span({
    kind: "tool",
    type: "tool_Bash",
    call: {
      tool: "Bash",
      summary: "command: git status",
      agentId: "ag1",
      outcome: "ok",
      isReadOnly: true,
    },
    events: [{ type: "tool_decision", attributes: { tool_source: "builtin" } }],
  });
  expect(spanRow(s).details).toEqual([
    "command: git status",
    "in subagent ag1",
    "read-only",
  ]);
});

test("a denied call shows why", () => {
  const s = span({
    kind: "tool",
    type: "tool_Bash",
    call: { tool: "Bash", outcome: "denied", deniedBecause: "blocked by rule" },
  });
  expect(spanRow(s).details).toEqual(["denied: blocked by rule"]);
});

test("spanRows with no limit lists every span, oldest first", () => {
  const spans = ["a", "b", "c", "d"].map((type) =>
    withAttrs(type, { model: "m" }),
  );
  expect(spanRows(spans).map((r) => r.label)).toEqual(["a", "b", "c", "d"]);
});

test("a user prompt does not add detail lines from its prompt text because it's in the title", () => {
  const s = span({
    kind: "user",
    prompt: "fix the bug",
    events: [{ type: "user_prompt", attributes: { prompt: "event prompt" } }],
  });
  expect(spanRow(s).details).toEqual([]);
});

test("event attributes do not become detail lines", () => {
  const row = spanRow(
    withAttrs(
      "api_request",
      { model: "m", query_source: "repl_main_thread", ttft_ms: "706" },
      { kind: "other" },
    ),
  );
  expect(row.details).toEqual([]);
});

test("tool event attributes do not become detail lines", () => {
  expect(
    spanRow(
      withAttrs(
        "tool_decision",
        { tool_source: "mcp" },
        { kind: "tool", type: "tool_x" },
      ),
    ).details,
  ).toEqual([]);
});

test("decision event attributes do not become detail lines", () => {
  const detailsOf = (attrs: Record<string, unknown>): string[] =>
    spanRow(withAttrs("tool_decision", attrs, { kind: "tool", type: "tool_x" }))
      .details;
  expect(detailsOf({ decision: "reject", source: "user" })).toEqual([]);
  expect(detailsOf({ decision: "reject" })).toEqual([]);
  expect(detailsOf({ decision: "accept", source: "config" })).toEqual([]);
});

test("skill event attributes do not become detail lines", () => {
  expect(
    spanRow(
      withAttrs("skill_activated", {
        "skill.name": "plugin-authoring",
        "skill.source": "bundled",
      }),
    ).details,
  ).toEqual([]);
});

test("an assistant response shows its model and not its length", () => {
  expect(
    spanRow(
      withAttrs(
        "assistant_response",
        { model: "event-model", response_length: "28" },
        { model: "claude-sonnet-5-5" },
      ),
    ).details,
  ).toEqual(["claude-sonnet-5-5"]);
});

test("a subagent span shows its model but ignores event attributes", () => {
  const row = spanRow(
    withAttrs(
      "subagent_completed",
      {
        agent_type: "Explore",
        model: "event-model",
        total_tokens: "19884",
        total_tool_uses: "3",
      },
      { model: "m" },
    ),
  );
  expect(row.details).toEqual(["m"]);
});

test("an mcp connection ignores event attributes", () => {
  expect(
    spanRow(
      withAttrs("mcp_server_connection", {
        status: "connected",
        transport_type: "http",
      }),
    ).details,
  ).toEqual([]);
});

test("api_request label shows model", () => {
  const s = span({ kind: "model", model: "haiku" });
  const row = spanRow(s);
  expect(row.label).toContain("haiku");
});
