import type { TelemetryRecordEntry } from "claude-code";

// Attributes dropped before an event is stored, so they never reach the UI
// state or the log files. Add a key here to drop another.
const DROPPED_ATTRIBUTES = new Set([
  "user.email",
  "user.account_uuid",
  "session.id",
  "organization.id",
]);

export function normalizeEvent(e: TelemetryRecordEntry): any {
  return {
    type: e.event,
    timestamp: e.loggedAt,
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
