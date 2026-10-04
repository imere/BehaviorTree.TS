import { SyncActionNode } from "./ActionNode.js";
import { Blackboard } from "./Blackboard.js";
import { ConditionNode } from "./ConditionNode.js";
import { TreeFactory, blackboardBackup, blackboardRestore } from "./TreeFactory.js";
import { NodeConfig, assignDefaultRemapping } from "./TreeNode.js";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  createOutputPort,
  type NodeUserStatus,
} from "./basic.js";
import { SaySomething } from "./sample/DummyNodes.js";
import { now } from "./utils/date-time.js";

@ImplementPorts
class BB_TestNode extends SyncActionNode {
  static providedPorts() {
    return new PortList([createInputPort("in_port"), createOutputPort("out_port")]);
  }

  protected override tick(): NodeUserStatus {
    let value = this.getInputOrThrow("in_port", Number);
    value = value * 2;
    this.setOutput("out_port", value);
    return NodeStatus.SUCCESS;
  }
}

@ImplementPorts
class ComparisonNode extends ConditionNode {
  static providedPorts() {
    return new PortList([
      createInputPort("first"),
      createInputPort("second"),
      createInputPort("operator"),
    ]);
  }

  protected override tick(): NodeUserStatus {
    const firstValue = this.getInputOrThrow("first", Number);
    const secondValue = this.getInputOrThrow("second", Number);
    const inputOperator = this.getInputOrThrow("operator");
    switch (true) {
      case inputOperator === "==" && firstValue == secondValue:
      case inputOperator === "!=" && firstValue != secondValue:
      case inputOperator === "<=" && firstValue <= secondValue:
      case inputOperator === ">=" && firstValue >= secondValue:
      case inputOperator === "<" && firstValue < secondValue:
      case inputOperator === ">" && firstValue > secondValue:
        return NodeStatus.SUCCESS;
    }
    return NodeStatus.FAILURE;
  }
}

describe("BlackboardTest", () => {
  test("GetInputsFromBlackboard", () => {
    const bb = Blackboard.create();

    const config = new NodeConfig();
    assignDefaultRemapping(BB_TestNode, config);

    config.blackboard = bb;
    bb.set("in_port", 11);

    const node = new BB_TestNode("good_one", config);

    // this should read and write "my_entry" in tick()
    node.executeTick();

    expect(bb.get("out_port")).toEqual(22);
  });

  test("BasicRemapping", () => {
    const bb = Blackboard.create();

    const config = new NodeConfig();
    config.blackboard = bb;
    config.input.set("in_port", "{my_input_port}");
    config.output.set("out_port", "{my_output_port}");
    bb.set("my_input_port", 11);

    const node = new BB_TestNode("good_one", config);
    node.executeTick();

    expect(bb.get("my_output_port")).toEqual(22);
  });

  test("GetInputsFromText", () => {
    const bb = Blackboard.create();

    const config = new NodeConfig();
    config.input.set("in_port", "11");

    const missing_out = new BB_TestNode("missing_out", config);
    expect(() => missing_out.executeTick()).toThrow();

    config.blackboard = bb;
    config.output.set("out_port", "{=}");

    const node = new BB_TestNode("good_one", config);
    node.executeTick();

    expect(bb.get("out_port")).toEqual(22);
  });

  test("SetOutputFromText", async () => {
    const xml = `
      <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
          <Sequence>
            <BB_TestNode in_port="11" out_port="{my_port}"/>
            <SetBlackboard value="-43" outputKey="my_port" />
          </Sequence>
        </BehaviorTree>
      </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(BB_TestNode, BB_TestNode.name);

    const bb = Blackboard.create();

    const tree = factory.createTreeFromXML(xml, bb);
    await tree.tickWhileRunning();
  });

  test("WithFactory", async () => {
    const factory = new TreeFactory();
    factory.registerNodeType(BB_TestNode, BB_TestNode.name);

    const xml = `
      <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
          <Sequence>
            <BB_TestNode in_port="11"
                              out_port="{my_input_port}"/>

            <BB_TestNode in_port="{my_input_port}"
                          out_port="{my_input_port}" />

            <BB_TestNode in_port="{my_input_port}"
                          out_port="{my_output_port}" />
          </Sequence>
        </BehaviorTree>
      </root>
    `;

    const bb = Blackboard.create();

    const tree = factory.createTreeFromXML(xml, bb);
    const status = await tree.tickWhileRunning();

    expect(status).toBe(NodeStatus.SUCCESS);
    expect(bb.get("my_input_port")).toBe(44);
    expect(bb.get("my_output_port")).toBe(88);
  });

  test("TypoInPortName", async () => {
    const factory = new TreeFactory();
    factory.registerNodeType(BB_TestNode, BB_TestNode.name);

    const xml = `
      <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
          <Sequence>
            <BB_TestNode inpuuuut_port="{value}" />
          </Sequence>
        </BehaviorTree>
      </root>
    `;

    expect(() => factory.createTreeFromXML(xml)).toThrow();
  });

  test("IssueSetBlackboard", async () => {
    const factory = new TreeFactory();

    const xml = `
      <root BTTS_format="4" >
        <BehaviorTree ID="MySubtree">
          <ComparisonNode first="{value}" second="42" operator="==" />
        </BehaviorTree>

        <BehaviorTree ID="MainTree">
          <Sequence>
            <SetBlackboard value="42" outputKey="value" />
            <SubTree ID="MySubtree" value="{value}  "/>
          </Sequence>
        </BehaviorTree>
      </root>
    `;

    factory.registerNodeType(ComparisonNode, ComparisonNode.name);
    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");
    const status = await tree.tickWhileRunning();

    expect(status).toBe(NodeStatus.SUCCESS);
    expect(tree.rootBlackboard?.get("value")).toBe(42);
  });

  test("NullOutputRemapping", async () => {
    const bb = Blackboard.create();

    const config = new NodeConfig();
    config.blackboard = bb;
    config.input.set("in_port", "{my_input_port}");
    config.output.set("out_port", "");
    bb.set("my_input_port", 11);

    const node = new BB_TestNode("good_one", config);

    expect(() => node.executeTick()).toThrow();
  });

  test("BlackboardBackup", async () => {
    const factory = new TreeFactory();

    const xml = `
      <root BTTS_format="4" >
        <BehaviorTree ID="MySubtree">
          <Sequence>
            <Script code=" important_value= sub_value " />
            <Script code=" my_value=false " />
            <SaySomething message="{message}" />
          </Sequence>
        </BehaviorTree>
        <BehaviorTree ID="MainTree">
          <Sequence>
            <Script code=" my_value=true; another_value='hi' " />
            <SubTree ID="MySubtree" sub_value="true" message="{another_value}" _autoremap="true" />
          </Sequence>
        </BehaviorTree>
      </root>
    `;

    factory.registerNodeType(SaySomething, SaySomething.name);
    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");

    // Blackboard Backup
    const bbBackup = blackboardBackup(tree);

    const expectedKeys: PropertyKey[][] = [];
    for (const sub of tree.subtrees) {
      expectedKeys.push([...sub.blackboard.keys()]);
    }

    let status = await tree.tickWhileRunning();

    expect(status).toBe(NodeStatus.SUCCESS);

    // Restore Blackboard
    expect(bbBackup.length).toBe(tree.subtrees.length);
    blackboardRestore(bbBackup, tree);

    for (let i = 0; i < tree.subtrees.length; i++) {
      const keys = [...tree.subtrees[i].blackboard.keys()];
      expect(expectedKeys[i].length).toBe(keys.length);
      for (let a = 0; a < keys.length; a++) {
        expect(expectedKeys[i][a]).toBe(keys[a]);
      }
    }

    status = await tree.tickWhileRunning();
    expect(status).toBe(NodeStatus.SUCCESS);
  });

  test("RootBlackboard", async () => {
    const factory = new TreeFactory();

    const xml = `
      <root BTTS_format="4" >
        <BehaviorTree ID="SubA">
          <Sequence>
            <SubTree ID="SubB" />
            <Script code=" _B_var3=3 " />
          </Sequence>
        </BehaviorTree>
    
        <BehaviorTree ID="SubB">
          <Sequence>
            <SaySomething message="{_B_msg}" />
            <Script code=" _B_var4=4 " />
          </Sequence>
        </BehaviorTree>
    
        <BehaviorTree ID="MainTree">
          <Sequence>
            <Script code=" msg='hello' " />
            <SubTree ID="SubA" />
    
            <Script code=" var1=1 " />
            <Script code=" _B_var2=2 " />
          </Sequence>
        </BehaviorTree>
      </root>
    `;

    factory.registerNodeType(SaySomething, SaySomething.name);
    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");

    const status = await tree.tickWhileRunning();
    expect(status).toBe(NodeStatus.SUCCESS);

    expect(tree.rootBlackboard!.get("var1")).toBe(1);
    expect(tree.rootBlackboard!.get("var2")).toBe(2);
    expect(tree.rootBlackboard!.get("var3")).toBe(3);
    expect(tree.rootBlackboard!.get("var4")).toBe(4);
  });

  test("TimestampedInterface", () => {
    const bb = Blackboard.create();

    // still empty, expected to fail
    expect(bb.getStamped("value")).not.toBeDefined();

    // set() stamps with its own Date.now() call, so the stamp can only be
    // pinned to the window the set happened in, not to one exact millisecond
    let before = now();
    bb.set("value", 42);
    let after = now();
    let result = bb.getStamped("value");
    let value = result?.value;
    let stamp_opt = result?.stamp;

    expect(result?.value).toBe(42);
    expect(result?.stamp.seq).toBe(1);
    expect(result?.stamp.time).toBeGreaterThanOrEqual(before);
    expect(result?.stamp.time).toBeLessThanOrEqual(after);

    expect(value).toBe(42);
    expect(stamp_opt).toBeDefined();
    expect(stamp_opt?.seq).toBe(1);
    expect(stamp_opt?.time).toBeGreaterThanOrEqual(before);
    expect(stamp_opt?.time).toBeLessThanOrEqual(after);

    before = now();
    bb.set("value", 69);
    after = now();
    result = bb.getStamped("value");
    value = result?.value;
    stamp_opt = result?.stamp;

    expect(result?.value).toBe(69);
    expect(result?.stamp.seq).toBe(2);
    expect(result?.stamp.time).toBeGreaterThanOrEqual(before);
    expect(result?.stamp.time).toBeLessThanOrEqual(after);

    expect(value).toBe(69);
    expect(stamp_opt).toBeDefined();
    expect(stamp_opt?.seq).toBe(2);
    expect(stamp_opt?.time).toBeGreaterThanOrEqual(before);
    expect(stamp_opt?.time).toBeLessThanOrEqual(after);
  });
});

describe("ParserTest", () => {
  test("BehaviorTree.CPPIssue605_whitespaces", async () => {
    const factory = new TreeFactory();

    const xml = `
      <root BTTS_format="4" >
        <BehaviorTree ID="MySubtree">
          <SetBlackboard value="false" outputKey="sub_value" />
        </BehaviorTree>

        <BehaviorTree ID="MainTree">
          <Sequence>
            <SetBlackboard value="true" outputKey="my_value" />
            <SubTree ID="MySubtree" sub_value="{my_value}  "/>
          </Sequence>
        </BehaviorTree>
      </root>
    `;

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");
    const status = await tree.tickWhileRunning();

    expect(status).toBe(NodeStatus.SUCCESS);
    expect(tree.rootBlackboard?.get("my_value")).toBe(false);
  });
});

describe("BehaviorTree.CPPIssue955_SetBlackboard", () => {
  const xml = (value: string) => `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
        <SetBlackboard value="${value}" outputKey="target"/>
      </BehaviorTree>
    </root>
  `;

  async function run(value: string) {
    const factory = new TreeFactory();
    factory.registerTreeFromXML(xml(value));
    const tree = factory.createTree("MainTree");
    return tree.tickExactlyOnce().then((status) => ({ status, bb: tree.rootBlackboard! }));
  }

  test("a literal value is written", async () => {
    const { status, bb } = await run("42");
    expect(status).toBe(NodeStatus.SUCCESS);
    expect(bb.get("target")).toBe(42);
  });

  test("an unset source entry fails instead of writing undefined", async () => {
    const { status, bb } = await run("{never_set}");
    expect(status).toBe(NodeStatus.FAILURE);
    expect(bb.get("target")).toBeUndefined();
  });

  test("both branches bump sequence_id and the timestamp", async () => {
    const literal = new TreeFactory();
    literal.registerTreeFromXML(xml("42"));
    const litTree = literal.createTree("MainTree");
    await litTree.tickExactlyOnce();
    const litEntry = litTree.rootBlackboard!.getEntry("target")!;
    expect(litEntry.sequence_id).toBe(1);
    expect(litEntry.stamp).toBeGreaterThan(0);

    const factory = new TreeFactory();
    factory.registerTreeFromXML(`
      <root BTTS_format="4">
        <BehaviorTree ID="MainTree">
          <SetBlackboard value="{source}" outputKey="target"/>
        </BehaviorTree>
      </root>
    `);
    const tree = factory.createTree("MainTree");
    tree.rootBlackboard!.set("source", 7);
    await tree.tickExactlyOnce();

    // a direct entry write would leave sequence_id at 0
    const entry = tree.rootBlackboard!.getEntry("target")!;
    expect(entry.value).toBe(7);
    expect(entry.sequence_id).toBe(1);
    expect(entry.stamp).toBeGreaterThan(0);
  });
});
