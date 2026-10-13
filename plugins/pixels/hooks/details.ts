import type { Span } from "./spans";

// One line of the details pane for a span: what it was, when, how long, how it went.
export type SpanRow = {
  time: string;
  label: string;
  duration: string;
  status: "ok" | "failed" | "running" | "";
  details: string[];
};

export function spanRow(span: Span): SpanRow {
  return {
    time: clock(span.start),
    label: labelOf(span),
    duration: formatDuration(span),
    status: statusOf(span),
    details: detailLines(span),
  };
}

function stripToolPrefix(type: string): string {
  return type.startsWith("tool_") ? type.slice("tool_".length) : type;
}

function labelOf(span: Span): string {
  switch (span.kind) {
    case "agent":
      return span.agentId;
    case "user":
      return span.prompt ?? "user_prompt";
    case "tool":
      return span.toolName ?? span.call?.tool ?? (stripToolPrefix(span.type) || "tool");
    case "other":
      return span.type;
  }
}

// HH:MM:SS in UTC, so a log and the pane read the same whatever the time zone.
function clock(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19);
}

function formatDuration(span: Span): string {
  const { durationMs } = span;
  if (durationMs === undefined) return span.kind === "tool" ? "…" : "";
  if (durationMs === 0 && span.kind !== "tool") return "";
  return durationMs < 1000
    ? `${Math.round(durationMs)}ms`
    : `${(durationMs / 1000).toFixed(1)}s`;
}

function statusOf(span: Span): SpanRow["status"] {
  if (span.kind !== "tool") return "";
  if (span.end === undefined) return "running";
  return span.success === false ? "failed" : "ok";
}

function callLines(span: Span): string[] {
  if (span.kind !== "tool" || !span.call) return [];
  const { call } = span;
  return [
    call.summary,
    call.agentId ? `in subagent ${call.agentId}` : undefined,
    call.isReadOnly ? "read-only" : undefined,
    call.outcome === "denied"
      ? `denied${call.deniedBecause ? `: ${call.deniedBecause}` : ""}`
      : undefined,
  ].filter((line): line is string => line !== undefined);
}

export function detailLines(span: Span): string[] {
  const lines = span.kind === "tool" ? [...callLines(span)] : [];
  if ("model" in span && span.model) {
    lines.push(span.model);
  }
  return lines;
}

// Oldest first, so the prompt that started the turn is at the top. With a
// `maxLines`, the newest rows that fit are kept (one line each, plus their
// details; at least one row is always shown); without one, every span gets a row.
export function spanRows(spans: Span[], maxLines = Infinity): SpanRow[] {
  const rows: SpanRow[] = [];
  let used = 0;
  for (const span of [...spans].reverse()) {
    const row = spanRow(span);
    const lines = 1 + row.details.length;
    if (rows.length > 0 && used + lines > maxLines) break;
    rows.push(row);
    used += lines;
  }
  return rows.reverse();
}
