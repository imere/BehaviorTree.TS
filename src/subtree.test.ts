import { SyncActionNode } from "./ActionNode";
import { Blackboard } from "./Blackboard";
import { TreeFactory } from "./TreeFactory";
import { NodeConfig } from "./TreeNode";
import {
  ImplementPorts,
  NodeStatus,
  NodeUserStatus,
  PortList,
  createInputPort,
  createOutputPort,
} from "./basic";
import { SaySomething } from "./sample/DummyNodes";
import { registerTestTick } from "./testing/helper";

@ImplementPorts
class CopyPorts extends SyncActionNode {
  static providedPorts() {
    return new PortList([createInputPort("in"), createOutputPort("out")]);
  }

  protected override tick(): NodeUserStatus {
    const msg = this.getInputOrThrow("in");
    this.setOutput("out", msg);
    return NodeStatus.SUCCESS;
  }
}

@ImplementPorts
class ReadInConstructor extends SyncActionNode {
  static providedPorts() {
    return new PortList([createInputPort("message")]);
  }

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.getInputOrThrow("message");
  }

  protected override tick(): NodeUserStatus {
    return NodeStatus.SUCCESS;
  }
}

@ImplementPorts
class Assert extends SyncActionNode {
  static providedPorts() {
    return new PortList([createInputPort("condition")]);
  }

  protected override tick(): NodeUserStatus {
    return this.getInput("condition") ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

@ImplementPorts
class PrintToConsole extends SyncActionNode {
  static providedPorts() {
    return new PortList([createInputPort("message")]);
  }

  constructor(name: string, config: NodeConfig, private print: (value: unknown) => void) {
    super(name, config);
  }

  protected override tick(): NodeUserStatus {
    const res = this.getInput("message");
    if (res) this.print(res);
    return res ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

describe("Subtree", () => {
  test("SiblingPorts_BehaviorTree.CPPIssue_72", () => {
    const xml = `
    <root BTTS_format="4" mainTreeToExecute="MainTree">
        <Tree id="MainTree">
            <Sequence>
                <Script code = " myParam='hello' " />
                <Subtree id="mySubtree" param="{myParam}" />
                <Script code = " myParam='world' " />
                <Subtree id="mySubtree" param="{myParam}" />
            </Sequence>
        </Tree>

        <Tree id="mySubtree">
                <SaySomething message="{param}" />
        </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);
    expect(tree.subtrees.length).toBe(3);
  });

  test("GoodRemapping", () => {
    const xml = `
    <root BTTS_format="4" mainTreeToExecute="MainTree">
        <Tree id="MainTree">
            <Sequence>
                <Script code = " thoughts='hello' " />
                <Subtree id="CopySubtree" in_arg="{thoughts}" out_arg="{greetings}" />
                <SaySomething message="{greetings}" />
            </Sequence>
        </Tree>

        <Tree id="CopySubtree">
                <CopyPorts in="{in_arg}" out="{out_arg}" />
        </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);
    factory.registerNodeType(CopyPorts, CopyPorts.name);

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);
  });

  test("BadRemapping", () => {
    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);
    factory.registerNodeType(CopyPorts, CopyPorts.name);

    const xml_text_bad_in = `
    <root BTTS_format="4" >
        <Tree id="MainTree">
            <Sequence>
                <Script code = " thoughts='hello' " />
                <Subtree id="CopySubtree" out_arg="{greetings}" />
                <SaySomething message="{greetings}" />
            </Sequence>
        </Tree>

        <Tree id="CopySubtree">
                <CopyPorts in="{in_arg}" out="{out_arg}" />
        </Tree>
    </root>
    `;

    factory.registerTreeFromXML(xml_text_bad_in);
    const tree_bad_in = factory.createTree("MainTree");
    expect(tree_bad_in.tickWhileRunning()).rejects.toThrow();

    const xml_text_bad_out = `
    <root BTTS_format="4" >
        <Tree id="MainTree">
            <Sequence>
                <Script code = " thoughts='hello' " />
                <Subtree id="CopySubtree" in_arg="{thoughts}" />
                <SaySomething message="{greetings}" />
            </Sequence>
        </Tree>

        <Tree id="CopySubtree">
                <CopyPorts in="{in_arg}" out="{out_arg}" />
        </Tree>
    </root>
    `;

    factory.registerTreeFromXML(xml_text_bad_out);
    const tree_bad_out = factory.createTree("MainTree");
    expect(tree_bad_out.tickWhileRunning()).rejects.toThrow();
  });

  test("BadRemapping", () => {
    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);
    factory.registerNodeType(CopyPorts, CopyPorts.name);

    const xml_text_bad_in = `
    <root BTTS_format="4" >
        <Tree id="MainTree">
            <Sequence>
                <Script code = " thoughts='hello' " />
                <Subtree id="CopySubtree" out_arg="{greetings}" />
                <SaySomething message="{greetings}" />
            </Sequence>
        </Tree>

        <Tree id="CopySubtree">
                <CopyPorts in="{in_arg}" out="{out_arg}" />
        </Tree>
    </root>
    `;

    factory.registerTreeFromXML(xml_text_bad_in);
    const tree_bad_in = factory.createTree("MainTree");
    expect(tree_bad_in.tickWhileRunning()).rejects.toThrow();

    const xml_text_bad_out = `
    <root BTTS_format="4" >
        <Tree id="MainTree">
            <Sequence>
                <Script code = " thoughts='hello' " />
                <Subtree id="CopySubtree" in_arg="{thoughts}" />
                <SaySomething message="{greetings}" />
            </Sequence>
        </Tree>

        <Tree id="CopySubtree">
                <CopyPorts in="{in_arg}" out="{out_arg}" />
        </Tree>
    </root>
    `;

    factory.registerTreeFromXML(xml_text_bad_out);
    const tree_bad_out = factory.createTree("MainTree");
    expect(tree_bad_out.tickWhileRunning()).rejects.toThrow();
  });

  test("SubtreePlusA", () => {
    const xml = `
    <root BTTS_format="4" >
        <Tree id="MainTree">
            <Sequence>
                <Script code = " myParam='hello' " />
                <Subtree id="mySubtree" param="{myParam}" />
                <Subtree id="mySubtree" param="World" />
                <Script code = " param='Auto remapped' " />
                <Subtree id="mySubtree" _autoremap="true" />
            </Sequence>
        </Tree>

        <Tree id="mySubtree">
          <SaySomething message="{param}" />
        </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);
  });

  test("SubtreePlusB", () => {
    const xml = `
    <root BTTS_format="4" >
        <Tree id="MainTree">
            <Sequence>
                <Script code = " myParam='Hello World';param3='Auto remapped' " />
                <Subtree id="mySubtree" _autoremap="true"  param1="{myParam}" param2="Straight Talking" />
            </Sequence>
        </Tree>

        <Tree id="mySubtree">
          <Sequence>
            <SaySomething message="{param1}" />
            <SaySomething message="{param2}" />
            <SaySomething message="{param3}" />
          </Sequence>
        </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);
  });

  test("SubtreePlusD", () => {
    const config = new NodeConfig();
    config.blackboard = Blackboard.create();

    const xml = `
    <root BTTS_format="4" >
        <Tree id="MainTree">
            <Sequence>
                <Subtree id="mySubtree" _autoremap="true" />
            </Sequence>
        </Tree>

        <Tree id="mySubtree">
          <ReadInConstructor message="{message}" />
        </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(ReadInConstructor, ReadInConstructor.name);
    config.blackboard.set("message", "hello");

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree", config.blackboard);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);
  });

  test("ScriptRemap", async () => {
    const xml = `
    <root BTTS_format="4" >
        <Tree id="MainTree">
            <Sequence>
                <Script code="value=0" />
                <Subtree id="mySubtree" value="{value}" />
            </Sequence>
        </Tree>

        <Tree id="mySubtree">
          <Script code="value=1" />
        </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerTreeFromXML(xml);

    const tree = factory.createTree("MainTree");
    await tree.tickOnce();

    expect(tree.subtrees.map((_) => _.blackboard.get("value"))).toEqual([1, 1]);
  });

  test("SubtreeBehaviorTree.CPPIssue592", () => {
    const xml = `
    <root BTTS_format="4" >
        <Tree id="Outer_Tree">
          <Sequence>
            <Script code="variable='test'" />
            <Script code="va='test'" />
            <Subtree id="Inner_Tree" _autoremap="false" variable="{va}" />
            <Subtree id="Inner_Tree" _autoremap="true" />
          </Sequence>
        </Tree>
            
        <Tree id="Inner_Tree">
          <Sequence>
            <TestA _skipIf="variable !== 'test'"/>
          </Sequence>
        </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    const counters = Array.from<number>({ length: 1 });
    registerTestTick(factory, "Test", counters);

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("Outer_Tree");

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);
    expect(counters).toEqual([2]);
  });

  test("BehaviorTree.CPPIssue653_SetBlackboard", () => {
    const xml = `
    <root BTTS_format="4" mainTreeToExecute = "MainTree">
        <Tree id="MainTree">
          <Sequence>
            <Subtree id="Init" test="{test}" />
            <Assert condition="{test}" />
          </Sequence>
        </Tree>
            
        <Tree id="Init">
          <SetBlackboard outputKey="test" value="true"/>
        </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(Assert, Assert.name);
    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBeDefined();
  });

  test("RemappingBehaviorTree.CPPIssue696", () => {
    const xml = `
    <root BTTS_format="4" mainTreeToExecute = "MainTree">
      <Tree id="Subtree1">
        <Sequence>
          <PrintToConsole message="{msg1}"/>
          <PrintToConsole message="{msg2}"/>
        </Sequence>
      </Tree>

      <Tree id="Subtree2">
        <Sequence>
          <Subtree id="Subtree1" msg1="foo1" _autoremap="true"/>
          <Subtree id="Subtree1" msg1="foo2" _autoremap="true"/>
        </Sequence>
      </Tree>

      <Tree id="MainTree">
        <Sequence>
          <Subtree id="Subtree2" msg2="bar" />
        </Sequence>
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    const lines: unknown[] = [];
    factory.registerNodeType(PrintToConsole, PrintToConsole.name, lines.push.bind(lines));

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");

    expect(tree.tickWhileRunning()).resolves.toBeDefined();
    expect(lines).toEqual(["foo1", "bar", "foo2", "bar"]);
  });

  test("PrivateAutoRemapping", () => {
    const xml = `
    <root BTTS_format="4" mainTreeToExecute = "MainTree">
      <Tree id="Subtree">
        <Sequence>
          <SetBlackboard outputKey="public_value" value='"hello"'/>
          <SetBlackboard outputKey="_private_value" value='"world"'/>
        </Sequence>
      </Tree>

      <Tree id="MainTree">
        <Sequence>
          <Subtree id="Subtree" _autoremap="true" />
          <PrintToConsole message="{public_value}"/>
          <PrintToConsole message="{_private_value}"/>
        </Sequence>
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    const lines: unknown[] = [];
    factory.registerNodeType(PrintToConsole, PrintToConsole.name, lines.push.bind(lines));

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.FAILURE);
    expect(lines).toEqual(["hello"]);
  });
});
