import { describe, expect, it } from "vitest";
import { NodeStatus, PortDirection, type PortList } from "../basic.js";
import { TreeFactory } from "../TreeFactory.js";
import { parseXML } from "../Parser.js";
import { loadSubtreeModels, type SubtreeModels } from "./TreeNodesModel.js";
import { XmlError } from "./XmlError.js";

/**
 * A document declaring a model for <SubTree ID="Sub">. `treeBody` is the body
 * of the main tree, starting on line 3, indented by 4 spaces; the model starts
 * on line 9.
 */
function doc(treeBody: string[], model: string[]): string {
  return [
    `<root BTTS_format="4" mainTreeToExecute="MainTree">`,
    `  <BehaviorTree ID="MainTree">`,
    ...treeBody,
    `  </BehaviorTree>`,
    `  <BehaviorTree ID="Sub">`,
    `    <AlwaysSuccess/>`,
    `  </BehaviorTree>`,
    `  <TreeNodesModel>`,
    ...model,
    `  </TreeNodesModel>`,
    `</root>`,
  ].join("\n");
}

const goalPort = [`    <SubTree ID="Sub">`, `      <input_port name="goal"/>`, `    </SubTree>`];

function readModels(xml: string): SubtreeModels {
  const models: SubtreeModels = new Map();
  loadSubtreeModels(parseXML(xml), models);
  return models;
}

function expectRejectedAt(xml: string, message: string, line: number, column: number): void {
  let e: unknown;
  try {
    new TreeFactory().createTreeFromXML(xml);
  } catch (err) {
    e = err;
  }
  expect(e).toBeInstanceOf(XmlError);
  expect((e as XmlError).message).toContain(message);
  expect((e as XmlError).line).toBe(line);
  expect((e as XmlError).column).toBe(column);
}

describe("the ports a <TreeNodesModel> declares", () => {
  it("are keyed by the ID of the <SubTree> that declares them", () => {
    const models = readModels(doc([`    <SubTree ID="Sub" goal="{value}"/>`], goalPort));
    expect([...models.keys()]).toEqual(["Sub"]);
    expect([...models.get("Sub")!.ports.keys()]).toEqual(["goal"]);
  });

  it("keep the direction of the tag they were written under", () => {
    const models = readModels(
      doc(
        [`    <SubTree ID="Sub" a="{v}" b="{v}" c="{v}"/>`],
        [
          `    <SubTree ID="Sub">`,
          `      <input_port name="a"/>`,
          `      <output_port name="b"/>`,
          `      <inout_port name="c"/>`,
          `    </SubTree>`,
        ]
      )
    );
    const ports: PortList = models.get("Sub")!.ports;
    expect(ports.get("a")!.direction).toBe(PortDirection.INPUT);
    expect(ports.get("b")!.direction).toBe(PortDirection.OUTPUT);
    expect(ports.get("c")!.direction).toBe(PortDirection.INOUT);
  });

  it("carry the default and the description they were given", () => {
    const models = readModels(
      doc(
        [`    <SubTree ID="Sub" goal="{value}"/>`],
        [
          `    <SubTree ID="Sub">`,
          `      <input_port name="goal" default="42" description="where to go"/>`,
          `      <input_port name="other"/>`,
          `    </SubTree>`,
        ]
      )
    );
    const ports = models.get("Sub")!.ports;
    expect(ports.get("goal")!.defaultValueString).toBe("42");
    expect(ports.get("goal")!.description).toBe("where to go");
    // absent attributes stay empty rather than becoming "undefined"
    expect(ports.get("other")!.defaultValueString).toBe("");
    expect(ports.get("other")!.description).toBe("");
  });

  it("keep the ports of every block that declares the same subtree", () => {
    const models = readModels(
      [
        `<root BTTS_format="4" mainTreeToExecute="MainTree">`,
        `  <BehaviorTree ID="MainTree">`,
        `    <SubTree ID="Sub" first="{v}" second="{v}"/>`,
        `  </BehaviorTree>`,
        `  <BehaviorTree ID="Sub">`,
        `    <AlwaysSuccess/>`,
        `  </BehaviorTree>`,
        `  <TreeNodesModel>`,
        `    <SubTree ID="Sub">`,
        `      <input_port name="first"/>`,
        `    </SubTree>`,
        `  </TreeNodesModel>`,
        `  <TreeNodesModel>`,
        `    <SubTree ID="Sub">`,
        `      <input_port name="second"/>`,
        `    </SubTree>`,
        `  </TreeNodesModel>`,
        `</root>`,
      ].join("\n")
    );
    expect([...models.get("Sub")!.ports.keys()]).toEqual(["first", "second"]);
  });

  it("ignore elements that are not ports", () => {
    const models = readModels(
      doc(
        [`    <SubTree ID="Sub" goal="{value}"/>`],
        [
          `    <SubTree ID="Sub">`,
          `      <input_port name="goal"/>`,
          `      <Action/>`,
          `    </SubTree>`,
        ]
      )
    );
    expect([...models.get("Sub")!.ports.keys()]).toEqual(["goal"]);
  });
});

describe("a mandatory port declared in a <TreeNodesModel>", () => {
  it("is rejected when the <SubTree> does not remap it", () => {
    expectRejectedAt(
      doc([`    <SubTree ID="Sub"/>`], goalPort),
      `the <SubTree ID="Sub"> is defining a mandatory port called [goal], but you are not remapping it`,
      3,
      5
    );
  });

  it("is accepted once the <SubTree> remaps it", () => {
    expect(() =>
      new TreeFactory().createTreeFromXML(doc([`    <SubTree ID="Sub" goal="{value}"/>`], goalPort))
    ).not.toThrow();
  });

  it("is satisfied by a default the model declares", () => {
    const withDefault = [
      `    <SubTree ID="Sub">`,
      `      <input_port name="goal" default="{value}"/>`,
      `    </SubTree>`,
    ];
    expect(() =>
      new TreeFactory().createTreeFromXML(doc([`    <SubTree ID="Sub"/>`], withDefault))
    ).not.toThrow();
  });

  it("yields to an explicit remapping", () => {
    const withDefault = [
      `    <SubTree ID="Sub">`,
      `      <input_port name="goal" default="{ignored}"/>`,
      `    </SubTree>`,
    ];
    expect(() =>
      new TreeFactory().createTreeFromXML(
        doc([`    <SubTree ID="Sub" goal="{value}"/>`], withDefault)
      )
    ).not.toThrow();
  });

  it("is skipped when the subtree remaps automatically", () => {
    expect(() =>
      new TreeFactory().createTreeFromXML(
        doc([`    <SubTree ID="Sub" _autoremap="true"/>`], goalPort)
      )
    ).not.toThrow();
  });

  it("does not affect a subtree that declares no model", () => {
    expect(() =>
      new TreeFactory().createTreeFromXML(doc([`    <SubTree ID="Sub"/>`], []))
    ).not.toThrow();
  });
});

describe("a model default", () => {
  // the tree from upstream's own test for this feature: the defaults have to
  // reach the subtree, not merely avoid the mandatory-port rejection
  const upstreamTree = [
    `<root mainTreeToExecute="MainTree" BTTS_format="4">`,
    `  <TreeNodesModel>`,
    `    <SubTree ID="MySub">`,
    `      <input_port name="in_value" default="42"/>`,
    `      <input_port name="in_name"/>`,
    `      <output_port name="out_result" default="{output}"/>`,
    `      <output_port name="out_state"/>`,
    `    </SubTree>`,
    `  </TreeNodesModel>`,
    ``,
    `  <BehaviorTree ID="MainTree">`,
    `    <Sequence>`,
    `      <Script code="my_name='john'"/>`,
    `      <SubTree ID="MySub" in_name="{my_name}" out_state="{my_state}"/>`,
    `      <ScriptCondition code="output==69 && my_state=='ACTIVE'"/>`,
    `    </Sequence>`,
    `  </BehaviorTree>`,
    ``,
    `  <BehaviorTree ID="MySub">`,
    `    <Sequence>`,
    `      <ScriptCondition code="in_name=='john' && in_value==42"/>`,
    `      <Script code="out_result=69; out_state='ACTIVE'"/>`,
    `    </Sequence>`,
    `  </BehaviorTree>`,
    `</root>`,
  ].join("\n");

  it("feeds the subtree the value it declared", async () => {
    const tree = new TreeFactory().createTreeFromXML(upstreamTree);
    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);

    // in_value defaults to the plain value 42, so it is a constant of the
    // subtree rather than something the outer tree provides
    const subtree = tree.subtrees.find((s) => s.id === "MySub")!;
    expect(subtree.blackboard.get("in_value")).toBe(42);
  });

  it("turns a default written as {key} into a remapping", async () => {
    // out_result defaults to "{output}", so the subtree's write lands on the
    // outer blackboard under 'output' and never as a constant of its own
    const tree = new TreeFactory().createTreeFromXML(upstreamTree);
    await tree.tickWhileRunning();
    expect(tree.rootBlackboard?.get("output")).toBe(69);
    expect(tree.rootBlackboard?.get("out_result")).toBeUndefined();
  });

  it("treats an empty default as no default at all", () => {
    // upstream tests defaultValueString().empty(), so default="" is mandatory
    const xml = doc(
      [`    <SubTree ID="Sub"/>`],
      [`    <SubTree ID="Sub">`, `      <input_port name="goal" default=""/>`, `    </SubTree>`]
    );
    expectRejectedAt(xml, "mandatory port called [goal]", 3, 5);
  });
});

describe("a model declared by an earlier document", () => {
  it("still applies after the factory loaded a different document", () => {
    const factory = new TreeFactory();
    factory.registerTreeFromXML(
      doc(
        [`    <AlwaysSuccess/>`],
        [`    <SubTree ID="Sub">`, `      <input_port name="goal"/>`, `    </SubTree>`]
      )
    );
    factory.clearRegisteredTrees();

    // the model outlives the document it came from, as it does upstream
    let e: unknown;
    try {
      factory.createTreeFromXML(doc([`    <SubTree ID="Sub"/>`], []));
    } catch (err) {
      e = err;
    }
    expect(e).toBeInstanceOf(XmlError);
    expect((e as XmlError).message).toContain("mandatory port called [goal]");
    expect((e as XmlError).line).toBe(3);
    expect((e as XmlError).column).toBe(5);
  });
});

describe("a malformed <TreeNodesModel>", () => {
  it("rejects a <SubTree> with no ID and points at it", () => {
    expectRejectedAt(
      doc([`    <SubTree ID="Sub" goal="{value}"/>`], [`    <SubTree>`, `    </SubTree>`]),
      "Missing attribute 'ID' in SubTree element within TreeNodesModel",
      9,
      5
    );
  });

  it("rejects a port with no name and points at it", () => {
    expectRejectedAt(
      doc(
        [`    <SubTree ID="Sub" goal="{value}"/>`],
        [`    <SubTree ID="Sub">`, `      <input_port/>`, `    </SubTree>`]
      ),
      "Missing attribute [name] in port (SubTree model)",
      10,
      7
    );
  });
});
