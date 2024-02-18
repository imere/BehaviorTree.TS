import { SyncActionNode } from "./ActionNode";
import { TreeFactory } from "./TreeFactory";
import type { Converter, NodeConfig } from "./TreeNode";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  type NodeUserStatus,
} from "./basic";

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

  class Point2D {
    constructor(public x = 0, public y = 0) {}

    toString() {
      const { x, y } = this;
      return JSON.stringify({ x, y });
    }

    static from(source: string) {
      try {
        return JSON.parse(source);
      } catch {
        return new Point2D(...source.split(",").map(Number));
      }
    }
  }

  test("DefaultInput", () => {
    @ImplementPorts
    class DefaultTestAction extends SyncActionNode {
      static providedPorts() {
        return new PortList([
          createInputPort("answer", undefined, 42),
          createInputPort("greeting", undefined, "hello"),
          createInputPort("pos", undefined, new Point2D(1, 2)),
        ]);
      }

      protected override tick(): NodeUserStatus {
        const answer = this.getInputOrThrow("answer", Number);
        if (answer !== 42) return NodeStatus.FAILURE;

        const greet = this.getInputOrThrow("greeting", String);
        if (greet !== "hello") return NodeStatus.FAILURE;

        const point = this.getInputOrThrow("pos", (_): { x: number; y: number } => {
          return typeof _ === "string" ? JSON.parse(_) : _;
        });
        if (point.x !== 1 || point.y !== 2) return NodeStatus.FAILURE;

        return NodeStatus.SUCCESS;
      }
    }

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

  test("DefaultInputVectors", async () => {
    @ImplementPorts
    class NodeWithDefaultPoints extends SyncActionNode {
      static providedPorts() {
        return new PortList([
          createInputPort("input"),
          createInputPort("pointA", undefined, new Point2D(1, 2)),
          createInputPort("pointB", undefined, "{point}"),
          createInputPort("pointC", undefined, "5,6"),
          createInputPort("pointD", undefined, "{=}"),
        ]);
      }

      protected override tick(): NodeUserStatus {
        const convert: Converter<Point2D> = (_, { hints: { remap } }) =>
          remap ? _ : Point2D.from(_);

        const vectA = this.getInputOrThrow<Point2D>("pointA", convert);
        if (vectA.x !== 1 || vectA.y !== 2) {
          throw new Error("failed pointA");
        }

        const vectB = this.getInputOrThrow<Point2D>("pointB", convert);
        if (vectB.x !== 3 || vectB.y !== 4) {
          throw new Error("failed pointB");
        }

        const vectC = this.getInputOrThrow<Point2D>("pointC", convert);
        if (vectC.x !== 5 || vectC.y !== 6) {
          throw new Error("failed pointC");
        }

        const vectD = this.getInputOrThrow<Point2D>("pointD", convert);
        if (vectD.x !== 7 || vectD.y !== 8) {
          throw new Error("failed pointD");
        }

        const input = this.getInputOrThrow<Point2D>("input", convert);
        if (input.x !== 9 || input.y !== 10) {
          throw new Error("failed input");
        }

        return NodeStatus.SUCCESS;
      }
    }

    const xml = `
    <root BTTS_format="4" >
      <Tree>
        <NodeWithDefaultPoints input="9,10"/>
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(NodeWithDefaultPoints, NodeWithDefaultPoints.name);
    const tree = factory.createTreeFromXML(xml);

    tree.subtrees[0].blackboard.set("point", new Point2D(3, 4));
    tree.subtrees[0].blackboard.set("pointD", new Point2D(7, 8));

    expect(tree.tickOnce()).resolves.toBe(NodeStatus.SUCCESS);
  });

  test("DefaultInputStrings", async () => {
    @ImplementPorts
    class NodeWithDefaultStrings extends SyncActionNode {
      static providedPorts() {
        return new PortList([
          createInputPort("input"),
          createInputPort("msgA", undefined, "hello"),
          createInputPort("msgB", undefined, "{msg}"),
          createInputPort("msgC", undefined, "{=}"),
        ]);
      }

      protected override tick(): NodeUserStatus {
        const msgA = this.getInputOrThrow("msgA");
        if (msgA !== "hello") {
          throw new Error("failed msgA");
        }

        const msgB = this.getInputOrThrow("msgB");
        if (msgB !== "ciao") {
          throw new Error("failed msgB");
        }

        const msgC = this.getInputOrThrow("msgC");
        if (msgC !== "hola") {
          throw new Error("failed msgC");
        }

        const input = this.getInputOrThrow("input");
        if (input !== "from XML") {
          throw new Error("failed input");
        }

        return NodeStatus.SUCCESS;
      }
    }

    const xml = `
    <root BTTS_format="4" >
      <Tree>
        <NodeWithDefaultStrings input="from XML"/>
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(NodeWithDefaultStrings, NodeWithDefaultStrings.name);
    const tree = factory.createTreeFromXML(xml);

    tree.subtrees[0].blackboard.set("msg", "ciao");
    tree.subtrees[0].blackboard.set("msgC", "hola");

    expect(tree.tickOnce()).resolves.toBe(NodeStatus.SUCCESS);
  });
});
