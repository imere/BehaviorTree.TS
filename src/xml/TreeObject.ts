import type { XmlDocument, XmlElement } from "./XmlDocument.js";

/**
 * The tree as the rest of the library sees it: elements and their attributes,
 * with the position each one was written at.
 *
 * `line` and `column` are optional because these objects are also built by
 * hand and passed to `registerTreeFromObject`, where there is no document to
 * be a position in.
 */
export interface TreeObject {
  name: string;
  props?: Partial<Record<"BTTS_format" | (string & {}), string>>;
  children: TreeNodeObject[];
  line?: number;
  column?: number;
}

export interface TreeNodeObject {
  name: string;
  props?: Partial<Record<"ID" | "name" | (string & {}), string>>;
  children?: TreeNodeObject[];
  line?: number;
  column?: number;
}

/**
 * Drops the text of a document: only elements become nodes, which is what
 * every consumer downstream counts and recurses over.
 */
export function toTreeObject(doc: XmlDocument): TreeObject {
  return convert(doc.root);
}

function convert(element: XmlElement): TreeObject {
  const children: TreeNodeObject[] = [];
  for (const child of element.children) {
    if (typeof child === "string") continue;
    children.push(convert(child));
  }
  return {
    name: element.name,
    props: element.props,
    children,
    line: element.line,
    column: element.column,
  };
}
