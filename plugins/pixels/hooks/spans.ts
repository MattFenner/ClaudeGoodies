import type { Event, PixelsState, ToolCallInfo } from "../types";
import { replace as replaceIn } from "./functionalUtils";
import type { Logger } from "./log";

// The middle of the pipeline: events -> spans -> grid.
//
// A span is one thing that happened, with a start and (once it is over) an end.
// A tool call's tool_decision and tool_result events become one span, and an
// api_request becomes a span ending when it was logged. Every other event is an
// instant, a span that starts and ends at the same moment.
//
// Its kind says whose it is: a tool call, the user (prompts), a subagent, or
// other (model requests and the rest). MCP traffic is still treated as a tool.
export type SpanKind = "tool" | "user" | "agent" | "model" | "other";
export type ToolKind = "mcp" | "other"; // FIXME: support more e.g. skill, Bash/Powershell

export type SpanBase = {
  kind: SpanKind;
  start: number;
  end?: number;
  durationMs?: number;
  events: Event[];

  // TODO: do we want these?
  type: string;
};

export type ToolSpan = SpanBase & {
  kind: "tool";
  toolKind: ToolKind;
  toolName?: string;
  success?: boolean;
  call?: ToolCallInfo;
  toolUseId?: string;
};

export type UserSpan = SpanBase & {
  kind: "user";
  prompt?: string;
};

export type AgentSpan = SpanBase & {
  kind: "agent";
  agentId: string;
};

export type ModelSpan = SpanBase & {
  kind: "model";
  model: string;
};

export type OtherSpan = SpanBase & {
  kind: "other";
  source: string;
};

export type Span = UserSpan | ToolSpan | AgentSpan | ModelSpan | OtherSpan;

// Attribute values arrive as strings ("68", "true"), whatever they mean.
function num(value: unknown): number | undefined {
  const n = Number(value);
  return value === undefined || value === "" || Number.isNaN(n) ? undefined : n;
}

function timeOf(event: Event): number {
  const t =
    typeof event.timestamp === "number"
      ? event.timestamp
      : Date.parse(event.timestamp ?? "");
  return Number.isNaN(t) ? 0 : t;
}

// Model calls the session makes for itself (prompt suggestions, away summaries,
// the session title) say so in their query_source. Only the conversation's own
// calls, the main thread and subagents, make spans; any event without a
// query_source is kept.
export function shouldIncludeEvent(event: Event): boolean {
  if (event.type !== "api_request") return true;

  const source = event.attributes?.query_source;
  return (
    source === undefined ||
    source === "repl_main_thread" ||
    String(source).startsWith("agent:")
  );
}

// How far apart (ms) a user_prompt event and the prompt.submit that raised it can be.
const PROMPT_MATCH_MS = 5000;

export function makeSpans(
  state: PixelsState,
  logger: Logger,
): Span[] {
  let spans: Span[] = [];
  const openTools = new Map<string, ToolSpan>();
  const {events, toolCalls, prompts} = state;

  for (const event of events.filter(shouldIncludeEvent)) {
    const attrs = event.attributes ?? {};

    if (event.type === "tool_decision") {
      const rejected = attrs.decision !== "accept";
      const toolUseId =
        attrs.tool_use_id === undefined ? undefined : String(attrs.tool_use_id);
      const span: ToolSpan = {
        kind: "tool",
        type: `tool_${attrs.tool_name ?? ""}`,
        toolKind: toolKindOf(event),
        toolName: attrs.tool_name,
        ...timesOf(event),
        toolUseId,
        events: [event],
      };
      spans.push(span);
      if (toolUseId && !rejected) openTools.set(toolUseId, span);
    } else if (event.type === "tool_result") {
      const toolUseId =
        attrs.tool_use_id === undefined ? undefined : String(attrs.tool_use_id);
      const success = String(attrs.success) === "true";
      const known = toolUseId ? openTools.get(toolUseId) : undefined;
      if (known) {
        spans = replaceIn(spans, known, {
          ...known,
          ...timesOf(event, known),
          events: [...known.events, event],
          success,
        });
      } else {
        spans.push({
          kind: "tool",
          type: `tool_${attrs.tool_name ?? ""}`,
          toolKind: toolKindOf(event),
          toolName: attrs.tool_name,
          ...timesOf(event),
          success,
          toolUseId,
          events: [event],
        });
      }

      if (toolUseId) openTools.delete(toolUseId);
    } else if (event.type === "api_request" && event.model) {
      spans.push({
        kind: "model",
        type: event.type,
        ...timesOf(event),
        model: event.model,
        events: [event],
      } as ModelSpan);
    } else if (event.type.startsWith("user_")) {
      spans.push({
        kind: "user",
        type: event.type,
        ...timesOf(event),
        events: [event],
      });
    } else if (event.type.startsWith("mcp_")) {
      spans.push({
        kind: "tool",
        type: event.type,
        toolKind: "mcp",
        ...timesOf(event),
        events: [event],
      } as ToolSpan);
    } else if (event.source) {
      spans.push({
        kind: "other",
        type: event.type,
        ...timesOf(event),
        source: event.source,
        events: [event],
      });
    } else {
      // unknown type
      logger.logDebug(`unknown event ${event.type}: ${JSON.stringify(event, null, 2)}`)
    }
  }

  // Match calls
  for (const span of spans.filter((s) => s.kind === "tool")) {
    if (span.toolUseId && toolCalls[span.toolUseId])
      span.call = toolCalls[span.toolUseId];
  }

  // Each user_prompt takes the closest unused submission within a few seconds.
  const unused = [...prompts];
  for (const span of spans.filter((s) => s.kind === "user")) {
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

function timesOf(
  event: Event,
  existingSpan?: Span,
): Pick<Span, "start" | "durationMs" | "end"> {
  const at = timeOf(event);
  const attrs = event.attributes ?? {};
  const durationMs = num(attrs.duration_ms);
  if (existingSpan) {
    return {
      start: existingSpan.start,
      durationMs: at - existingSpan.start,
      end: at,
    };
  } else if (durationMs) {
    // no existing start
    return {
      start: at - durationMs,
      durationMs: durationMs,
      end: at,
    };
  } else {
    return {
      start: at,
      durationMs: 0,
      end: at,
    };
  }
}

// The spans from the most recent user_prompt on (the prompt included); all of
// them when there has been no prompt yet.
export function sinceLastPrompt(spans: Span[]): Span[] {
  const last = spans.findLastIndex((span) => span.type === "user_prompt");
  return last < 0 ? spans : spans.slice(last);
}

function toolKindOf(event: Event): ToolKind {
  const attrs = event.attributes ?? {};
  if (
    attrs.tool_source === "mcp" ||
    String(attrs.tool_name ?? "").startsWith("mcp__")
  ) {
    return "mcp";
  }
  // FIXME: skill etc
  return "other";
}
