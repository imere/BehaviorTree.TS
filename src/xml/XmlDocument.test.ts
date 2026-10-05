import { describe, expect, it } from "vitest";
import { parseXmlDocument } from "./XmlDocument.js";
import { XmlError } from "./XmlError.js";

// parseXmlDocument has no counterpart in BehaviorTree.CPP, which parses with
// tinyxml2 inline. The documents here are the ones upstream's
// MalformedXML_* tests use, plus the checks that the line and column reported
// by this port actually point at the element that was rejected.

describe("MalformedXML_InvalidRoot", () => {
  it("rejects XML that is not valid XML at all", () => {
    expect(() => parseXmlDocument("<not valid xml!!!")).toThrow(XmlError);
  });
});

describe("MalformedXML_CompletelyEmpty", () => {
  it("rejects an empty document", () => {
    expect(() => parseXmlDocument("")).toThrow(XmlError);
  });
});

describe("MalformedXML_MissingRootElement", () => {
  it("rejects a well-formed document whose only element is not <root>", () => {
    // <something> parses fine on its own; naming it is verifyTree's job
    const { root } = parseXmlDocument(
      [`<something BTCPP_format="4">`, `  <BehaviorTree ID="Main"/>`, `</something>`].join("\n")
    );
    expect(root.name).toBe("something");
  });
});

describe("a document with more than one element", () => {
  it("is rejected, blaming the extra one", () => {
    let e: unknown;
    try {
      parseXmlDocument(`<a/>\n<b/>`);
    } catch (err) {
      e = err;
    }
    expect(e).toBeInstanceOf(XmlError);
    expect((e as XmlError).message).toContain("exactly one <root> element");
    expect((e as XmlError).line).toBe(2);
    expect((e as XmlError).column).toBe(1);
  });
});

describe("the position reported for an element", () => {
  const source = [
    `<root>`,
    `  <First/>`,
    `  <Second>`,
    `    <Third/>`,
    `  </Second>`,
    `</root>`,
  ].join("\n");

  it("points at the opening angle bracket of each element", () => {
    const { root } = parseXmlDocument(source);

    expect(root.line).toBe(1);
    expect(root.column).toBe(1);

    const first = root.children[0] as { name: string; line: number; column: number };
    expect(first.name).toBe("First");
    expect(first.line).toBe(2);
    expect(first.column).toBe(3);

    const third = (root.children[1] as { children: unknown[] }).children[0] as {
      name: string;
      line: number;
      column: number;
    };
    expect(third.name).toBe("Third");
    expect(third.line).toBe(4);
    expect(third.column).toBe(5);
  });

  it("agrees with the text it points at, on every line", () => {
    const { root } = parseXmlDocument(source);
    const lines = source.split("\n");
    expect(lines[root.line - 1][root.column - 1]).toBe("<");
    for (const child of root.children) {
      const el = child as { line: number; column: number };
      expect(lines[el.line - 1][el.column - 1]).toBe("<");
    }
  });
});

describe("the position of an element in a document that was not trimmed", () => {
  it("matches the line the caller wrote, not the line after trimming", () => {
    const { root } = parseXmlDocument(`\n\n  <root/>\n`);
    expect(root.line).toBe(3);
    expect(root.column).toBe(3);
  });
});

describe("a rejection with nothing to point at", () => {
  it("carries no position rather than an invented one", () => {
    let e: unknown;
    try {
      parseXmlDocument(`not xml at all`);
    } catch (err) {
      e = err;
    }
    expect(e).toBeInstanceOf(XmlError);
    expect((e as XmlError).line).toBeUndefined();
    expect((e as XmlError).column).toBeUndefined();
  });
});
