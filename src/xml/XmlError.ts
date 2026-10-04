/**
 * A problem with a behavior tree document.
 *
 * `line` and `column` are absent when the tree did not come from text: a
 * hand-written TreeObject has no source to point into, and inventing a
 * position would send the reader to the wrong place.
 */
export class XmlError extends Error {
  constructor(
    message: string,
    readonly line?: number,
    readonly column?: number
  ) {
    super(withPosition(message, line, column));
    this.name = "XmlError";
  }
}

/** Anything carrying a position in the original document. */
export type Positioned = { line?: number; column?: number };

/**
 * Aborts with an XmlError pointing at wherever `target` was written. The
 * message is used verbatim: callers name the element themselves, so the
 * position is the only thing added here.
 */
export function fail(target: Positioned | undefined, message: string): never {
  throw new XmlError(message, target?.line, target?.column);
}

function withPosition(message: string, line?: number, column?: number): string {
  if (line === undefined) return message;
  if (column === undefined) return `${message} (line ${line})`;
  return `${message} (line ${line}, column ${column})`;
}
