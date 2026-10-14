import type { Span } from "./spans";
import { COLOR_NONE, styleOf } from "./spanStyle";

export type Row = Cell[];
export type Grid = Row[];

export type Cell = {
  char: string | undefined;
  foreground: number,
  background: number,
};

const EMPTY_CELL: Cell = {
  char: " ",
  foreground: COLOR_NONE,
  background: COLOR_NONE,
};

const MS_PER_CELL = 1000;

// How many cells a span takes up: one per second, never fewer than one. A span
// that is still open has no duration yet, so it takes one.
export function spanToCellCount(span: Pick<Span, "durationMs">): number {
  return Math.max(1, Math.round((span.durationMs ?? 0) / MS_PER_CELL));
}

export function gridOf(spans: Span[], columns: number): Grid {
  const row: Row = [];
  for (const span of spans) {
    const style = styleOf(span);
    for (let i = 0; i < spanToCellCount(span); i++) {
      if (span.kind === "tool" && span.success === false && i === 0) {
        row.push({ char: "E", background: style.color, foreground: 0xff0000 });
      } else {
        row.push({ char: " ", background: style.color, foreground: COLOR_NONE });
      }
    }
  }
  // Too long for the row: keep the most recent cells.
  const visible = row.length > columns ? row.slice(row.length - columns) : row;
  // fill the remaining cells in the row with empty cells
  while (visible.length < columns) {
    visible.push(EMPTY_CELL);
  }
  return [visible];
}

// Pack rows of [character, color] pairs into the one string a Raster takes
// One cell is three numbers: the character's code point, its color, and its background
export function gridToTerminal(grid: Grid): string {
  const numbers = grid
    .flat()
    .flatMap(({ char, background, foreground }) => [
      (char ?? " ").codePointAt(0) ?? 0x20,
      foreground,
      background,
    ]);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore: toBase64 is missing from the TypeScript 5.6 lib that check.sh uses
  return new Uint8Array(Uint32Array.from(numbers).buffer).toBase64();
}
