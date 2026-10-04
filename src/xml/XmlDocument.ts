import { ElementType, parseDocument } from "htmlparser2";
import { debug } from "../Logger.js";
import { fail } from "./XmlError.js";

/**
 * One element in the source document, with the position it came from so that
 * every later complaint can point back at it.
 */
export class XmlElement {
  constructor(
    readonly name: string,
    readonly props: Record<string, string>,
    readonly children: XmlChild[],
    readonly line: number,
    readonly column: number
  ) {}
}

export type XmlChild = XmlElement | string;

export type XmlDocument = {
  readonly source: string;
  readonly root: XmlElement;
};

/**
 * Parses the document into an XmlElement tree, resolving line and column for
 * every node. Text between tags is kept as a string so a leaf node's text
 * content survives.
 *
 * The source is kept verbatim: trimming it would shift every offset and make
 * the reported line disagree with the file the caller is looking at.
 */
export function parseXmlDocument(xml: string): XmlDocument {
  const lineIndex = buildLineIndex(xml);

  const doc = parseDocument(xml, {
    xmlMode: true,
    withStartIndices: true,
    withEndIndices: true,
  }) as unknown as HtmlNode;

  const elements = toChildren(doc, lineIndex).filter(
    (child): child is XmlElement => typeof child !== "string"
  );
  if (elements.length !== 1) {
    // point at the extra root when there is one to blame; with no root at all
    // there is nothing to point at
    fail(elements[1], "The document must have exactly one <root> element");
  }

  return { source: xml, root: elements[0] };
}

type HtmlNode = {
  type: string;
  name?: string;
  attribs?: Record<string, string>;
  children?: HtmlNode[];
  data?: string;
  startIndex?: number;
};

function toChildren(node: HtmlNode, lineIndex: LineIndex): XmlChild[] {
  const out: XmlChild[] = [];
  const children = node.children ?? [];
  for (const child of children) {
    if (child.type === ElementType.Text) {
      const text = child.data ?? "";
      if (!text.trim()) continue;
      const prev = out[out.length - 1];
      if (typeof prev === "string") out[out.length - 1] = prev + text;
      else out.push(text);
      continue;
    }

    if (child.type === ElementType.Comment) {
      debug(`ignoring comment at offset ${child.startIndex}`);
      continue;
    }

    if (child.type !== ElementType.Tag && child.type !== ElementType.Script) continue;

    const { line, column } = lineIndex.locate(child.startIndex ?? 0);
    out.push(
      new XmlElement(
        child.name ?? "",
        child.attribs ?? {},
        toChildren(child, lineIndex),
        line,
        column
      )
    );
  }
  return out;
}

type LineIndex = { locate(offset: number): { line: number; column: number } };

function buildLineIndex(source: string): LineIndex {
  const lineStarts: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) lineStarts.push(i + 1);
  }

  return {
    locate(offset: number) {
      let lo = 0;
      let hi = lineStarts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lineStarts[mid] <= offset) lo = mid;
        else hi = mid - 1;
      }
      return { line: lo + 1, column: offset - lineStarts[lo] + 1 };
    },
  };
}
