import { expect, test } from "claude-code/testing";

import { spanRow, spanRows } from "./details";

import type { Span } from "./spans";

const start = Date.UTC(2026, 9, 13, 4, 5, 6);
const span = (over: Partial<Span>): Span => ({
  kind: "instant",
  type: "user_prompt",
  start,
  end: start,
  durationMs: 0,
  events: [],
  ...over,
});

test("a finished tool call shows its name, time, duration and ok", () => {
  expect(spanRow(span({ kind: "tool", type: "tool_Glob", end: start + 2400, durationMs: 2400, success: true }))).toEqual({
    time: "04:05:06",
    label: "Glob",
    duration: "2.4s",
    status: "ok",
    details: [],
  });
});

test("durations under a second are in ms", () => {
  expect(spanRow(span({ kind: "tool", type: "tool_Read", end: start, durationMs: 68, success: true })).duration).toBe("68ms");
});

test("a failed tool call says failed", () => {
  expect(spanRow(span({ kind: "tool", type: "tool_Bash", durationMs: 10, success: false })).status).toBe("failed");
});

test("an open tool call says running with no duration yet", () => {
  const row = spanRow(span({ kind: "tool", type: "tool_Bash", end: undefined, durationMs: undefined }));
  expect(row).toMatchObject({ status: "running", duration: "…" });
});

test("an api request keeps its type and shows a duration but no status", () => {
  expect(spanRow(span({ kind: "api", type: "api_request", durationMs: 2109 }))).toMatchObject({
    label: "api_request",
    duration: "2.1s",
    status: "",
  });
});

test("an instant shows no duration or status", () => {
  expect(spanRow(span({}))).toMatchObject({ label: "user_prompt", duration: "", status: "" });
});

test("spanRows keeps the newest rows that fit, oldest first", () => {
  const spans = ["a", "b", "c", "d"].map((type) => span({ type }));
  expect(spanRows(spans, 2).map((r) => r.label)).toEqual(["c", "d"]);
});

const withAttrs = (type: string, attributes: Record<string, unknown>, over: Partial<Span> = {}): Span =>
  span({ type, events: [{ type, attributes }], ...over });

test("an api request lists its model, tokens, cost and a non-main source", () => {
  const row = spanRow(
    withAttrs("api_request", {
      model: "claude-haiku-5-5",
      input_tokens: "1164",
      output_tokens: "13",
      ttft_ms: "706",
      cost_usd: "0.0001229",
      query_source: "generate_session_title",
    }, { kind: "api", durationMs: 963 }),
  );
  expect(row.details).toEqual([
    "claude-haiku-5-5",
    "tokens 1164 in, 13 out",
    "cost $0.0001",
    "from generate_session_title",
  ]);
});

test("a tool call hides its sizes, the builtin source and an accepted decision", () => {
  const s = span({
    kind: "tool",
    type: "tool_Glob",
    events: [
      { type: "tool_decision", attributes: { decision: "accept", source: "config", tool_source: "builtin" } },
      { type: "tool_result", attributes: { tool_input_size_bytes: "18", tool_result_size_bytes: "325" } },
    ],
  });
  expect(spanRow(s).details).toEqual([]);
});

test("a span with nothing worth showing has no detail lines", () => {
  expect(spanRow(span({})).details).toEqual([]);
});

test("spanRows counts detail lines against the room it has", () => {
  const spans = [
    withAttrs("old", { model: "m" }),
    withAttrs("mid", { model: "m", from: 1, query_source: "q" }),
    withAttrs("new", { model: "m" }),
  ];
  // new takes 2 lines, mid takes 3: only new fits in 4
  expect(spanRows(spans, 4).map((r) => r.label)).toEqual(["new"]);
  // and at least one row is shown however little room there is
  expect(spanRows(spans, 1).map((r) => r.label)).toEqual(["new"]);
});

test("what the tool.call hook saw leads the detail lines", () => {
  const s = span({
    kind: "tool",
    type: "tool_Bash",
    call: { tool: "Bash", summary: "command: git status", agentId: "ag1", outcome: "ok", isReadOnly: true },
    events: [{ type: "tool_decision", attributes: { tool_source: "builtin" } }],
  });
  expect(spanRow(s).details).toEqual(["command: git status", "in subagent ag1", "read-only"]);
});

test("a denied call shows why", () => {
  const s = span({ kind: "tool", type: "tool_Bash", call: { tool: "Bash", outcome: "denied", deniedBecause: "blocked by rule" } });
  expect(spanRow(s).details).toEqual(["denied: blocked by rule"]);
});

test("spanRows with no limit lists every span, oldest first", () => {
  const spans = ["a", "b", "c", "d"].map((type) => withAttrs(type, { model: "m" }));
  expect(spanRows(spans).map((r) => r.label)).toEqual(["a", "b", "c", "d"]);
});

test("a user prompt shows its text and not its length", () => {
  const s = span({ prompt: "fix the bug", events: [{ type: "user_prompt", attributes: { prompt_length: "11" } }] });
  expect(spanRow(s).details).toEqual(["fix the bug"]);
});

test("a main-thread api request hides its source, and the first-token time is never shown", () => {
  const row = spanRow(withAttrs("api_request", { model: "m", query_source: "repl_main_thread", ttft_ms: "706" }, { kind: "api" }));
  expect(row.details).toEqual(["m"]);
});

test("a tool from somewhere other than the builtins shows its source", () => {
  expect(spanRow(withAttrs("tool_decision", { tool_source: "mcp" }, { kind: "tool", type: "tool_x" })).details).toEqual(["tool source mcp"]);
});

test("a refused decision shows who made it, an accepted one shows nothing", () => {
  const detailsOf = (attrs: Record<string, unknown>) => spanRow(withAttrs("tool_decision", attrs, { kind: "tool", type: "tool_x" })).details;
  expect(detailsOf({ decision: "reject", source: "user" })).toEqual(["decision reject (user)"]);
  expect(detailsOf({ decision: "reject" })).toEqual(["decision reject"]);
  expect(detailsOf({ decision: "accept", source: "config" })).toEqual([]);
});

test("a skill activation shows as a slash command", () => {
  expect(spanRow(withAttrs("skill_activated", { "skill.name": "plugin-authoring", "skill.source": "bundled" })).details).toEqual(["/plugin-authoring"]);
});

test("an assistant response shows its model and not its length", () => {
  expect(spanRow(withAttrs("assistant_response", { model: "claude-sonnet-5-5", response_length: "28" })).details).toEqual(["claude-sonnet-5-5"]);
});

test("a subagent shows its type, model and totals", () => {
  const row = spanRow(withAttrs("subagent_completed", { agent_type: "Explore", model: "m", total_tokens: "19884", total_tool_uses: "3" }));
  expect(row.details).toEqual(["m", "agent Explore", "tokens 19884, 3 tool uses"]);
});

test("an mcp connection shows its status and transport", () => {
  expect(spanRow(withAttrs("mcp_server_connection", { status: "connected", transport_type: "http" })).details).toEqual(["connected over http"]);
});
