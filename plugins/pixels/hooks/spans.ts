import type { Event, PromptInfo, ToolCallInfo } from "../types";

// The middle of the pipeline: events -> spans -> grid.
//
// A span is one thing that happened, with a start and (once it is over) an end.
// A tool call's tool_decision and tool_result events become one span, and an
// api_request becomes a span ending when it was logged. Every other event is an
// instant, a span that starts and ends at the same moment.
//
// Its kind says whose it is: a tool call, the user (prompts), a subagent, or
// other (model requests and the rest). MCP traffic is still treated as a tool.
export type SpanKind = "tool" | "user" | "agent" | "other";
export type ToolKind = "skill" | "command" | "mcp" | "other";

export type SpanBase = {
  kind: SpanKind;
  start: number;
  end?: number;
  durationMs?: number;
  events: Event[];

  // TODO: do we want these?
  type: string;

}

export type ToolSpan = SpanBase & {
  kind: 'tool',
  toolKind: ToolKind,
  toolName?: string,
  success?: boolean;
  call?: ToolCallInfo;
  toolUseId?: string;
}

export type UserSpan = SpanBase & {
  kind: 'user',
  prompt?: string;
}

export type AgentSpan = SpanBase & {
  kind: 'agent',
  agentId: string,
}

export type OtherSpan = SpanBase & {
  kind: 'other',
  model?: string
}

export type Span = UserSpan | ToolSpan | AgentSpan | OtherSpan;

// export type Span = {
//   kind: SpanKind;
//   // What the grid styles it by: "tool_<name>" for a tool call, otherwise the
//   // event's own type.
//   type: string;
//   // Ms since the epoch.
//   start: number;
//   // Undefined while the span is still open (a tool call with no result yet).
//   end?: number;
//   durationMs?: number;
//   // Tool calls only: the result's own success flag, false when the call was rejected.
//   success?: boolean;
//   // Tool calls only.
//   toolUseId?: string;
//   // Tool calls only: what the tool.call hook saw, when it saw this call.
//   call?: ToolCallInfo;
//   // User prompts only: the text the prompt.submit hook saw (telemetry redacts it).
//   prompt?: string;
//   // The events it was built from, in the order they arrived.
//   events: Event[];
// };

export function kindOf(type: string, attrs: Record<string, unknown> = {}): SpanKind {
  if (type === "tool_decision" || type === "tool_result") {
    const name = String(attrs.tool_name ?? "");
    const source = String(attrs.tool_source ?? "");
    return name.startsWith("mcp__") || source === "mcp" ? "tool" : "tool";
  }
  if (type.startsWith("mcp_")) return "tool";
  if (type.startsWith("user_")) return "user";
  if (type.startsWith("subagent")) return "agent";
  return "other";
}

// Attribute values arrive as strings ("68", "true"), whatever they mean.
function num(value: unknown): number | undefined {
  const n = Number(value);
  return value === undefined || value === "" || Number.isNaN(n) ? undefined : n;
}

function timeOf(event: Event): number {
  const t = typeof event.timestamp === "number" ? event.timestamp : Date.parse(event.timestamp ?? "");
  return Number.isNaN(t) ? 0 : t;
}

// Model calls the session makes for itself (prompt suggestions, away summaries,
// the session title) say so in their query_source. Only the conversation's own
// calls, the main thread and subagents, make spans; any event without a
// query_source is kept.
export function isConversationEvent(event: Event): boolean {
  const source = event.attributes?.query_source;
  return source === undefined || source === "repl_main_thread" || String(source).startsWith("agent:");
}

// How far apart (ms) a user_prompt event and the prompt.submit that raised it can be.
const PROMPT_MATCH_MS = 5000;

export function makeSpans(
  events: Event[],
  calls: Record<string, ToolCallInfo> = {},
  prompts: PromptInfo[] = [],
): Span[] {
  const spans: Span[] = [];
  const openTools = new Map<string, ToolSpan>();

  for (const event of events.filter(isConversationEvent)) {
    const at = timeOf(event);
    const attrs = event.attributes ?? {};
    const toolUseId = attrs.tool_use_id === undefined ? undefined : String(attrs.tool_use_id);

    if (event.type === "tool_decision") {
      const rejected = attrs.decision !== "accept";
      const span: ToolSpan = {
        kind: 'tool',
        type: `tool_${attrs.tool_name ?? ""}`,
        toolKind: toolKindOf(event),
        toolName: attrs.tool_name,
        start: at,
        toolUseId,
        events: [event],
        ...(rejected ? { end: at, durationMs: 0, success: false } : {}),
      };
      spans.push(span);
      if (toolUseId && !rejected) openTools.set(toolUseId, span);
    } else if (event.type === "tool_result") {
      const durationMs = num(attrs.duration_ms);
      const known = toolUseId ? openTools.get(toolUseId) : undefined;
      const span: ToolSpan = known ?? {
        kind: 'tool',
        type: `tool_${attrs.tool_name ?? ""}`,
        toolKind: toolKindOf(event),
        toolName: attrs.tool_name,
        start: at,
        toolUseId,
        events: [],
      };
      span.events.push(event);
      span.end = at;
      // The run itself: a decision can sit waiting for approval before it starts.
      span.start = durationMs === undefined ? span.start : at - durationMs;
      span.durationMs = durationMs ?? at - span.start;
      span.success = String(attrs.success) === "true";
      if (!known) spans.push(span);
      if (toolUseId) openTools.delete(toolUseId);
    } else if (event.type === "api_request") {
      const durationMs = num(attrs.duration_ms);
      spans.push({
        kind: kindOf(event.type, attrs),
        type: event.type,
        start: at - (durationMs ?? 0),
        end: at,
        durationMs,
        model: event.model,
        events: [event],
      } as Span);
    } else if (event.type.startsWith("user_")) {
      spans.push({ kind: "user", type: event.type, start: at, end: at, durationMs: 0, events: [event] });
    } else if (event.type.startsWith("mcp_")) {
      spans.push({
        kind: "tool",
        type: event.type,
        toolKind: "mcp",
        start: at,
        end: at,
        durationMs: 0,
        events: [event],
      } as ToolSpan);
    } else {
      spans.push({ kind: 'other', type: event.type, start: at, end: at, durationMs: 0, events: [event] });
    }
  }

  // Match calls
  for (const span of spans.filter(s => s.kind === 'tool')) {
    if (span.toolUseId && calls[span.toolUseId]) span.call = calls[span.toolUseId];
  }

  // Each user_prompt takes the closest unused submission within a few seconds.
  const unused = [...prompts];
  for (const span of spans.filter(s => s.kind === 'user')) {
    if (span.type !== "user_prompt") continue;
    let best = -1;
    unused.forEach((p, i) => {
      const gap = Math.abs(p.at - span.start);
      const currentBest = best >= 0 ? unused[best] : undefined;
      if (
        gap <= PROMPT_MATCH_MS &&
        (!currentBest || gap < Math.abs(currentBest.at - span.start))
      ) {
        best = i;
      }
    });
    if (best >= 0) {
      const prompt = unused.splice(best, 1)[0];
      if (prompt) span.prompt = prompt.text;
    }
  }

  return spans;
}

// The spans from the most recent user_prompt on (the prompt included); all of
// them when there has been no prompt yet.
export function sinceLastPrompt(spans: Span[]): Span[] {
  const last = spans.findLastIndex((span) => span.type === "user_prompt");
  return last < 0 ? spans : spans.slice(last);
}

function toolKindOf(event: Event): ToolKind {
  const attrs = event.attributes ?? {};
  if (attrs.tool_source === "mcp" || String(attrs.tool_name ?? "").startsWith("mcp__")) {
    return "mcp";
  }
  // FIXME: skill etc
  return "other";
}

