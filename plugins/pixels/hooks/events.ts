import type { TelemetryRecordEntry } from "claude-code";
import type { Event } from "../types";

// Remove noise, keep only extra atts for debugging. Anything we use should actually be put on Event directly
const DROPPED_ATTRIBUTES = new Set([
  "user.email",
  "user.account_uuid",
  "session.id",
  "organization.id",
  "client_request_id",
  "terminal.type",
  "user.account_id",
  "user.id",
  "prompt.id",
  "client_request_id",
  "request_id"
]);

export function normalizeEvent(e: TelemetryRecordEntry): Event {
  const atts = e.attributes ?? {};
  return {
    type: e.event,
    timestamp: e.loggedAt,
    model: asMaybeAtt<string>(atts, "model"),
    prompt: asMaybeAtt<string>(atts, "prompt"),
    command: asMaybeAtt<string>(atts, "command_name"),
    source: asMaybeAtt<string>(atts, "query_source"),
    attributes: normalizeAtts(e.attributes),
  };
}

export function normalizeAtts(attributes: unknown): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries((attributes ?? {}) as Record<string, unknown>).filter(
      ([key]) => !DROPPED_ATTRIBUTES.has(key),
    ),
  );
}
function asMaybeAtt<T>(atts: TelemetryRecordEntry["attributes"], key: string): T | undefined {
  const v = atts[key];
  if (v === undefined) return undefined;
  return v as T;
}

