import { expect, test } from "claude-code/testing";
import type { TelemetryRecordEntry } from "claude-code";

import { COLOR_NONE, styleOf } from "./spanStyle";
import { normalizeEvent } from "./events";

import { agentSpan, harnessEventSpan, modelSpan, toolSpan, userSpan } from "./spanFixtures";

// Entries as telemetry.log delivers them (trimmed to the fields that matter;
// the pasted samples had corrupted keys, e.g. a bare "qad" and a mangled
// "terminal.typ", so these are cleaned-up versions).
const apiRequest = {
  to: "collector",
  event: "api_request",
  attributes: {
    "event.name": "api_request",
    "event.sequence": 102,
    model: "claude-sonnet-5-5",
    input_tokens: 2,
    output_tokens: 179,
    duration_ms: 2109,
    speed: "normal",
    effort: "medium",
  },
  loggedAt: "2026-10-13T04:24:15.567Z",
} as TelemetryRecordEntry;

const assistantResponse = {
  to: "collector",
  event: "assistant_response",
  attributes: {
    "event.name": "assistant_response",
    "event.sequence": 103,
    response_length: 491,
    response: "<REDACTED>",
    model: "claude-sonnet-5-5",
    query_source: "repl_main_thread",
  },
  loggedAt: "2026-10-13T04:24:15.567Z",
} as TelemetryRecordEntry;

test("normalizeEvent keeps the type, timestamp and attributes", () => {
  expect(normalizeEvent(apiRequest)).toEqual({
    type: "api_request",
    timestamp: "2026-10-13T04:24:15.567Z",
    attributes: apiRequest.attributes,
  });
});

test("normalizeEvent drops the attributes that identify the user or session", () => {
  const identifying: Record<string, string> = {
    "user.email": "someone@example.com",
    "user.account_uuid": "def",
    "session.id": "ghi",
    "organization.id": "jkl",
  };
  const { attributes } = normalizeEvent({
    ...apiRequest,
    attributes: { ...apiRequest.attributes, ...identifying },
  });
  expect(attributes).toEqual(apiRequest.attributes);
});

const BLACK = 0x000000;

test("an api_request entry is black on grey", () => {
  expect(styleOf(modelSpan({ type: normalizeEvent(apiRequest).type }))).toEqual({
    foreground: BLACK,
    background: 0xbebebe,
  });
});

test("an assistant_response entry is black on light blue", () => {
  expect(styleOf(harnessEventSpan({ type: normalizeEvent(assistantResponse).type, eventKind: "assistant_response" }))).toEqual({
    foreground: BLACK,
    background: 0x6CB6C4,
  });
});

test("user_input is black on the default background", () => {
  expect(styleOf(userSpan({ type: "user_input" }))).toEqual({ foreground: BLACK, background: COLOR_NONE });
});

test("tool_ events are black on olive", () => {
  expect(styleOf(toolSpan({ type: "tool_call" }))).toEqual({ foreground: BLACK, background: 0xadbb6d });
});

test("mcp_ events are black on green", () => {
  expect(styleOf(toolSpan({ type: "mcp_request", toolKind: "mcp" }))).toEqual({ foreground: BLACK, background: 0xa6cf7f });
});

test("user_prompt is black on the default background", () => {
  expect(styleOf(userSpan({ type: "user_prompt" }))).toEqual({ foreground: BLACK, background: COLOR_NONE });
});

test("agent spans are black on purple", () => {
  expect(styleOf(agentSpan({ type: "subagent_completed" }))).toEqual({ foreground: BLACK, background: 0x9c5cac });
});
