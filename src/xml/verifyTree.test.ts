import { describe, expect, it } from "vitest";
import { TreeFactory } from "../TreeFactory.js";
import { XmlError } from "./XmlError.js";

function expectRejectedAt(xml: string, line: number, column: number): void {
  let e: unknown;
  try {
    new TreeFactory().createTreeFromXML(xml);
  } catch (err) {
    e = err;
  }
  expect(e).toBeInstanceOf(XmlError);
  expect((e as XmlError).line).toBe(line);
  expect((e as XmlError).column).toBe(column);
}

describe("MalformedXML_InvalidRoot", () => {
  it("rejects XML that is not valid XML at all", () => {
    let e: unknown;
    try {
      new TreeFactory().createTreeFromXML("<not valid xml!!!");
    } catch (err) {
      e = err;
    }
    expect(e).toBeInstanceOf(Error);
  });
});

describe("MalformedXML_MissingRootElement", () => {
  const xml = [
    `<something BTCPP_format="4">`,
    `  <BehaviorTree ID="Main">`,
    `    <AlwaysSuccess/>`,
    `  </BehaviorTree>`,
    `</something>`,
  ].join("\n");

  it("rejects a well-formed document whose root is not <root>", () => {
    expectRejectedAt(xml, 1, 1);
  });
});

describe("MalformedXML_EmptyBehaviorTree", () => {
  const xml = [
    `<root BTCPP_format="4">`,
    `  <BehaviorTree ID="Main">`,
    `  </BehaviorTree>`,
    `</root>`,
  ].join("\n");

  it("rejects a <BehaviorTree> with no children", () => {
    expectRejectedAt(xml, 2, 3);
  });
});

describe("MalformedXML_EmptyBehaviorTreeID", () => {
  const xml = [
    `<root BTCPP_format="4">`,
    `  <BehaviorTree ID="">`,
    `    <AlwaysSuccess/>`,
    `  </BehaviorTree>`,
    `  <BehaviorTree ID="Other">`,
    `    <AlwaysSuccess/>`,
    `  </BehaviorTree>`,
    `</root>`,
  ].join("\n");

  it("rejects an empty ID when other trees exist", () => {
    let e: unknown;
    try {
      new TreeFactory().createTreeFromXML(xml);
    } catch (err) {
      e = err;
    }
    expect(e).toBeInstanceOf(Error);
  });
});

describe("MalformedXML_MissingBehaviorTreeID", () => {
  const xml = [
    `<root BTCPP_format="4">`,
    `  <BehaviorTree>`,
    `    <AlwaysSuccess/>`,
    `  </BehaviorTree>`,
    `  <BehaviorTree>`,
    `    <AlwaysFailure/>`,
    `  </BehaviorTree>`,
    `</root>`,
  ].join("\n");

  it("rejects several <BehaviorTree> elements with no ID", () => {
    expectRejectedAt(xml, 2, 3);
  });
});

describe("MalformedXML_DeeplyNestedElements", () => {
  // 300 levels, past the 256 limit; upstream wants a readable exception rather
  // than a stack overflow
  const depth = 300;
  const xml = [
    `<root BTCPP_format="4"><BehaviorTree ID="Main">`,
    "<Sequence>".repeat(depth),
    `<AlwaysSuccess/>`,
    "</Sequence>".repeat(depth),
    `</BehaviorTree></root>`,
  ].join("\n");

  it("rejects the nesting that broke the depth limit, and points at it", () => {
    // upstream builds all 300 open tags into one line, so the offending one is
    // the 257th "<Sequence>" of that line
    expectRejectedAt(xml, 2, 1 + 256 * "<Sequence>".length);
  });
});

describe("MalformedXML_ModerateNestingIsOK", () => {
  const depth = 50;
  const xml = [
    `<root BTCPP_format="4"><BehaviorTree ID="Main">`,
    "<Sequence>".repeat(depth),
    `<AlwaysSuccess/>`,
    "</Sequence>".repeat(depth),
    `</BehaviorTree></root>`,
  ].join("\n");

  it("accepts nesting well within the limit", () => {
    expect(() => new TreeFactory().createTreeFromXML(xml)).not.toThrow();
  });
});

describe("MalformedXML_MultipleBTChildElements", () => {
  const xml = [
    `<root BTCPP_format="4">`,
    `  <BehaviorTree ID="Main">`,
    `    <AlwaysSuccess/>`,
    `    <AlwaysFailure/>`,
    `  </BehaviorTree>`,
    `</root>`,
  ].join("\n");

  it("rejects a <BehaviorTree> with more than one child", () => {
    expectRejectedAt(xml, 2, 3);
  });
});

describe("MalformedXML_CompletelyEmpty", () => {
  it("rejects an empty document", () => {
    let e: unknown;
    try {
      new TreeFactory().createTreeFromXML("");
    } catch (err) {
      e = err;
    }
    expect(e).toBeInstanceOf(Error);
  });
});

describe("MalformedXML_EmptyRoot", () => {
  const xml = `<root BTCPP_format="4"></root>`;

  it("registers but cannot create a tree from a <root> with no children", () => {
    const factory = new TreeFactory();
    // registering succeeds: there is simply no tree to instantiate
    expect(() => factory.registerTreeFromXML(xml)).not.toThrow();
    expect(() => factory.createTree("MainTree")).toThrow();
  });
});

describe("MalformedXML_UnknownNodeType", () => {
  const xml = [
    `<root BTCPP_format="4">`,
    `  <BehaviorTree ID="Main">`,
    `    <NonExistentNodeType/>`,
    `  </BehaviorTree>`,
    `</root>`,
  ].join("\n");

  it("rejects a node type that is not registered, and points at it", () => {
    let e: unknown;
    try {
      new TreeFactory().createTreeFromXML(xml);
    } catch (err) {
      e = err;
    }
    expect(e).toBeInstanceOf(XmlError);
    expect((e as XmlError).message).toContain("Node not recognized: NonExistentNodeType");
    expect((e as XmlError).line).toBe(3);
    expect((e as XmlError).column).toBe(5);
  });
});
