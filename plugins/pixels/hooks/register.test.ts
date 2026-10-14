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

test("normalizeEvent keeps the important fields", () => {
  expect(normalizeEvent(apiRequest)).toEqual({
    type: "api_request",
    timestamp: "2026-10-13T04:24:15.567Z",
    model: "claude-sonnet-5-5",
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

test("an api_request entry is grey", () => {
  expect(styleOf(modelSpan({ type: normalizeEvent(apiRequest).type }))).toEqual({ color: 0xbebebe });
});

test("an assistant_response entry is white", () => {
  expect(styleOf(harnessEventSpan({ type: normalizeEvent(assistantResponse).type, eventKind: "assistant_response" }))).toEqual({ color: 0xffffff });
});

test("user_input has the default color", () => {
  expect(styleOf(userSpan({ type: "user_input" }))).toEqual({ color: COLOR_NONE });
});

test("tool_ events take the tool color", () => {
  expect(styleOf(toolSpan({ type: "tool_call" }))).toEqual({ color: 0xBB9C6D });
});

test("mcp_ events take the mcp color", () => {
  expect(styleOf(toolSpan({ type: "mcp_request", toolKind: "mcp" }))).toEqual({ color: 0xC3CF7F });
});

test("user_prompt has the default color", () => {
  expect(styleOf(userSpan({ type: "user_prompt" }))).toEqual({ color: COLOR_NONE });
});

test("agent spans take the agent color", () => {
  expect(styleOf(agentSpan({ type: "subagent_completed" }))).toEqual({ color: 0x9c5cac });
});
