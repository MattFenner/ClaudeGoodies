import { expect, test } from "claude-code/testing";

import { COLOR_NONE, spanToCellStyle } from "./grid";
import { normalizeEvent } from "./events";

import type { Span } from "./spans";

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
} as any;

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
} as any;

test("normalizeEvent keeps the type, timestamp and attributes", () => {
  expect(normalizeEvent(apiRequest)).toEqual({
    type: "api_request",
    timestamp: "2026-10-13T04:24:15.567Z",
    attributes: apiRequest.attributes,
  });
});

test("normalizeEvent drops the attributes that identify the user or session", () => {
  const identifying = {
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

const span = (type: string): Span => ({ kind: "other", type, start: 0, events: [] });

const BLACK = 0x000000;

test("an api_request entry is black on magenta", () => {
  expect(spanToCellStyle(span(normalizeEvent(apiRequest).type))).toEqual({
    foreground: BLACK,
    background: 0xffaaff,
  });
});

test("an assistant_response entry is white on dark grey", () => {
  expect(spanToCellStyle(span(normalizeEvent(assistantResponse).type))).toEqual({
    foreground: 0xffffff,
    background: 0x111111,
  });
});

test("user_input is black on white", () => {
  expect(spanToCellStyle(span("user_input"))).toEqual({ foreground: BLACK, background: 0xffffff });
});

test("tool_ events are black on blue", () => {
  expect(spanToCellStyle(span("tool_call"))).toEqual({ foreground: BLACK, background: 0xaaaaff });
});

test("mcp_ events are black on green", () => {
  expect(spanToCellStyle(span("mcp_request"))).toEqual({ foreground: BLACK, background: 0xaaffaa });
});

test("user_prompt is black on the default background", () => {
  expect(spanToCellStyle(span("user_prompt"))).toEqual({ foreground: BLACK, background: COLOR_NONE });
});

test("other events are black on magenta", () => {
  expect(spanToCellStyle(span("Tool_result"))).toEqual({ foreground: BLACK, background: 0xffaaff });
  expect(spanToCellStyle(span(""))).toEqual({ foreground: BLACK, background: 0xffaaff });
});
