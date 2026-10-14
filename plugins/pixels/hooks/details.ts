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
    case "user":
      if (span.prompt) {
        return `prompt: ${span.prompt}`;
      }
      return "user";
    case "agent":
      return span.agentId;
    case "tool":
      return span.toolName ?? span.call?.tool ?? (stripToolPrefix(span.type) || "tool");
    case "model":
      return span.model;
    case "other":
      if (span.source) {
        return span.source;
      }
      return span.type.replaceAll('_', ' ');
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
  const lines : (string | undefined)[] = [];
  if(span.kind === "tool") {
    lines.push(...callLines(span));
  };
  if (span.kind === 'other') {
    // FIXME: make this better
    if (span.events.length > 0) {
      lines.push(span.events[0]?.source);
    }
    // for (const p in span) {
    //   lines.push(`${p} : ${span[p]}`);
    // }
    for (const e of span.events) {
      // for (const ep in e) {
      //   if(ep === 'type') continue;
      //   if(ep === 'timestamp') continue;
      //   lines.push(`${ep}: ${e[ep]}`);
      // }
      for (const a in e.attributes) {
        lines.push(`${a}: ${e.attributes[a]}`);
      }
    }
  }
  return lines.filter(l => l !== undefined);
}

export function spanRows(spans: Span[]): SpanRow[] {
  return spans.map(s => spanRow(s));
}
