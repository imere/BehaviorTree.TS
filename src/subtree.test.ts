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

  constructor(
    name: string,
    config: NodeConfig,
    private print: (value: unknown) => void
  ) {
    super(name, config);
  }

  protected override tick(): NodeUserStatus {
    const res = this.getInput("message");
    if (res) this.print(res);
    return res ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

describe("Subtree", () => {
  test("SiblingPorts_BehaviorTree.CPPIssue_72", async () => {
    const xml = `
    <root BTTS_format="4" mainTreeToExecute="MainTree">
        <BehaviorTree ID="MainTree">
            <Sequence>
                <Script code = " myParam='hello' " />
                <SubTree ID="mySubtree" param="{myParam}" />
                <Script code = " myParam='world' " />
                <SubTree ID="mySubtree" param="{myParam}" />
            </Sequence>
        </BehaviorTree>

        <BehaviorTree ID="mySubtree">
                <SaySomething message="{param}" />
        </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);

    const tree = factory.createTreeFromXML(xml);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(tree.subtrees.length).toBe(3);
  });

  test("GoodRemapping", async () => {
    const xml = `
    <root BTTS_format="4" mainTreeToExecute="MainTree">
        <BehaviorTree ID="MainTree">
            <Sequence>
                <Script code = " thoughts='hello' " />
                <SubTree ID="CopySubtree" in_arg="{thoughts}" out_arg="{greetings}" />
                <SaySomething message="{greetings}" />
            </Sequence>
        </BehaviorTree>

        <BehaviorTree ID="CopySubtree">
                <CopyPorts in="{in_arg}" out="{out_arg}" />
        </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);
    factory.registerNodeType(CopyPorts, CopyPorts.name);

    const tree = factory.createTreeFromXML(xml);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
  });

  test("BadRemapping", () => {
    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);
    factory.registerNodeType(CopyPorts, CopyPorts.name);

    const xml_text_bad_in = `
    <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
            <Sequence>
                <Script code = " thoughts='hello' " />
                <SubTree ID="CopySubtree" out_arg="{greetings}" />
                <SaySomething message="{greetings}" />
            </Sequence>
        </BehaviorTree>

        <BehaviorTree ID="CopySubtree">
                <CopyPorts in="{in_arg}" out="{out_arg}" />
        </BehaviorTree>
    </root>
    `;

    factory.registerTreeFromXML(xml_text_bad_in);
    const tree_bad_in = factory.createTree("MainTree");
    expect(tree_bad_in.tickWhileRunning()).rejects.toThrow();

    const xml_text_bad_out = `
    <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
            <Sequence>
                <Script code = " thoughts='hello' " />
                <SubTree ID="CopySubtree" in_arg="{thoughts}" />
                <SaySomething message="{greetings}" />
            </Sequence>
        </BehaviorTree>

        <BehaviorTree ID="CopySubtree">
                <CopyPorts in="{in_arg}" out="{out_arg}" />
        </BehaviorTree>
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
        <BehaviorTree ID="MainTree">
            <Sequence>
                <Script code = " thoughts='hello' " />
                <SubTree ID="CopySubtree" out_arg="{greetings}" />
                <SaySomething message="{greetings}" />
            </Sequence>
        </BehaviorTree>

        <BehaviorTree ID="CopySubtree">
                <CopyPorts in="{in_arg}" out="{out_arg}" />
        </BehaviorTree>
    </root>
    `;

    factory.registerTreeFromXML(xml_text_bad_in);
    const tree_bad_in = factory.createTree("MainTree");
    expect(tree_bad_in.tickWhileRunning()).rejects.toThrow();

    const xml_text_bad_out = `
    <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
            <Sequence>
                <Script code = " thoughts='hello' " />
                <SubTree ID="CopySubtree" in_arg="{thoughts}" />
                <SaySomething message="{greetings}" />
            </Sequence>
        </BehaviorTree>

        <BehaviorTree ID="CopySubtree">
                <CopyPorts in="{in_arg}" out="{out_arg}" />
        </BehaviorTree>
    </root>
    `;

    factory.registerTreeFromXML(xml_text_bad_out);
    const tree_bad_out = factory.createTree("MainTree");
    expect(tree_bad_out.tickWhileRunning()).rejects.toThrow();
  });

  test("SubtreePlusA", async () => {
    const xml = `
    <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
            <Sequence>
                <Script code = " myParam='hello' " />
                <SubTree ID="mySubtree" param="{myParam}" />
                <SubTree ID="mySubtree" param="World" />
                <Script code = " param='Auto remapped' " />
                <SubTree ID="mySubtree" _autoremap="true" />
            </Sequence>
        </BehaviorTree>

        <BehaviorTree ID="mySubtree">
          <SaySomething message="{param}" />
        </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
  });

  test("SubtreePlusB", async () => {
    const xml = `
    <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
            <Sequence>
                <Script code = " myParam='Hello World';param3='Auto remapped' " />
                <SubTree ID="mySubtree" _autoremap="true"  param1="{myParam}" param2="Straight Talking" />
            </Sequence>
        </BehaviorTree>

        <BehaviorTree ID="mySubtree">
          <Sequence>
            <SaySomething message="{param1}" />
            <SaySomething message="{param2}" />
            <SaySomething message="{param3}" />
          </Sequence>
        </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
  });

  test("SubtreePlusD", async () => {
    const config = new NodeConfig();
    config.blackboard = Blackboard.create();

    const xml = `
    <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
            <Sequence>
                <SubTree ID="mySubtree" _autoremap="true" />
            </Sequence>
        </BehaviorTree>

        <BehaviorTree ID="mySubtree">
          <ReadInConstructor message="{message}" />
        </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(ReadInConstructor, ReadInConstructor.name);
    config.blackboard.set("message", "hello");

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree", config.blackboard);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
  });

  test("ScriptRemap", async () => {
    const xml = `
    <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
            <Sequence>
                <Script code="value=0" />
                <SubTree ID="mySubtree" value="{value}" />
            </Sequence>
        </BehaviorTree>

        <BehaviorTree ID="mySubtree">
          <Script code="value=1" />
        </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerTreeFromXML(xml);

    const tree = factory.createTree("MainTree");
    await tree.tickOnce();

    expect(tree.subtrees.map((_) => _.blackboard.get("value"))).toEqual([1, 1]);
  });

  test("SubtreeBehaviorTree.CPPIssue592", async () => {
    const xml = `
    <root BTTS_format="4" >
        <BehaviorTree ID="Outer_Tree">
          <Sequence>
            <Script code="variable='test'" />
            <Script code="va='test'" />
            <SubTree ID="Inner_Tree" _autoremap="false" variable="{va}" />
            <SubTree ID="Inner_Tree" _autoremap="true" />
          </Sequence>
        </BehaviorTree>
            
        <BehaviorTree ID="Inner_Tree">
          <Sequence>
            <TestA _skipIf="variable !== 'test'"/>
          </Sequence>
        </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    const counters = Array.from<number>({ length: 1 });
    registerTestTick(factory, "Test", counters);

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("Outer_Tree");

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters).toEqual([2]);
  });

  test("BehaviorTree.CPPIssue653_SetBlackboard", async () => {
    const xml = `
    <root BTTS_format="4" mainTreeToExecute = "MainTree">
        <BehaviorTree ID="MainTree">
          <Sequence>
            <SubTree ID="Init" test="{test}" />
            <Assert condition="{test}" />
          </Sequence>
        </BehaviorTree>
            
        <BehaviorTree ID="Init">
          <SetBlackboard outputKey="test" value="true"/>
        </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(Assert, Assert.name);
    const tree = factory.createTreeFromXML(xml);

    expect(await tree.tickWhileRunning()).toBeDefined();
  });

  test("RemappingBehaviorTree.CPPIssue696", async () => {
    const xml = `
    <root BTTS_format="4" mainTreeToExecute = "MainTree">
      <BehaviorTree ID="Subtree1">
        <Sequence>
          <PrintToConsole message="{msg1}"/>
          <PrintToConsole message="{msg2}"/>
        </Sequence>
      </BehaviorTree>

      <BehaviorTree ID="Subtree2">
        <Sequence>
          <SubTree ID="Subtree1" msg1="foo1" _autoremap="true"/>
          <SubTree ID="Subtree1" msg1="foo2" _autoremap="true"/>
        </Sequence>
      </BehaviorTree>

      <BehaviorTree ID="MainTree">
        <Sequence>
          <SubTree ID="Subtree2" msg2="bar" />
        </Sequence>
      </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    const lines: unknown[] = [];
    factory.registerNodeType(PrintToConsole, PrintToConsole.name, lines.push.bind(lines));

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");

    expect(await tree.tickWhileRunning()).toBeDefined();
    expect(lines).toEqual(["foo1", "bar", "foo2", "bar"]);
  });

  test("PrivateAutoRemapping", async () => {
    const xml = `
    <root BTTS_format="4" mainTreeToExecute = "MainTree">
      <BehaviorTree ID="Subtree">
        <Sequence>
          <SetBlackboard outputKey="public_value" value='"hello"'/>
          <SetBlackboard outputKey="_private_value" value='"world"'/>
        </Sequence>
      </BehaviorTree>

      <BehaviorTree ID="MainTree">
        <Sequence>
          <SubTree ID="Subtree" _autoremap="true" />
          <PrintToConsole message="{public_value}"/>
          <PrintToConsole message="{_private_value}"/>
        </Sequence>
      </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    const lines: unknown[] = [];
    factory.registerNodeType(PrintToConsole, PrintToConsole.name, lines.push.bind(lines));

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.FAILURE);
    expect(lines).toEqual(["hello"]);
  });

  test("SubtreeNameNotRegistered", async () => {
    const xml = `
    <root BTTS_format="4">
      <BehaviorTree ID="PrintToConsole">\n
        <Sequence>
          <PrintToConsole message="world"/>
        </Sequence>
      </BehaviorTree>
      <BehaviorTree ID="MainTree">
        <Sequence>
          <PrintToConsole message="hello"/>
          <SubTree ID="PrintToConsole"/>
        </Sequence>
      </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    const lines: unknown[] = [];
    factory.registerNodeType(PrintToConsole, PrintToConsole.name, lines.push.bind(lines));

    expect(() => factory.createTreeFromXML(xml)).toThrow();
    expect(() => factory.registerTreeFromXML(xml)).toThrow();
  });
});
