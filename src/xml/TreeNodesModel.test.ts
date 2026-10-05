import { describe, expect, it } from "vitest";
import { NodeStatus } from "../basic.js";
import { TreeFactory } from "../TreeFactory.js";
import { XmlError } from "./XmlError.js";

/** TEST(SubTree, SubtreeModels) */
const subtreeModels = [
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

function create(xml: string) {
  return new TreeFactory().createTreeFromXML(xml);
}

describe("TEST(SubTree, SubtreeModels)", () => {
  it("builds and ticks the tree upstream builds", async () => {
    const tree = create(subtreeModels);
    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
  });

  it("feeds the subtree the constant its default declared", async () => {
    // in_value defaults to the plain value 42, so it is a constant of the
    // subtree rather than something the outer tree provides
    const tree = create(subtreeModels);
    await tree.tickWhileRunning();
    const subtree = tree.subtrees.find((s) => s.id === "MySub")!;
    expect(subtree.blackboard.get("in_value")).toBe(42);
  });

  it("treats a default written as {key} as a remapping", async () => {
    // out_result defaults to "{output}", so the subtree's write lands on the
    // outer blackboard under 'output' and never as a constant of its own
    const tree = create(subtreeModels);
    await tree.tickWhileRunning();
    expect(tree.rootBlackboard?.get("output")).toBe(69);
    expect(tree.rootBlackboard?.get("out_result")).toBeUndefined();
  });
});

describe("TEST(SubTree, SubtreeModels) without the remapping upstream provides", () => {
  // the same document with in_name left out, which the model declares without a
  // default, so nothing can satisfy it
  const missingPort = subtreeModels.replace(
    `<SubTree ID="MySub" in_name="{my_name}" out_state="{my_state}"/>`,
    `<SubTree ID="MySub" out_state="{my_state}"/>`
  );

  it("is rejected as a mandatory port, and points at the <SubTree>", () => {
    let e: unknown;
    try {
      create(missingPort);
    } catch (err) {
      e = err;
    }
    expect(e).toBeInstanceOf(XmlError);
    expect((e as XmlError).message).toContain(
      `the <SubTree ID="MySub"> is defining a mandatory port called [in_name]`
    );
    expect((e as XmlError).line).toBe(14);
    expect((e as XmlError).column).toBe(7);
  });
});

describe("BUG-7: a <SubTree> in a <TreeNodesModel> with no ID", () => {
  // gtest_xml_null_subtree_id.cpp; before a557f3c this indexed the model map
  // with a null key
  const xml = [
    `<root BTTS_format="4">`,
    `  <BehaviorTree ID="MainTree">`,
    `    <AlwaysSuccess/>`,
    `  </BehaviorTree>`,
    `  <TreeNodesModel>`,
    `    <SubTree>`,
    `      <input_port name="some_port"/>`,
    `    </SubTree>`,
    `  </TreeNodesModel>`,
    `</root>`,
  ].join("\n");

  it("is rejected by name, and points at the <SubTree>", () => {
    let e: unknown;
    try {
      new TreeFactory().registerTreeFromXML(xml);
    } catch (err) {
      e = err;
    }
    expect(e).toBeInstanceOf(XmlError);
    expect((e as XmlError).message).toContain(
      "Missing attribute 'ID' in SubTree element within TreeNodesModel"
    );
    expect((e as XmlError).line).toBe(6);
    expect((e as XmlError).column).toBe(5);
  });
});
