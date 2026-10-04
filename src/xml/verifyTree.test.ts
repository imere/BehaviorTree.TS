import { describe, expect, it } from "vitest";
import { TreeFactory } from "../TreeFactory.js";
import { XmlError } from "./XmlError.js";

/**
 * Body lines start on line 3, indented by 4 spaces, so a body line written as
 * `    <Action/>` sits at line 3 column 5.
 */
function tree(...body: string[]): string {
  return [
    `<root BTTS_format="4" mainTreeToExecute="MainTree">`,
    `  <BehaviorTree ID="MainTree">`,
    ...body,
    `  </BehaviorTree>`,
    `</root>`,
  ].join("\n");
}

function reject(xml: string, build?: (factory: TreeFactory) => void): XmlError {
  const factory = new TreeFactory();
  build?.(factory);
  try {
    factory.createTreeFromXML(xml);
  } catch (e) {
    return e as XmlError;
  }
  throw new Error("the document was accepted");
}

function expectRejectedAt(xml: string, message: string, line: number, column: number): void {
  const e = reject(xml);
  expect(e).toBeInstanceOf(XmlError);
  expect(e.message).toContain(message);
  expect(e.line).toBe(line);
  expect(e.column).toBe(column);
}

describe("the root of the document", () => {
  it("is rejected when it is not called <root>", () => {
    expectRejectedAt(
      [`<notroot/>`].join("\n"),
      "The doc must have a root node called <root>",
      1,
      1
    );
  });

  it("rejects a second <TreeNodesModel> and points at it", () => {
    expectRejectedAt(
      [
        `<root BTTS_format="4" mainTreeToExecute="MainTree">`,
        `  <TreeNodesModel>`,
        `    <SubTree ID="Sub"/>`,
        `  </TreeNodesModel>`,
        `  <TreeNodesModel>`,
        `  </TreeNodesModel>`,
        `  <BehaviorTree ID="MainTree">`,
        `    <AlwaysSuccess/>`,
        `  </BehaviorTree>`,
        `</root>`,
      ].join("\n"),
      "Only a single node <TreeNodesModel> is supported",
      5,
      3
    );
  });

  it("requires an ID on a builtin tag when a <TreeNodesModel> is present", () => {
    expectRejectedAt(
      [
        `<root BTTS_format="4" mainTreeToExecute="MainTree">`,
        `  <TreeNodesModel>`,
        `  </TreeNodesModel>`,
        `  <Action/>`,
        `  <BehaviorTree ID="MainTree">`,
        `    <AlwaysSuccess/>`,
        `  </BehaviorTree>`,
        `</root>`,
      ].join("\n"),
      "Action: The attribute [ID] is mandatory",
      4,
      3
    );
  });
});

describe("the <BehaviorTree> element", () => {
  it("is rejected when it does not have exactly one child", () => {
    expectRejectedAt(tree(), "The tag <BehaviorTree> must have exactly 1 child", 2, 3);
  });

  it("needs an ID only when the document holds more than one tree", () => {
    const twoTrees = [
      `<root BTTS_format="4" mainTreeToExecute="MainTree">`,
      `  <BehaviorTree ID="MainTree">`,
      `    <AlwaysSuccess/>`,
      `  </BehaviorTree>`,
      `  <BehaviorTree>`,
      `    <AlwaysSuccess/>`,
      `  </BehaviorTree>`,
      `</root>`,
    ].join("\n");
    expectRejectedAt(twoTrees, "The tag <BehaviorTree> must have the attribute [ID]", 5, 3);
  });

  it("may not borrow the name of a registered node for its ID", () => {
    expectRejectedAt(
      [
        `<root BTTS_format="4" mainTreeToExecute="MainTree">`,
        `  <BehaviorTree ID="AlwaysSuccess">`,
        `    <AlwaysSuccess/>`,
        `  </BehaviorTree>`,
        `</root>`,
      ].join("\n"),
      "The attribute [ID] of tag <BehaviorTree> must not use the name of a registered Node",
      2,
      3
    );
  });
});

describe("node types", () => {
  it("requires an ID on a builtin tag and points at that tag", () => {
    expectRejectedAt(tree("    <Action/>"), "The tag <Action> must have the attribute [ID]", 3, 5);
  });

  it("reports the ID, not the tag, when a builtin tag names an unknown ID", () => {
    expectRejectedAt(
      tree(`    <Action ID="NoSuchNode"/>`),
      "Node not recognized: NoSuchNode",
      3,
      5
    );
  });

  it("reports the element name when a custom tag is not registered", () => {
    expectRejectedAt(tree("    <NoSuchNode/>"), "Node not recognized: NoSuchNode", 3, 5);
  });

  it("requires exactly one child for a decorator", () => {
    expectRejectedAt(tree("    <Inverter/>"), "The tag <Inverter> must have exactly 1 child", 3, 5);
  });

  it("requires no child for an action", () => {
    expectRejectedAt(
      tree("    <AlwaysSuccess>", "      <AlwaysSuccess/>", "    </AlwaysSuccess>"),
      "The tag <AlwaysSuccess> must not have any child",
      3,
      5
    );
  });

  it("requires at least one child for a control declared by ID", () => {
    // may stand empty, so the rule only bites on a <Control ID="..."> tag
    expectRejectedAt(
      tree(`    <Control ID="ReactiveSequence"/>`),
      "The tag <Control> must have at least 1 child",
      3,
      5
    );
  });

  it("points at the nesting that broke the depth limit", () => {
    const depth = 300;
    const e = reject(
      [
        `<root BTTS_format="4" mainTreeToExecute="MainTree">`,
        `  <BehaviorTree ID="MainTree">`,
        ...Array.from({ length: depth }, () => `<Inverter>`),
        `<AlwaysSuccess/>`,
        ...Array.from({ length: depth }, () => `</Inverter>`),
        `  </BehaviorTree>`,
        `</root>`,
      ].join("\n")
    );
    expect(e.message).toContain("Maximum XML nesting depth exceeded (limit: 256)");
    // <BehaviorTree> is line 2 at depth 0, so depth 257 is line 259
    expect(e.line).toBe(259);
  });
});

describe("the <SubTree> element", () => {
  it("may not have children", () => {
    expectRejectedAt(
      tree(`    <SubTree ID="Sub">`, `      <AlwaysSuccess/>`, `    </SubTree>`),
      "The tag <SubTree> must not have any child",
      3,
      5
    );
  });

  it("may not borrow the name of a registered node for its ID", () => {
    expectRejectedAt(
      tree(`    <SubTree ID="AlwaysSuccess"/>`),
      "The attribute [ID] of tag <SubTree> must not use the name of a registered Node",
      3,
      5
    );
  });
});

describe("a ReactiveSequence", () => {
  const reactive = (...body: string[]) =>
    tree("    <ReactiveSequence>", ...body, "    </ReactiveSequence>");

  it("may not hold two async children", () => {
    expectRejectedAt(
      reactive(`      <AsyncSequence/>`, `      <AsyncSequence/>`),
      "A ReactiveSequence cannot have more than one async child.",
      3,
      5
    );
  });

  it("blames the child it could not resolve, not the sequence", () => {
    expectRejectedAt(reactive(`      <NoSuchNode/>`), "Unknown node type: NoSuchNode", 4, 7);
  });
});

describe("errors raised while instantiating", () => {
  it("points at the element carrying a port the node does not declare", () => {
    expectRejectedAt(
      tree("    <Inverter>", `      <AlwaysSuccess bogus_port="{x}"/>`, "    </Inverter>"),
      "A port with name [bogus_port] is found in the XML, but not in the providedPorts()",
      4,
      7
    );
  });

  it("points at <root> when no main tree can be chosen", () => {
    expectRejectedAt(
      [
        `<root BTTS_format="4">`,
        `  <BehaviorTree ID="A">`,
        `    <AlwaysSuccess/>`,
        `  </BehaviorTree>`,
        `  <BehaviorTree ID="B">`,
        `    <AlwaysSuccess/>`,
        `  </BehaviorTree>`,
        `</root>`,
      ].join("\n"),
      "[mainTreeToExecute] was not specified correctly",
      1,
      1
    );
  });

  it("points at the <SubTree> that closes the recursion", () => {
    expectRejectedAt(
      [
        `<root BTTS_format="4" mainTreeToExecute="MainTree">`,
        `  <BehaviorTree ID="MainTree">`,
        `    <SubTree ID="Sub"/>`,
        `  </BehaviorTree>`,
        `  <BehaviorTree ID="Sub">`,
        `    <SubTree ID="Sub"/>`,
        `  </BehaviorTree>`,
        `</root>`,
      ].join("\n"),
      "Recursive subtree detected: [Sub] refers to itself",
      6,
      5
    );
  });

  it("points at the second of two <SubTree> elements sharing a name", () => {
    const shared = [
      `<root BTTS_format="4" mainTreeToExecute="MainTree">`,
      `  <BehaviorTree ID="MainTree">`,
      `    <Sequence>`,
      `      <SubTree ID="Sub" name="twin"/>`,
      `      <SubTree ID="Sub" name="twin"/>`,
      `    </Sequence>`,
      `  </BehaviorTree>`,
      `  <BehaviorTree ID="Sub">`,
      `    <AlwaysSuccess/>`,
      `  </BehaviorTree>`,
      `</root>`,
    ].join("\n");
    expectRejectedAt(shared, "Duplicate SubTree path detected: 'twin'", 5, 7);
  });

  it("points at the <SubTree> naming a tree that does not exist", () => {
    // nothing verifies that a <SubTree> ID names a real tree, so this is only
    // caught while the subtree is being built
    expectRejectedAt(
      tree(`    <SubTree ID="NoSuchTree"/>`),
      "Can't find a tree with name: NoSuchTree",
      3,
      5
    );
  });

  it("points at the node a substitution rule could not resolve", () => {
    const xml = tree(`    <AlwaysSuccess name="target"/>`);
    const factory = new TreeFactory();
    factory.substitutionRules.set("target", "NotRegisteredAnywhere");
    let e: XmlError | undefined;
    try {
      factory.createTreeFromXML(xml);
    } catch (err) {
      e = err as XmlError;
    }
    expect(e).toBeInstanceOf(XmlError);
    expect(e!.message).toContain("Substituted Node ID [NotRegisteredAnywhere] not found");
    expect(e!.line).toBe(3);
    expect(e!.column).toBe(5);
  });

  it("points at the node a substitution rule could not replace compatibly", () => {
    const xml = tree(`    <AlwaysSuccess name="target"/>`);
    const factory = new TreeFactory();
    factory.substitutionRules.set("target", "Sequence");
    let e: XmlError | undefined;
    try {
      factory.createTreeFromXML(xml);
    } catch (err) {
      e = err as XmlError;
    }
    expect(e).toBeInstanceOf(XmlError);
    expect(e!.message).toContain("Substitution of node [target]");
    expect(e!.line).toBe(3);
    expect(e!.column).toBe(5);
  });
});

describe("a hand-written tree object", () => {
  it("is rejected without inventing a position", () => {
    const factory = new TreeFactory();
    expect(() =>
      factory.registerTreeFromObject({
        name: "root",
        children: [{ name: "BehaviorTree", children: [{ name: "NoSuchNode" }] }],
      })
    ).toThrow(/Node not recognized: NoSuchNode/);

    try {
      factory.registerTreeFromObject({
        name: "root",
        children: [{ name: "BehaviorTree", children: [{ name: "NoSuchNode" }] }],
      });
    } catch (e) {
      expect((e as XmlError).line).toBeUndefined();
      expect((e as XmlError).column).toBeUndefined();
    }
  });
});
