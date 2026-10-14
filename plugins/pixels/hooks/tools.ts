import type { ToolCallInfo } from "../types";

// The arguments worth showing, most telling first. Anything else falls back to
// the first string argument the call has.
const SUMMARY_KEYS = [
  "command",
  "file_path",
  "notebook_path",
  "path",
  "pattern",
  "url",
  "query",
  "skill",
  "subagent_type",
  "description",
  "prompt",
];

// Keys a tool.call event carries beside the tool's own arguments.
const RESERVED_KEYS = new Set(["tool", "tool_use_id", "agentId", "requestMeta", "consent"]);

const MAX_SUMMARY = 100;

// One line naming a call's most telling argument, e.g. "command: git status".
export function summarizeToolInput(input: Record<string, unknown>): string | undefined {
  const name = input['tool'];
  if (name === 'Edit') {
    return String(input['path']);
  }
  else if (name === 'Bash') {
    return String(input['command']);
  }

  // general case
  const key =
    SUMMARY_KEYS.find((k) => typeof input[k] === "string" && input[k] !== "") ??
    Object.keys(input).find((k) => !RESERVED_KEYS.has(k) && typeof input[k] === "string" && input[k] !== "");
  if (key === undefined) return undefined;
  const text = String(input[key]).replace(/\s+/g, " ").trim();
  return `${key}: ${text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY - 1)}…` : text}`;
}

// What a tool.call hook learns before the call runs.
export function callInfo(input: Record<string, unknown> & { tool: string; agentId?: string }): ToolCallInfo {
  return { tool: input.tool, summary: summarizeToolInput(input), agentId: input.agentId };
}

type CallAnswer = {
  deny?: string;
  isError?: boolean;
  isReadOnly?: boolean;
};

// What it learns from the answer: it ran, errored, or was refused.
export function callOutcome(answer: CallAnswer): Pick<ToolCallInfo, "outcome" | "isReadOnly" | "deniedBecause"> {
  if (answer.deny !== undefined) return { outcome: "denied", deniedBecause: answer.deny };
  return { outcome: answer.isError ? "error" : "ok", isReadOnly: answer.isReadOnly };
}

// Keeps the newest `max` calls so a long session's map can't grow without bound.
export function keepNewest<T>(calls: Record<string, T>, max: number): Record<string, T> {
  const entries = Object.entries(calls);
  return entries.length <= max ? calls : Object.fromEntries(entries.slice(entries.length - max));
}

const MAX_PROMPT = 200;

// A prompt on one line, cut with an ellipsis when long.
export function summarizePrompt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_PROMPT ? `${flat.slice(0, MAX_PROMPT - 1)}…` : flat;
}
