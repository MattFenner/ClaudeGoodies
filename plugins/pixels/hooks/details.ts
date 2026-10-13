import type { Span } from "./spans";

// One line of the details pane for a span: what it was, when, how long, how it went.
export type SpanRow = {
  time: string;
  label: string;
  duration: string;
  status: "ok" | "failed" | "running" | "";
  // Extra lines for the pane to draw under it: model, tool source, sizes and so on.
  details: string[];
};

export function spanRow(span: Span): SpanRow {
  return {
    time: clock(span.start),
    label: span.kind === "tool" ? span.type.replace(/^tool_/, "") || "tool" : span.type,
    duration: formatDuration(span),
    status: statusOf(span),
    details: detailLines(span),
  };
}

// HH:MM:SS in UTC, so a log and the pane read the same whatever the time zone.
function clock(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19);
}

function formatDuration({ kind, durationMs }: Span): string {
  if (durationMs === undefined) return kind === "tool" ? "…" : "";
  if (kind === "instant") return "";
  return durationMs < 1000 ? `${Math.round(durationMs)}ms` : `${(durationMs / 1000).toFixed(1)}s`;
}

function statusOf({ kind, end, success }: Span): SpanRow["status"] {
  if (kind !== "tool") return "";
  if (end === undefined) return "running";
  return success ? "ok" : "failed";
}

type Attrs = Record<string, unknown>;

// Each builder reads the span's merged attributes and returns a line, or nothing
// when the span has none of what it needs.
const DETAIL_BUILDERS: ((a: Attrs) => string | undefined)[] = [
  (a) => (a.model ? `${a.model}` : undefined),
  (a) => (a.agent_type ? `agent ${a.agent_type}` : undefined),
  (a) => (a["skill.name"] ? `/${a["skill.name"]}` : undefined),
  (a) => (a.query_source ? `source ${a.query_source}` : undefined),
  (a) => (a.tool_source && a.tool_source !== 'builtin' ? `tool source ${a.tool_source}` : undefined),
  (a) => (a.decision && a.decision !== 'accept' ? `decision ${a.decision}${a.source ? ` (${a.source})` : ""}` : undefined),
  (a) =>
    a.input_tokens !== undefined || a.output_tokens !== undefined
      ? `tokens ${a.input_tokens ?? 0} in, ${a.output_tokens ?? 0} out`
      : undefined,
  (a) => (a.total_tokens ? `tokens ${a.total_tokens}, ${a.total_tool_uses ?? 0} tool uses` : undefined),
  // (a) => (a.ttft_ms ? `first token ${a.ttft_ms}ms` : undefined),
  (a) => (a.cost_usd ? `cost $${Number(a.cost_usd).toFixed(4)}` : undefined),
  // (a) =>
  //   a.tool_input_size_bytes !== undefined
  //     ? `input ${a.tool_input_size_bytes}B, result ${a.tool_result_size_bytes ?? 0}B`
  //     : undefined,
  (a) => (a.query_source && a.query_source !== 'repl_main_thread' ? `from ${a.query_source}` : undefined),
  // (a) => (a.prompt ? `${a.prompt}` : undefined),
  // (a) => (a.prompt_length ? `${a.prompt_length} chars` : undefined),
  // (a) => (a.response_length ? `${a.response_length} chars` : undefined),
  (a) => (a.status ? `${a.status}${a.transport_type ? ` over ${a.transport_type}` : ""}` : undefined),
];

export function detailLines(span: Span): string[] {
  const attrs: Attrs = Object.assign({}, ...span.events.map((event) => event.attributes ?? {}));
  const lines = DETAIL_BUILDERS.map((build) => build(attrs)).filter((line): line is string => line !== undefined);
  return [...(span.prompt ? [span.prompt] : []), ...callLines(span), ...lines];
}

// What the tool.call hook saw: the call's own argument first, as it is the most telling.
function callLines({ call }: Span): string[] {
  if (!call) return [];
  return [
    call.summary,
    call.agentId ? `in subagent ${call.agentId}` : undefined,
    call.outcome === "denied" ? `denied${call.deniedBecause ? `: ${call.deniedBecause}` : ""}` : undefined,
    call.isReadOnly ? "read-only" : undefined,
  ].filter((line): line is string => line !== undefined);
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
