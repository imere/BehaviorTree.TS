import { SyncActionNode } from "./ActionNode";
import { TreeFactory } from "./TreeFactory";
import { NodeConfig } from "./TreeNode";
import { ImplementPorts, NodeStatus, NodeUserStatus, PortList, createInputPort } from "./basic";

describe("PortTest", () => {
  @ImplementPorts
  class NodeWithPorts extends SyncActionNode {
    static providedPorts() {
      return new PortList([
        createInputPort("in_port_A", "magic_number", 42),
        createInputPort("in_port_B"),
      ]);
    }

    protected override tick(): NodeUserStatus {
      try {
        const val_A = this.getInputOrThrow("in_port_A", Number);
        const val_B = this.getInputOrThrow("in_port_B", Number);
        if (val_A === 42 && val_B === 66) return NodeStatus.SUCCESS;
        return NodeStatus.FAILURE;
      } catch {
        return NodeStatus.FAILURE;
      }
    }
  }

  test("DefaultPorts", () => {
    const xml = `
    <root BTTS_format="4" >
      <Tree id="MainTree">
        <Sequence>
          <NodeWithPorts in_port_B="66" />
        </Sequence>
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(NodeWithPorts, NodeWithPorts.name);

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);
  });

  test("MissingPort", () => {
    const xml = `
    <root BTTS_format="4" >
      <Tree id="MainTree">
        <Sequence>
          <NodeWithPorts />
        </Sequence>
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(NodeWithPorts, NodeWithPorts.name);

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.FAILURE);
  });

  test("WrongPort", () => {
    const xml = `
    <root BTTS_format="4" >
      <Tree id="MainTree">
        <Sequence>
          <NodeWithPorts da_port="66" />
        </Sequence>
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(NodeWithPorts, NodeWithPorts.name);

    expect(() => factory.createTreeFromXML(xml)).toThrow();
  });

  test("Descriptions", () => {
    const xml = `
    <root BTTS_format="4" >
      <Tree id="MainTree" _description="this is my tree" >
          <Sequence>
              <NodeWithPorts name="first"  in_port_B="66" _description="this is my action" />
              <Subtree id="SubTree" name="second" _description="this is a subtree"/>
          </Sequence>
      </Tree>

      <Tree id="SubTree" _description="this is a subtree" >
          <NodeWithPorts name="third" in_port_B="99" />
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(NodeWithPorts, NodeWithPorts.name);

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("MainTree");

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.FAILURE); // failure because in_port_B="99"
  });

  @ImplementPorts
  class NodeInPorts extends SyncActionNode {
    static providedPorts() {
      return new PortList([createInputPort("int_port"), createInputPort("any_port")]);
    }

    protected override tick(): NodeUserStatus {
      try {
        this.getInputOrThrow("int_port");
        this.getInputOrThrow("any_port");
        return NodeStatus.SUCCESS;
      } catch {
        return NodeStatus.FAILURE;
      }
    }
  }

  @ImplementPorts
  class NodeOutPorts extends SyncActionNode {
    static providedPorts() {
      return new PortList([createInputPort("int_port"), createInputPort("any_port")]);
    }

    protected override tick(): NodeUserStatus {
      return NodeStatus.SUCCESS;
    }
  }

  test("EmptyPort", () => {
    const xml = `
    <root BTTS_format="4" >
      <Tree id="MainTree" _description="this is my tree" >
        <Sequence>
            <NodeInPorts  int_port="{ip}" any_port="{ap}" />
            <NodeOutPorts int_port="{ip}" any_port="{ap}" />
        </Sequence>
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(NodeOutPorts, NodeOutPorts.name);
    factory.registerNodeType(NodeInPorts, NodeInPorts.name);

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.FAILURE);
  });

  @ImplementPorts
  class IllegalPorts extends SyncActionNode {
    static providedPorts() {
      return new PortList([createInputPort("name")]);
    }

    protected override tick(): NodeUserStatus {
      return NodeStatus.SUCCESS;
    }
  }

  test("IllegalPorts", () => {
    expect(() => new TreeFactory().registerNodeType(IllegalPorts, "nope")).toThrow();
  });

  @ImplementPorts
  class ActionVectorIn extends SyncActionNode {
    static providedPorts() {
      return new PortList([createInputPort("states")]);
    }

    constructor(name: string, config: NodeConfig, private states: number[]) {
      super(name, config);
    }

    protected override tick(): NodeUserStatus {
      this.states.splice(
        0,
        this.states.length,
        ...this.getInput("states", (_) => _.split(";").map(Number))!
      );
      return NodeStatus.SUCCESS;
    }
  }

  test("SubtreeStringInput_BehaviorTree.CPPIssue489", () => {
    const xml = `
    <root BTTS_format="4" >
      <Tree id="Main">
        <Subtree id="Subtree_A" states="3;7"/>
      </Tree>

      <Tree id="Subtree_A">
        <ActionVectorIn states="{states}"/>
      </Tree>
    </root>
    `;

    const states = [];

    const factory = new TreeFactory();
    factory.registerNodeType(ActionVectorIn, ActionVectorIn.name, states);

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("Main");

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);
    expect(states).toEqual([3, 7]);
  });

  @ImplementPorts
  class DefaultTestAction extends SyncActionNode {
    static providedPorts() {
      return new PortList([
        createInputPort("answer", undefined, 42),
        createInputPort("greeting", undefined, "hello"),
        createInputPort("pos", undefined, {
          x: 1,
          y: 2,
          toString() {
            const { x, y } = this;
            return JSON.stringify({ x, y });
          },
        }),
      ]);
    }

    protected override tick(): NodeUserStatus {
      const answer = this.getInputOrThrow("answer", Number);
      if (answer !== 42) return NodeStatus.FAILURE;

      const greet = this.getInputOrThrow("greeting", String);
      if (greet !== "hello") return NodeStatus.FAILURE;

      const point = this.getInputOrThrow("pos", (_): { x: number; y: number } =>
        typeof _ === "string" ? JSON.parse(_) : _
      );
      if (point.x !== 1 || point.y !== 2) return NodeStatus.FAILURE;

      return NodeStatus.SUCCESS;
    }
  }

  test("DefaultInput", async () => {
    const xml = `
    <root BTTS_format="4" >
      <Tree>
        <DefaultTestAction/>
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(DefaultTestAction, DefaultTestAction.name);

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickOnce()).resolves.toBe(NodeStatus.SUCCESS);
  });
});
