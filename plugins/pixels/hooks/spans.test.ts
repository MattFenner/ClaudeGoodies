import { expect, test } from "claude-code/testing";

import { makeSpans, sinceLastPrompt } from "./spans";

import type { Event, PromptInfo, ToolCallInfo } from "../types";
import type { Logger } from "./log";
import type { ModelSpan, Span, ToolSpan, UserSpan } from "./spans";

const at = (s: number): string => new Date(Date.UTC(2026, 9, 13, 4, 0, s)).toISOString();
const ms = (s: number): number => Date.UTC(2026, 9, 13, 4, 0, s);

const logger: Logger = { logDebug: () => {} };
const spansOf = (
  events: Event[],
  toolCalls: Record<string, ToolCallInfo> = {},
  prompts: PromptInfo[] = [],
): Span[] => makeSpans({events, toolCalls, prompts}, logger);

const decision = (s: number, id: string, name = "Glob", decision = "accept"): Event => ({
  type: "tool_decision",
  timestamp: at(s),
  attributes: { tool_use_id: id, tool_name: name, decision },
});
const result = (s: number, id: string, durationMs: string, success = "true", name = "Glob"): Event => ({
  type: "tool_result",
  timestamp: at(s),
  attributes: { tool_use_id: id, tool_name: name, duration_ms: durationMs, success },
});

test("a tool_decision and tool_result make one tool span", () => {
  const spans = spansOf([decision(1, "t1"), result(5, "t1", "2000")]);
  expect(spans.length).toBe(1);
  expect(spans[0]).toMatchObject({
    kind: "tool",
    type: "tool_Glob",
    start: ms(1),
    end: ms(5),
    durationMs: 4000,
    success: true,
    toolUseId: "t1",
  });
  expect(spans[0]?.events.length).toBe(2);
});

test("a tool call with no result yet is an open span", () => {
  const [span] = spansOf([decision(1, "t1")]);
  expect(span?.end).toBeUndefined();
  expect(span?.durationMs).toBeUndefined();
  expect(span?.start).toBe(ms(1));
});

test("a rejected tool call is a closed, unsuccessful span", () => {
  const [span] = spansOf([decision(1, "t1", "Bash", "reject")]);
  expect(span).toMatchObject({ type: "tool_Bash", end: ms(1), durationMs: 0, success: false });
});

test("overlapping tool calls pair up by tool_use_id", () => {
  const spans = spansOf([
    decision(1, "a", "Read"),
    decision(1, "b", "Grep"),
    result(4, "b", "1000", "true", "Grep"),
    result(6, "a", "2000", "false", "Read"),
  ]);
  expect(spans.map((s) => [s.type, s.durationMs, (s as ToolSpan).success])).toEqual([
    ["tool_Read", 5000, false],
    ["tool_Grep", 3000, true],
  ]);
});

test("a tool_result with no decision still makes a span", () => {
  const spans = spansOf([result(5, "x", "500")]);
  expect(spans).toHaveLength(1);
  expect(spans[0]).toMatchObject({ start: ms(5) - 500, end: ms(5), durationMs: 500 });
});

test("an api_request is a span ending when it was logged", () => {
  const [span] = spansOf([
    { type: "api_request", timestamp: at(10), model: "claude-sonnet-5-5", attributes: { duration_ms: "2109" } },
  ]);
  expect(span).toMatchObject({ kind: "model", type: "api_request", start: ms(10) - 2109, end: ms(10), durationMs: 2109 });
});

test("any other event is an instant", () => {
  const [span] = spansOf([{ type: "user_prompt", timestamp: at(2), attributes: {} }]);
  expect(span).toMatchObject({ kind: "user", type: "user_prompt", start: ms(2), end: ms(2), durationMs: 0 });
});

test("spans stay in the order they began", () => {
  const spans = spansOf([
    { type: "user_prompt", timestamp: at(1), attributes: {} },
    decision(2, "t1"),
    { type: "assistant_response", timestamp: at(3), attributes: {} },
    result(4, "t1", "100"),
  ]);
  expect(spans.map((s) => s.type)).toEqual(["user_prompt", "tool_Glob", "assistant_response"]);
});

test("sinceLastPrompt starts at the most recent user_prompt, keeping it", () => {
  const spans = spansOf([
    { type: "user_prompt", timestamp: at(1), attributes: {} },
    { type: "api_request", timestamp: at(2), attributes: {} },
    { type: "user_prompt", timestamp: at(3), attributes: {} },
    { type: "assistant_response", timestamp: at(4), attributes: {} },
  ]);
  expect(sinceLastPrompt(spans).map((s) => s.type)).toEqual(["user_prompt", "assistant_response"]);
});

test("sinceLastPrompt returns everything when there has been no prompt", () => {
  const spans = spansOf([{ type: "api_request", timestamp: at(2), model: "claude-sonnet-5-5", attributes: {} }]);
  expect(sinceLastPrompt(spans)).toHaveLength(1);
});

test("what the tool.call hook saw is attached to the matching tool span", () => {
  const spans = spansOf([decision(1, "t1"), decision(2, "t2", "Bash"), result(3, "t1", "100")], {
    t1: { tool: "Glob", summary: "pattern: **/*" },
  });
  expect((spans[0] as ToolSpan).call).toEqual({ tool: "Glob", summary: "pattern: **/*" });
  expect((spans[1] as ToolSpan).call).toBeUndefined();
});

test("a user_prompt takes the text of the closest prompt.submit", () => {
  const spans = spansOf(
    [
      { type: "user_prompt", timestamp: at(10), attributes: {} },
      { type: "user_prompt", timestamp: at(60), attributes: {} },
    ],
    {},
    [
      { at: ms(59), text: "second" },
      { at: ms(11), text: "first" },
    ],
  );
  expect(spans.map((s) => (s as UserSpan).prompt)).toEqual(["first", "second"]);
});

test("a prompt too far from any submission stays without text", () => {
  const [span] = spansOf([{ type: "user_prompt", timestamp: at(10), attributes: {} }], {}, [{ at: ms(30), text: "late" }]);
  expect((span as UserSpan).prompt).toBeUndefined();
});

test("filters out events unrelated to conversation", () => {
  const call = (type: string, query_source: string, s: number): Event => ({ type, timestamp: at(s), model: "claude-sonnet-5-5", attributes: { query_source, duration_ms: "100" } });
  const spans = spansOf([
    call("api_request", "repl_main_thread", 1),
    call("api_request", "prompt_suggestion", 2),
    call("api_request", "away_summary", 3),
    call("api_request", "generate_session_title", 4),
    // a different model, so it does not merge with the main thread's calls
    { ...call("api_request", "agent:builtin:Explore", 5), model: "claude-haiku-5-5" },
    call("assistant_response", "repl_main_thread", 6),
  ]);
  expect(spans.map((s) => [s.type, s.events[0]?.attributes?.query_source])).toEqual([
    ["api_request", "repl_main_thread"],
    ["api_request", "agent:builtin:Explore"],
    ["assistant_response", "repl_main_thread"],
  ]);
});

test("events with no query_source are kept", () => {
  expect(spansOf([{ type: "user_prompt", timestamp: at(1), attributes: {} }, decision(2, "t1")])).toHaveLength(2);
});

const modelCall = (s: number, model: string, durationMs: string): Event => ({
  type: "api_request",
  timestamp: at(s),
  model,
  attributes: { duration_ms: durationMs },
});

test("adjacent model calls for the same model merge, spanning from the first start to the last end", () => {
  const spans = spansOf([modelCall(2, "claude-sonnet-5-5", "2000"), modelCall(6, "claude-sonnet-5-5", "3000")]);
  expect(spans).toHaveLength(1);
  expect(spans[0]).toMatchObject({ kind: "model", start: ms(0), end: ms(6), durationMs: 6000, count: 2 });
  expect(spans[0]?.events).toHaveLength(2);
});

test("model calls for different models do not merge, each with a count of one", () => {
  const spans = spansOf([modelCall(2, "claude-sonnet-5-5", "100"), modelCall(3, "claude-haiku-5-5", "100")]);
  expect(spans.map((s) => [s.kind, (s as ModelSpan).model, (s as ModelSpan).count])).toEqual([
    ["model", "claude-sonnet-5-5", 1],
    ["model", "claude-haiku-5-5", 1],
  ]);
});

test("a span of another kind between two model calls keeps them apart", () => {
  const spans = spansOf([modelCall(2, "claude-sonnet-5-5", "100"), decision(3, "t1"), result(4, "t1", "100"), modelCall(5, "claude-sonnet-5-5", "100")]);
  expect(spans.map((s) => [s.kind, (s as ModelSpan).count])).toEqual([
    ["model", 1],
    ["tool", undefined],
    ["model", 1],
  ]);
});

test("adjacent harness events of the same kind merge", () => {
  const spans = spansOf([
    { type: "assistant_response", timestamp: at(1), attributes: {} },
    { type: "assistant_response", timestamp: at(2), attributes: {} },
    { type: "assistant_response", timestamp: at(3), attributes: {} },
  ]);
  expect(spans).toHaveLength(1);
  expect(spans[0]).toMatchObject({ kind: "harnessevent", eventKind: "assistant_response", start: ms(1), end: ms(3), count: 3 });
});

test("adjacent user and tool spans never merge", () => {
  const spans = spansOf([
    { type: "user_prompt", timestamp: at(1), attributes: {} },
    { type: "user_prompt", timestamp: at(2), attributes: {} },
    decision(3, "t1"),
    result(4, "t1", "100"),
    decision(5, "t2"),
    result(6, "t2", "100"),
  ]);
  expect(spans.map((s) => s.type)).toEqual(["user_prompt", "user_prompt", "tool_Glob", "tool_Glob"]);
});
