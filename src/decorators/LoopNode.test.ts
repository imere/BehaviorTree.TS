import { SyncActionNode } from "../ActionNode.js";
import {
  NodeStatus,
  PortList,
  createInputPort,
  createOutputPort,
  type NodeUserStatus,
} from "../basic.js";
import { TreeFactory } from "../TreeFactory.js";

describe("LoopNode", () => {
  function build(actions: string) {
    const factory = new TreeFactory();
    const xml = `
      <root BTTS_format="4" mainTreeToExecute="MainTree">
        <BehaviorTree ID="MainTree">
          <Loop queue="[1,2,3]">
            ${actions}
          </Loop>
        </BehaviorTree>
      </root>
    `;
    return factory.createTreeFromXML(xml);
  }

  const collect = `<Action ID="Collect"/>`;

  test("runs the child once per element", async () => {
    const seen: unknown[] = [];
    const factory = new TreeFactory();
    factory.registerNodeType(
      class extends SyncActionNode {
        static providedPorts() {
          return new PortList([createOutputPort("seen")]);
        }
        protected override tick(): NodeUserStatus {
          seen.push(this.getInput("value"));
          return NodeStatus.SUCCESS;
        }
      },
      "Collect",
      new PortList([createInputPort("value")])
    );

    const xml = `
      <root BTTS_format="4" mainTreeToExecute="MainTree">
        <BehaviorTree ID="MainTree">
          <Loop queue="[1,2,3]">
            <Action ID="Collect" value="{value}"/>
          </Loop>
        </BehaviorTree>
      </root>
    `;

    const tree = factory.createTreeFromXML(xml);
    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(seen).toEqual([1, 2, 3]);
  });

  test("a failing child aborts the loop", async () => {
    const seen: unknown[] = [];
    const factory = new TreeFactory();
    factory.registerNodeType(
      class extends SyncActionNode {
        static providedPorts() {
          return new PortList([createOutputPort("seen")]);
        }
        protected override tick(): NodeUserStatus {
          const value = this.getInput("value");
          seen.push(value);
          return Number(value) === 3 ? NodeStatus.FAILURE : NodeStatus.SUCCESS;
        }
      },
      "FailOn3",
      new PortList([createInputPort("value")])
    );

    const xml = `
      <root BTTS_format="4" mainTreeToExecute="MainTree">
        <BehaviorTree ID="MainTree">
          <Loop queue="[1,2,3,4,5]">
            <Action ID="FailOn3" value="{value}"/>
          </Loop>
        </BehaviorTree>
      </root>
    `;

    const tree = factory.createTreeFromXML(xml);
    expect(await tree.tickWhileRunning()).toBe(NodeStatus.FAILURE);
    // stops at 3, the rest of the queue is never reached
    expect(seen).toEqual([1, 2, 3]);
  });

  test("an empty array succeeds without running the child", async () => {
    let ticks = 0;
    const factory = new TreeFactory();
    factory.registerNodeType(
      class extends SyncActionNode {
        static providedPorts() {
          return new PortList([]);
        }
        protected override tick(): NodeUserStatus {
          ticks++;
          return NodeStatus.SUCCESS;
        }
      },
      "Counter"
    );

    const xml = `
      <root BTTS_format="4" mainTreeToExecute="MainTree">
        <BehaviorTree ID="MainTree">
          <Loop queue="[]">
            <Action ID="Counter"/>
          </Loop>
        </BehaviorTree>
      </root>
    `;
    const tree = factory.createTreeFromXML(xml);
    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(ticks).toBe(0);
  });

  test("if_empty selects the status for an exhausted queue", async () => {
    const factory = new TreeFactory();
    const xml = `
      <root BTTS_format="4" mainTreeToExecute="MainTree">
        <BehaviorTree ID="MainTree">
          <Loop queue="[1]" if_empty="FAILURE">
            <Action ID="AlwaysSuccess"/>
          </Loop>
        </BehaviorTree>
      </root>
    `;
    const tree = factory.createTreeFromXML(xml);
    expect(await tree.tickWhileRunning()).toBe(NodeStatus.FAILURE);
  });

  test("a blackboard array is read when the node re-enters", async () => {
    const seen: unknown[] = [];
    const factory = new TreeFactory();
    factory.registerNodeType(
      class extends SyncActionNode {
        static providedPorts() {
          return new PortList([createOutputPort("seen")]);
        }
        protected override tick(): NodeUserStatus {
          seen.push(this.getInput("value"));
          return NodeStatus.SUCCESS;
        }
      },
      "Collect",
      new PortList([createInputPort("value")])
    );

    const xml = `
      <root BTTS_format="4" mainTreeToExecute="MainTree">
        <BehaviorTree ID="MainTree">
          <Loop queue="{items}">
            <Action ID="Collect" value="{value}"/>
          </Loop>
        </BehaviorTree>
      </root>
    `;

    const tree = factory.createTreeFromXML(xml);
    tree.rootBlackboard!.set("items", ["a", "b"]);
    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(seen).toEqual(["a", "b"]);
  });
});
