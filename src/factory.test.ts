import { StatefulActionNode } from "./ActionNode.js";
import { NodeConfig } from "./TreeNode.js";
import { Parser } from "./Parser.js";
import { blackboardRestore, TreeFactory } from "./TreeFactory.js";
import { Metadata, NodeStatus, PortList, type NodeUserStatus } from "./basic.js";
import { CrossDoor } from "./sample/CrossDoorNodes.js";
import { SaySomething } from "./sample/DummyNodes.js";
import { XmlError } from "./xml/XmlError.js";

function makeTestMetadata(): Metadata {
  return new Metadata([
    ["foo", "hello"],
    ["bar", "42"],
  ]);
}

// xml_text_subtree, from tests/gtest_factory.cpp
const xmlTextSubtree = `
<root BTTS_format="4" mainTreeToExecute="MainTree" >

    <BehaviorTree ID="MainTree">
        <Sequence>
            <Fallback>
                <Inverter>
                    <IsDoorClosed/>
                </Inverter>
                <SubTree ID="DoorClosedSubtree"/>
            </Fallback>
            <PassThroughDoor/>
        </Sequence>
    </BehaviorTree>

    <BehaviorTree ID="DoorClosedSubtree">
        <Fallback>
            <OpenDoor/>
            <RetryUntilSuccessful num_attempts="5">
                <PickLock/>
            </RetryUntilSuccessful>
            <SmashDoor/>
        </Fallback>
    </BehaviorTree>

</root>`;

// xml_text_subtree_part1, from tests/gtest_factory.cpp
const xmlTextSubtreePart1 = `
<root BTTS_format="4">
  <BehaviorTree ID="MainTree">
    <Fallback name="root_selector">
      <SubTree ID="DoorClosedSubtree" />
      <Action ID="PassThroughDoor" />
    </Fallback>
  </BehaviorTree>
</root>`;

// xml_text_subtree_part2, from tests/gtest_factory.cpp
const xmlTextSubtreePart2 = `
<root BTTS_format="4">
  <BehaviorTree ID="DoorClosedSubtree">
    <Sequence name="door_sequence">
      <Decorator ID="Inverter">
        <Action ID="IsDoorClosed" />
      </Decorator>
      <Action ID="OpenDoor" />
      <Action ID="PassThroughDoor" />
    </Sequence>
  </BehaviorTree>
</root>`;

describe("XMLParsingOrder", () => {
  function registeredTrees(...documents: string[]): string[] {
    const factory = new TreeFactory();
    new CrossDoor().registerNodes(factory);
    const parser = new Parser(factory);
    for (const xml of documents) parser.loadFromXML(xml);
    return parser.registeredBehaviorTrees;
  }

  test("a document holding a <TreeNodesModel> registers only its trees", () => {
    const xml = `
    <root BTTS_format="4" mainTreeToExecute="MainTree">
      <BehaviorTree ID="MainTree">
        <PassThroughDoor/>
      </BehaviorTree>
      <!-- TreeNodesModel is used only by the Graphic interface -->
      <TreeNodesModel>
        <Action ID="PassThroughDoor" />
      </TreeNodesModel>
    </root>`;

    const factory = new TreeFactory();
    new CrossDoor().registerNodes(factory);
    const parser = new Parser(factory);
    parser.loadFromXML(xml);
    expect(parser.registeredBehaviorTrees).toEqual(["MainTree"]);
  });

  test("both trees of a subtree document are registered", () => {
    expect(registeredTrees(xmlTextSubtree)).toEqual(["MainTree", "DoorClosedSubtree"]);
  });

  test("split across two documents, the first one registered first", () => {
    expect(registeredTrees(xmlTextSubtreePart1, xmlTextSubtreePart2)).toEqual([
      "MainTree",
      "DoorClosedSubtree",
    ]);
  });

  test("split across two documents, the second one registered first", () => {
    expect(registeredTrees(xmlTextSubtreePart2, xmlTextSubtreePart1)).toEqual([
      "DoorClosedSubtree",
      "MainTree",
    ]);
  });
});

describe("BehaviorTreeFactory", () => {
  test("BehaviorTree.CPPIssue7_EmptyBehaviorTree", () => {
    const xml = `
      <root BTTS_format="4">
        <BehaviorTree ID="ReceiveGuest">
        </BehaviorTree>
      </root>
    `;
    const factory = new TreeFactory();
    const parser = new Parser(factory);
    expect(() => parser.loadFromXML(xml)).toThrow();
  });

  test("BehaviorTree.CPPIssue931_NotRegisteredNode", () => {
    const xml = `
      <root BTTS_format="4">
        <BehaviorTree ID="MainTree">
          <Fallback name="root_selector">
            <IsDoorOpen/>
          </Fallback>
        </BehaviorTree>
      </root>
    `;
    const factory = new TreeFactory();
    const parser = new Parser(factory);
    expect(() => parser.loadFromXML(xml)).toThrow(/Node not recognized/);
    expect(() => new Parser(factory).loadFromXML(xml)).toThrow(/Node not recognized/);
  });

  test("BehaviorTree.CPPIssue1193_SubstitutionMayNotChangeTheNodeType", () => {
    // the XML is validated against the original type, so swapping a leaf for a
    // decorator leaves the node without the child the XML never supplied
    const xml = `
      <root BTTS_format="4">
        <BehaviorTree ID="MainTree">
          <AlwaysSuccess name="target"/>
        </BehaviorTree>
      </root>
    `;

    const factory = new TreeFactory();
    factory.substitutionRules.set("target", "Inverter");
    expect(() => factory.createTreeFromXML(xml)).toThrow(/Substitution of node/);
  });

  test("BehaviorTree.CPPIssue1193_SubstitutionMayReplaceALeafWithALeaf", () => {
    const xml = `
      <root BTTS_format="4">
        <BehaviorTree ID="MainTree">
          <AlwaysSuccess name="target"/>
        </BehaviorTree>
      </root>
    `;

    const factory = new TreeFactory();
    factory.substitutionRules.set("target", "AlwaysFailure");
    expect(() => factory.createTreeFromXML(xml)).not.toThrow();
  });

  test("BehaviorTree.CPPIssue672_DeeplyNestedXmlIsRejected", () => {
    // 400 nested Inverters would overflow the stack before the check existed
    const depth = 400;
    const open = "<Inverter>".repeat(depth);
    const close = "</Inverter>".repeat(depth);
    const xml = `
      <root BTTS_format="4">
        <BehaviorTree ID="MainTree">
          ${open}${close}
        </BehaviorTree>
      </root>
    `;

    const factory = new TreeFactory();
    expect(() => factory.createTreeFromXML(xml)).toThrow(/nesting depth/);
  });

  test("BehaviorTree.CPPIssue837_RegisteringWithExtraArgs", () => {
    class NarrowCtor extends StatefulActionNode {
      static providedPorts(): PortList {
        return new PortList();
      }
      constructor(name: string) {
        super(name, new NodeConfig());
      }
      override onStart(): NodeUserStatus {
        return NodeStatus.SUCCESS;
      }
      override onRunning(): NodeUserStatus {
        return NodeStatus.SUCCESS;
      }
      override onHalted(): void {}
    }

    const factory = new TreeFactory();
    // TypeScript rejects the mismatched extra argument at compile time, which
    // is the better outcome; the runtime guard is for plain-JS callers
    const register = factory.registerNodeType as (
      ctor: unknown,
      id: string,
      ...args: unknown[]
    ) => void;
    expect(() => register(NarrowCtor, "NarrowCtor", new PortList(), 42)).toThrow(
      /NOT compatible with the arguments provided/
    );
  });

  test("BehaviorTree.CPPIssue837_RegisteringWithoutExtraArgs", () => {
    class NarrowCtor2 extends StatefulActionNode {
      static providedPorts(): PortList {
        return new PortList();
      }
      constructor(name: string) {
        super(name, new NodeConfig());
      }
      override onStart(): NodeUserStatus {
        return NodeStatus.SUCCESS;
      }
      override onRunning(): NodeUserStatus {
        return NodeStatus.SUCCESS;
      }
      override onHalted(): void {}
    }

    const factory = new TreeFactory();
    const register = factory.registerNodeType as (
      ctor: unknown,
      id: string,
      ...args: unknown[]
    ) => void;
    expect(() => register(NarrowCtor2, "NarrowCtor2")).toThrow(/MUST add a constructor/);
  });

  test("WrongTreeName", () => {
    const xml = `
      <root BTTS_format="4">
        <BehaviorTree ID="MainTree">
          <AlwaysSuccess/>
        </BehaviorTree>
      </root>
    `;
    const factory = new TreeFactory();
    factory.registerTreeFromXML(xml);
    expect(() => factory.createTree("Wrong Name")).toThrow();
  });

  test("addMetadataToManifest", () => {
    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);
    const initialManifest = factory.manifests.get(SaySomething.name);
    expect(initialManifest!.metadata.size).toBe(0);
    factory.addMetadataToManifest(SaySomething.name, makeTestMetadata());
    const modifiedManifest = factory.manifests.get(SaySomething.name);
    expect(modifiedManifest!.metadata).toEqual(makeTestMetadata());
  });
});

describe("BehaviorTreeReload", () => {
  test("ReloadSameTree", async () => {
    const xmlA = `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
        <AlwaysSuccess/>
      </BehaviorTree>
    </root>
  `;
    const xmlB = `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
        <AlwaysFailure/>
      </BehaviorTree>
    </root>
  `;
    const factory = new TreeFactory();

    factory.registerTreeFromXML(xmlA);
    {
      const tree = factory.createTree("MainTree");

      expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    }

    factory.registerTreeFromXML(xmlB);
    {
      const tree = factory.createTree("MainTree");

      expect(await tree.tickWhileRunning()).toBe(NodeStatus.FAILURE);
    }
  });
});

describe("BehaviorTree.CPPIssue1000_VerifyXML", () => {
  function build(body: string) {
    return `
      <root BTTS_format="4">
        <BehaviorTree ID="MainTree">
          ${body}
        </BehaviorTree>
      </root>
    `;
  }

  test("a builtin tag without ID is rejected", () => {
    const factory = new TreeFactory();
    // <Action> is looked up by its ID, so a missing ID cannot resolve
    expect(() => factory.createTreeFromXML(build("<Action/>"))).toThrow(
      /<Action> must have the attribute \[ID\]/
    );
  });

  test("a builtin tag with an unknown ID reports the ID, not the tag", () => {
    const factory = new TreeFactory();
    expect(() => factory.createTreeFromXML(build('<Action ID="NoSuchNode"/>'))).toThrow(
      /Node not recognized: NoSuchNode/
    );
  });

  test("a registered ID is accepted for a builtin tag", () => {
    const factory = new TreeFactory();
    expect(() => factory.createTreeFromXML(build('<Action ID="AlwaysSuccess"/>'))).not.toThrow();
  });
});

describe("BehaviorTree.CPPIssue1182_BlackboardRestore", () => {
  test("a mismatched backup is rejected with both sizes named", () => {
    const factory = new TreeFactory();
    factory.registerTreeFromXML(`
      <root BTTS_format="4" mainTreeToExecute="MainTree">
        <BehaviorTree ID="MainTree">
          <SubTree ID="Sub" name="sub"/>
        </BehaviorTree>
        <BehaviorTree ID="Sub">
          <AlwaysSuccess/>
        </BehaviorTree>
      </root>
    `);
    const tree = factory.createTree("MainTree");

    // one blackboard short of the two subtrees
    expect(() => blackboardRestore([], tree)).toThrow(
      /backup contains 0 blackboards, but the tree has 2 subtrees/
    );
  });
});

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
    `<something BTTS_format="4">`,
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
    `<root BTTS_format="4">`,
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
    `<root BTTS_format="4">`,
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
    `<root BTTS_format="4">`,
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
    `<root BTTS_format="4"><BehaviorTree ID="Main">`,
    "<Sequence>".repeat(depth),
    `<AlwaysSuccess/>`,
    "</Sequence>".repeat(depth),
    `</BehaviorTree></root>`,
  ].join("\n");

  it("rejects the nesting that broke the depth limit, and points at it", () => {
    expectRejectedAt(xml, 2, 1 + 256 * "<Sequence>".length);
  });
});

describe("MalformedXML_ModerateNestingIsOK", () => {
  const depth = 50;
  const xml = [
    `<root BTTS_format="4"><BehaviorTree ID="Main">`,
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
    `<root BTTS_format="4">`,
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
  const xml = `<root BTTS_format="4"></root>`;

  it("registers but cannot create a tree from a <root> with no children", () => {
    const factory = new TreeFactory();
    // registering succeeds: there is simply no tree to instantiate
    expect(() => factory.registerTreeFromXML(xml)).not.toThrow();
    expect(() => factory.createTree("MainTree")).toThrow();
  });
});

describe("MalformedXML_UnknownNodeType", () => {
  const xml = [
    `<root BTTS_format="4">`,
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

describe("every tag goes through the registered-node lookup", () => {
  function build(body: string) {
    return new TreeFactory().createTreeFromXML(`
    <root BTTS_format="4">
      <BehaviorTree ID="Main">
        ${body}
      </BehaviorTree>
    </root>`);
  }

  it("a <Sequence> with no children is rejected, being a Control", () => {
    expect(() => build("<Sequence/>")).toThrow(/The node 'Sequence' must have 1 or more/);
  });

  it("a <Fallback> with no children is rejected too", () => {
    expect(() => build("<Fallback/>")).toThrow(/The node 'Fallback' must have 1 or more/);
  });

  it("a <Sequence> with a child is accepted", () => {
    expect(() => build("<Sequence><AlwaysSuccess/></Sequence>")).not.toThrow();
  });

  it("an <Action> with a child is accepted, upstream does not check those", () => {
    expect(() => build(`<Action ID="AlwaysSuccess"><AlwaysSuccess/></Action>`)).not.toThrow();
  });

  it("names the registered name, not the tag, when a decorator has no child", () => {
    expect(() => build(`<Decorator ID="Inverter"/>`)).toThrow(
      /The node 'Inverter' must have exactly 1 child/
    );
  });

  it("a TryCatch needs two children", () => {
    expect(() => build("<TryCatch><AlwaysSuccess/></TryCatch>")).toThrow(
      /The node 'TryCatch' must have at least 2 children/
    );
  });
});
