import { describe, expect, it } from "vitest";
import { parseXmlDocument } from "./XmlDocument.js";
import { XmlError } from "./XmlError.js";

describe("parseXmlDocument", () => {
  it("records the position of every element", () => {
    const { root } = parseXmlDocument(`<root>
  <First/>
  <Second>
    <Third/>
  </Second>
</root>`);

    expect(root.name).toBe("root");
    expect(root.line).toBe(1);

    const first = root.children[0] as { name: string; line: number; column: number };
    expect(first.name).toBe("First");
    expect(first.line).toBe(2);
    expect(first.column).toBe(3);

    const second = root.children[1] as { name: string; line: number; children: unknown[] };
    expect(second.name).toBe("Second");
    expect(second.line).toBe(3);

    const third = second.children[0] as { name: string; line: number };
    expect(third.name).toBe("Third");
    expect(third.line).toBe(4);
  });

  it("keeps attribute values", () => {
    const { root } = parseXmlDocument(`<root a="1" b="two"/>`);
    expect(root.props).toEqual({ a: "1", b: "two" });
  });

  it("keeps text content of a leaf", () => {
    const { root } = parseXmlDocument(`<root>some text</root>`);
    expect(root.children).toEqual(["some text"]);
  });

  it("rejects a document without a single root", () => {
    expect(() => parseXmlDocument(`not xml at all`)).toThrow(XmlError);
  });

  it("rejects a document with two root elements", () => {
    expect(() => parseXmlDocument(`<root/><other/>`)).toThrow(/exactly one <root>/);
  });

  it("ignores stray text around the root", () => {
    const { root } = parseXmlDocument(`junk\n<root/>\ntrailing junk`);
    expect(root.name).toBe("root");
  });

  it("carries the position of the root it blames", () => {
    try {
      parseXmlDocument(`<a/>\n<b/>`);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(XmlError);
      // the second root is the one that does not belong
      expect((e as XmlError).message).toMatch(/line 2, column 1/);
    }
  });

  it("has no position to give when there is no root at all", () => {
    try {
      parseXmlDocument(`not xml at all`);
      expect.unreachable();
    } catch (e) {
      expect((e as XmlError).line).toBeUndefined();
    }
  });

  it("locates positions on later lines correctly", () => {
    const { root } = parseXmlDocument(
      ["<root>", "  <A/>", "  <B/>", "  <C/>", "</root>"].join("\n")
    );
    const c = root.children[2] as { name: string; line: number };
    expect(c.name).toBe("C");
    expect(c.line).toBe(4);
  });
});
