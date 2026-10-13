export type EventType = 'assistant_response' | 'user_input' | 'system_event' | "user_prompt" | "tool_decision" | "api_request" | string;
export type Event = {
  type: EventType;
  model?: string;
  source?: string;
  timestamp?: string;
  attributes?: Record<string, any>;
};

// What the tool.call hook learns about a call, keyed by tool_use_id in the state.
export type ToolCallInfo = {
  tool: string;
  // The call's most telling argument, e.g. "command: git status".
  summary?: string;
  // Set when the call ran inside a subagent.
  agentId?: string;
  outcome?: 'ok' | 'error' | 'denied';
  isReadOnly?: boolean;
  // Why a plugin or rule refused it.
  deniedBecause?: string;
};

// A prompt as the prompt.submit hook saw it. Telemetry redacts the text.
export type PromptInfo = {
  // Ms since the epoch when it was submitted.
  at: number;
  text: string;
};

declare module 'claude-code' {
  interface PluginState {
    'pixels': { events: Event[]; toolCalls: Record<string, ToolCallInfo>; prompts: PromptInfo[] }
  }
}
