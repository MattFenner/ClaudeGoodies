import type { Event, PixelsState, ToolCallInfo } from "../types";
import { replace as replaceIn } from "./functional";
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
export type SpanKind = Span["kind"];
export type ToolKind = "mcp" | "other"; // FIXME: support more e.g. skill, Bash/Powershell

export type SpanBase = {
  start: number;
  end?: number;
  durationMs?: number;
  events: Event[];

  // TODO: do we want this?
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
  command?: string;
};

export type AgentSpan = SpanBase & {
  kind: "agent";
  agentId: string;
};

// count is how many spans this one stands for: 1, or more once adjacent repeats are merged.
export type ModelSpan = SpanBase & {
  kind: "model";
  model: string;
  count: number;
};

export type HarnessEventSpan = SpanBase & {
  kind: "harnessevent";
  eventKind: HarnessEventKind;
  source?: string;
  count: number;
};

const KNOWN_HARNESS_EVENT_TYPES = [
  "plugin_loaded",
  "assistant_response",
  "skill_activated",
  "permission_mode_changed",
] as const;
export type HarnessEventKind =
  (typeof KNOWN_HARNESS_EVENT_TYPES)[number] | string;

function isKnownHarnessEventKind(event: Event): boolean {
  if (
    KNOWN_HARNESS_EVENT_TYPES.some(
      (knownType) => knownType === event.type || knownType === event.source,
    )
  ) {
    return true;
  }
  return false;
}

function harnessEventKindOf(event: Event): HarnessEventKind | undefined {
  if (
    typeof event.source === "string" &&
    KNOWN_HARNESS_EVENT_TYPES.some((knownType) => knownType === event.source)
  ) {
    return event.source as HarnessEventKind;
  }
  return event.type;
}

export type Span =
  UserSpan | ToolSpan | AgentSpan | ModelSpan | HarnessEventSpan;

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

// How far apart (ms) a user_prompt event and the prompt.submit that raised it can be.
const PROMPT_MATCH_MS = 5000;

// Attempts to handle an event. Return full list of spans if handled, undefined if not.
type EventHandler = (
  event: Event,
  spans: Span[],
  // eslint-disable-next-line no-restricted-syntax
  context: {
    openTools: Map<string, ToolSpan>;
    toolCalls: Record<string, ToolCallInfo>;
    logger: Logger;
  },
) => Span[] | undefined;

export function makeSpans(state: PixelsState, logger: Logger): Span[] {
  let spans: Span[] = [];
  const openTools = new Map<string, ToolSpan>();
  const { events, toolCalls, prompts } = state;

  const eventHandlers: EventHandler[] = [
    handleToolEvent,
    handleModelEvent,
    handleUserEvent,
    handleEventEvent,
  ];

  for (const event of events) {
    for (const handler of eventHandlers) {
      const result = handler(event, spans, { openTools, toolCalls, logger });
      if (result) {
        spans = result;
        break;
      }
    }
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

  return mergeRepeats(spans);
}

// Joins each run of adjacent model spans for the same model, and of adjacent
// harness event spans of the same kind, into one span with a count. Every other
// span passes through as it is.
export function mergeRepeats(spans: Span[]): Span[] {
  const merged: Span[] = [];
  for (const span of spans) {
    const last = merged.at(-1);
    const repeat = last === undefined ? undefined : mergedRepeat(last, span);
    if (repeat) {
      merged[merged.length - 1] = repeat;
    } else {
      merged.push(span);
    }
  }
  return merged;
}

// The one span that a span following `earlier` makes when they are repeats, else undefined.
// The merged span runs from the earlier one's start to the later one's end.
function mergedRepeat(earlier: Span, later: Span): Span | undefined {
  if (
    earlier.kind === "model" &&
    later.kind === "model" &&
    earlier.model === later.model
  ) {
    return {
      ...earlier,
      ...windowOf(earlier, later),
      count: earlier.count + later.count,
      events: [...earlier.events, ...later.events],
    };
  }
  if (
    earlier.kind === "harnessevent" &&
    later.kind === "harnessevent" &&
    earlier.eventKind === later.eventKind
  ) {
    return {
      ...earlier,
      ...windowOf(earlier, later),
      count: earlier.count + later.count,
      events: [...earlier.events, ...later.events],
    };
  }
  return undefined;
}

function windowOf(
  earlier: SpanBase,
  later: SpanBase,
): Pick<SpanBase, "start" | "end" | "durationMs"> {
  const end = later.end ?? earlier.end;
  return {
    start: earlier.start,
    end,
    durationMs: end === undefined ? undefined : end - earlier.start,
  };
}

const handleToolEvent : EventHandler = (event,  spans, { openTools, toolCalls }) => {
  const attrs = event.attributes;
  if (event.type === "tool_decision") {
    const rejected = attrs.decision !== "accept";
    const toolUseId =
      attrs.tool_use_id === undefined ? undefined : String(attrs.tool_use_id);
    // A rejected call is over at once. An accepted one stays open until its result.
    const span: ToolSpan = {
      kind: "tool",
      type: `tool_${attrs.tool_name ?? ""}`,
      toolKind: toolKindOf(event),
      toolName: attrs.tool_name as string | undefined,
      ...(rejected ? { ...timesOf(event), success: false } : { start: timeOf(event) }),
      call: toolUseId ? toolCalls[toolUseId] : undefined,
      toolUseId,
      events: [event],
    };
    if (toolUseId && !rejected) openTools.set(toolUseId, span);

    return [...spans, span];
  } else if (event.type === "tool_result") {
    const toolUseId =
      attrs.tool_use_id === undefined ? undefined : String(attrs.tool_use_id);
    const success = String(attrs.success) === "true";
    const known = toolUseId ? openTools.get(toolUseId) : undefined;
    // the call is no longer open once its result has arrived
    if (toolUseId) openTools.delete(toolUseId);
    if (known) {
      return replaceIn(spans, known, {
        ...known,
        ...timesOf(event, known),
        call: toolUseId ? toolCalls[toolUseId] : undefined,
        success,
        events: [...known.events, event],
      });
    } else {
      // unmatched
      return [
        ...spans,
        {
          kind: "tool",
          type: `tool_${attrs.tool_name ?? ""}`,
          toolKind: toolKindOf(event),
          toolName:
            attrs.tool_name === undefined ? undefined : String(attrs.tool_name),
          ...timesOf(event),
          call: toolUseId ? toolCalls[toolUseId] : undefined,
          success,
          toolUseId,
          events: [event],
        },
      ];
    }
  }

  // FIXME: skills, MCP etc

  return undefined;
}

const handleModelEvent: EventHandler = (event, spans, _) => {
  if (event.type === "api_request" && event.model) {
    return [
      ...spans,
      {
        kind: "model",
        type: event.type,
        ...timesOf(event),
        model: event.model,
        count: 1,
        events: [event],
      } as ModelSpan,
    ];
  }
};

const handleUserEvent: EventHandler = (event, spans, _) => {
  if (event.type.startsWith("user_")) {
    return [
      ...spans,
      {
        kind: "user",
        type: event.type,
        ...timesOf(event),
        prompt: event.prompt,
        command: event.command,
        events: [event],
      },
    ];
  }
};

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

const handleEventEvent: EventHandler = (event, spans, { logger }) => {
  // known events we want to ignore
  if (["retention_sweep"].includes(event.type)) return;
  if (event.source && ["prompt_suggestion", "away_summary", "generate_session_title"].includes(event.source)) return;

  if (!isKnownHarnessEventKind(event)) {
    // unknown unknowns
    // FIXME: remove when we are happy, or log somewhere more subtle
    logger.logDebug(
      `unknown event ${event.type} ${event.attributes["query_source"]} \n${JSON.stringify(event)} `,
    );
  }

  return [...spans, ({
    kind: "harnessevent",
    type: event.type,
    eventKind: harnessEventKindOf(event)!,
    ...timesOf(event),
    source: event.source,
    count: 1,
    events: [event],
  })];
};
