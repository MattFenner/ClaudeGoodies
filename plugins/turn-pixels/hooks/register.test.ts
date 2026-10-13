import { expect, test } from "claude-code/testing";

import { spanToCell } from "./grid";
import { normalizeEvent } from "./events";

const COLOR_NONE = 0x01000000;

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

test("an api_request entry draws a magenta 'a' cell", () => {
  expect(spanToCell(normalizeEvent(apiRequest))).toEqual({
    char: "a",
    color: 0x000000,
    background: 0xffaaff,
  });
});

test("an assistant_response entry draws a white 'R' on dark grey", () => {
  expect(spanToCell(normalizeEvent(assistantResponse))).toEqual({
    char: "R",
    color: 0xffffff,
    background: 0x111111,
  });
});

test("assistant_response is a white 'R' on dark grey", () => {
  expect(spanToCell({ type: "assistant_response" })).toEqual({
    char: "R",
    color: 0xffffff,
    background: 0x111111,
  });
});

test("user_input is a black 'I' on white", () => {
  expect(spanToCell({ type: "user_input" })).toEqual({
    char: "I",
    color: 0x000000,
    background: 0xffffff,
  });
});

test("tool_ events are blue with the capitalised first letter after the prefix", () => {
  expect(spanToCell({ type: "tool_call" })).toEqual({
    char: "C",
    color: 0x000000,
    background: 0xaaaaff,
  });
});

test("mcp_ events are green with the capitalised first letter after the prefix", () => {
  expect(spanToCell({ type: "mcp_request" })).toEqual({
    char: "R",
    color: 0x000000,
    background: 0xaaffaa,
  });
});

test("user_prompt is a blank cell on the default background", () => {
  expect(spanToCell({ type: "user_prompt" })).toEqual({
    char: " ",
    color: 0x000000,
    background: COLOR_NONE,
  });
});

test("other events show their lowercased first letter on magenta", () => {
  expect(spanToCell({ type: "Tool_result" })).toEqual({
    char: "t",
    color: 0x000000,
    background: 0xffaaff,
  });
});

test("an empty type falls back to a space", () => {
  expect(spanToCell({ type: "" }).char).toBe(" ");
});
