import { ElementType, parseDocument } from "htmlparser2";

export { parseDocument, ElementType };

export type Document = ReturnType<typeof parseDocument>;

export type ChildNode = Document["children"][number];

export interface Element {
  type: ElementType.ElementType;
  data?: string;
  tag?: string;
  name: string;
  attribs: Record<string, string>;
  children?: Element[];
}
