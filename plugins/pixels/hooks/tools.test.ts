import { expect, test } from "claude-code/testing";

import { callInfo, callOutcome, keepNewest, summarizePrompt, summarizeToolInput } from "./tools";

test("a Bash call is summarised by its command", () => {
  expect(summarizeToolInput({ tool: "Bash", tool_use_id: "t", command: "git status", description: "x" }))
  .toBe("git status");
});

test("a file tool is summarised by its path", () => {
  expect(summarizeToolInput({ tool: "Read", file_path: "C:/a/b.ts", offset: 4 })).toBe("file_path: C:/a/b.ts");
});

test("an unknown tool falls back to its first string argument, never a reserved key", () => {
  expect(summarizeToolInput({ tool: "mcp__x__y", tool_use_id: "t", agentId: "a", repo: "foo/bar", n: 3 })).toBe("repo: foo/bar");
});

test("a call with no string arguments has no summary", () => {
  expect(summarizeToolInput({ tool: "TodoWrite", tool_use_id: "t", n: 3 })).toBeUndefined();
});

test("callInfo keeps the tool, summary and agent", () => {
  expect(callInfo({ tool: "Grep", pattern: "foo", agentId: "ag1" })).toEqual({
    tool: "Grep",
    summary: "pattern: foo",
    agentId: "ag1",
  });
});

test("callOutcome tells ok, error and denied apart", () => {
  expect(callOutcome({ isReadOnly: true })).toEqual({ outcome: "ok", isReadOnly: true });
  expect(callOutcome({ isError: true })).toMatchObject({ outcome: "error" });
  expect(callOutcome({ deny: "blocked" })).toEqual({ outcome: "denied", deniedBecause: "blocked" });
});

test("keepNewest drops the oldest entries past the limit", () => {
  expect(Object.keys(keepNewest({ a: 1, b: 2, c: 3 }, 2))).toEqual(["b", "c"]);
  expect(Object.keys(keepNewest({ a: 1 }, 2))).toEqual(["a"]);
});

test("summarizePrompt flattens whitespace and cuts long prompts", () => {
  expect(summarizePrompt("hello\n\n  world")).toBe("hello world");
  const out = summarizePrompt("x".repeat(500));
  expect(out.length).toBe(200);
  expect(out.endsWith("…")).toBe(true);
});
