import type { AgentSpan, ModelSpan, OtherSpan, ToolSpan, UserSpan } from "./spans";

// Test helpers: one factory per span kind, so a test builds the kind it means.
// Each takes the fields it cares about and gets defaults for the rest.

export const toolSpan = (override: Partial<ToolSpan> = {}): ToolSpan => ({
  kind: "tool",
  type: "unset",
  toolKind: "other",
  start: 0,
  durationMs: 0,
  events: [],
  ...override,
});

export const userSpan = (override: Partial<UserSpan> = {}): UserSpan => ({
  kind: "user",
  type: "unset",
  start: 0,
  durationMs: 0,
  events: [],
  ...override,
});

export const agentSpan = (override: Partial<AgentSpan> = {}): AgentSpan => ({
  kind: "agent",
  type: "unset",
  agentId: "agent",
  start: 0,
  durationMs: 0,
  events: [],
  ...override,
});

export const modelSpan = (override: Partial<ModelSpan> = {}): ModelSpan => ({
  kind: "model",
  type: "unset",
  model: "haiku",
  start: 0,
  durationMs: 0,
  events: [],
  ...override,
});

export const otherSpan = (override: Partial<OtherSpan> = {}): OtherSpan => ({
  kind: "other",
  type: "unset",
  source: "test",
  start: 0,
  durationMs: 0,
  events: [],
  ...override,
});
