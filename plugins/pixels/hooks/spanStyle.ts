import type { Span } from "./spans";

// A Raster color of this value means "the terminal's own default".
export const COLOR_NONE = 0x01000000;

export type SpanStyle = { color: number };

const STYLE_USER: SpanStyle = {
  color: COLOR_NONE,
};

const STYLE_RESPONSE: SpanStyle = {
  color: 0xffffff,
};

const STYLE_MODEL: SpanStyle = {
  color: 0xbebebe,
};

const STYLE_TOOL_MCP: SpanStyle = {
  color: 0xC3CF7F,
};

const STYLE_TOOL_READ: SpanStyle = {
  color: 0xBBA96D,
};

const STYLE_TOOL_OTHER: SpanStyle = {
  color: 0xBB9C6D,
};

const STYLE_EVENT: SpanStyle = {
  color: 0x6CB6C4,
};

const STYLE_AGENT: SpanStyle = {
  color: 0x9c5cac,
};

export function styleOf(span: Span): SpanStyle {
  switch (span.kind) {
    case "user":
      return STYLE_USER;
    case "model":
      return STYLE_MODEL;
    case "tool":
      switch (span.toolKind) {
        case "mcp":
          return STYLE_TOOL_MCP;
        default:
          if (span.call?.isReadOnly) {
            return STYLE_TOOL_READ;
          }
          return STYLE_TOOL_OTHER;
      }
      break;
    case "agent":
      return STYLE_AGENT;
    case "harnessevent":
      if (span.eventKind === 'assistant_response') {
        return STYLE_RESPONSE;
      }
      return STYLE_EVENT;
    default: {
      const _exhaustiveCheck: never = span;
      return _exhaustiveCheck;
    }
  }
}
