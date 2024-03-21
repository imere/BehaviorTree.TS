import { SyncActionNode } from "./ActionNode";
import { Blackboard } from "./Blackboard";
import { ConditionNode } from "./ConditionNode";
import { TreeFactory, blackboardBackup, blackboardRestore } from "./TreeFactory";
import { NodeConfig, assignDefaultRemapping } from "./TreeNode";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  createOutputPort,
  type NodeUserStatus,
} from "./basic";
import { SaySomething } from "./sample/DummyNodes";

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
        <Tree id="MainTree">
          <Sequence>
            <BB_TestNode in_port="11" out_port="{my_port}"/>
            <SetBlackboard value="-43" outputKey="my_port" />
          </Sequence>
        </Tree>
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
        <Tree id="MainTree">
          <Sequence>
            <BB_TestNode in_port="11"
                              out_port="{my_input_port}"/>

            <BB_TestNode in_port="{my_input_port}"
                          out_port="{my_input_port}" />

            <BB_TestNode in_port="{my_input_port}"
                          out_port="{my_output_port}" />
          </Sequence>
        </Tree>
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
        <Tree id="MainTree">
          <Sequence>
            <BB_TestNode inpuuuut_port="{value}" />
          </Sequence>
        </Tree>
      </root>
    `;

    expect(() => factory.createTreeFromXML(xml)).toThrow();
  });

  test("IssueSetBlackboard", async () => {
    const factory = new TreeFactory();

    const xml = `
      <root BTTS_format="4" >
        <Tree id="MySubtree">
          <ComparisonNode first="{value}" second="42" operator="==" />
        </Tree>

        <Tree id="MainTree">
          <Sequence>
            <SetBlackboard value="42" outputKey="value" />
            <Subtree id="MySubtree" value="{value}  "/>
          </Sequence>
        </Tree>
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
        <Tree id="MySubtree">
          <Sequence>
            <Script code=" important_value= sub_value " />
            <Script code=" my_value=false " />
            <SaySomething message="{message}" />
          </Sequence>
        </Tree>
        <Tree id="MainTree">
          <Sequence>
            <Script code=" my_value=true; another_value='hi' " />
            <Subtree id="MySubtree" sub_value="true" message="{another_value}" _autoremap="true" />
          </Sequence>
        </Tree>
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
});

describe("ParserTest", () => {
  test("BehaviorTree.CPPIssue605_whitespaces", async () => {
    const factory = new TreeFactory();

    const xml = `
      <root BTTS_format="4" >
        <Tree id="MySubtree">
          <SetBlackboard value="false" outputKey="sub_value" />
        </Tree>

        <Tree id="MainTree">
          <Sequence>
            <SetBlackboard value="true" outputKey="my_value" />
            <Subtree id="MySubtree" sub_value="{my_value}  "/>
          </Sequence>
        </Tree>
      </root>
    `;

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");
    const status = await tree.tickWhileRunning();

    expect(status).toBe(NodeStatus.SUCCESS);
    expect(tree.rootBlackboard?.get("my_value")).toBe(false);
  });
});
