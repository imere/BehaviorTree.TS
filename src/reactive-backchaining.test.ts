import { StatefulActionNode } from "./ActionNode.js";
import { ConditionNode } from "./ConditionNode.js";
import { TreeFactory } from "./TreeFactory.js";
import { NodeConfig } from "./TreeNode.js";
import { NodeStatus, NodeUserStatus, PortList } from "./basic.js";
import { TreeObserver } from "./TreeObserver.js";

class SimpleCondition extends ConditionNode {
  static providedPorts(): PortList {
    return new PortList();
  }

  constructor(
    name: string,
    config: NodeConfig,
    private _portName: string
  ) {
    super(name, config);
  }

  protected override tick(): NodeUserStatus {
    return this.config.blackboard.get(this._portName) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

class AsyncTestAction extends StatefulActionNode {
  static providedPorts(): PortList {
    return new PortList();
  }

  private _counter = 0;

  constructor(
    name: string,
    config: NodeConfig,
    private _portName: string
  ) {
    super(name, config);
  }

  override onStart(): NodeUserStatus {
    this._counter = 0;
    return NodeStatus.RUNNING;
  }

  override onRunning(): NodeUserStatus {
    if (++this._counter === 2) {
      this.config.blackboard.set(this._portName, true);
      return NodeStatus.SUCCESS;
    }
    return NodeStatus.RUNNING;
  }

  override onHalted(): void {
    // noop
  }
}

describe("ReactiveBackchaining", () => {
  test("EnsureWarm", async () => {
    // This test shows the basic structure of a PPA: a fallback
    // of a postcondition and an action to make that
    //  postcondition true.
    const xml_text = `
  <root BTTS_format="4">
    <BehaviorTree ID="EnsureWarm">
      <ReactiveFallback>
        <IsWarm name="warm"/>
        <ReactiveSequence>
          <IsHoldingJacket name="jacket" />
          <WearJacket name="wear" />
        </ReactiveSequence>
      </ReactiveFallback>
    </BehaviorTree>
  </root>
  )`;

    // The final condition of the PPA; the thing that make_warm achieves.
    // For this example, we're only warm after WearJacket returns success.
    const factory = new TreeFactory();
    factory.registerNodeType(SimpleCondition, "IsWarm", "is_warm");
    factory.registerNodeType(SimpleCondition, "IsHoldingJacket", "holding_jacket");
    factory.registerNodeType(AsyncTestAction, "WearJacket", "is_warm");

    const tree = factory.createTreeFromXML(xml_text);
    const observer = new TreeObserver(tree);

    const blackboard = tree.subtrees[0].blackboard;
    blackboard.set("is_warm", false);
    blackboard.set("holding_jacket", true);

    // first tick: not warm, have a jacket: start wearing it
    expect(await tree.tickExactlyOnce()).toBe(NodeStatus.RUNNING);
    expect(blackboard.get("is_warm")).toBe(false);

    // second tick: not warm (still wearing)
    expect(await tree.tickExactlyOnce()).toBe(NodeStatus.RUNNING);
    expect(blackboard.get("is_warm")).toBe(false);

    // third tick: warm (wearing succeeded)
    expect(await tree.tickExactlyOnce()).toBe(NodeStatus.SUCCESS);
    expect(blackboard.get("is_warm")).toBe(true);

    // fourth tick: still warm (just the condition ticked)
    expect(await tree.tickExactlyOnce()).toBe(NodeStatus.SUCCESS);

    expect(observer.getStatisticsByPath("warm").failureCount).toBe(3);
    expect(observer.getStatisticsByPath("warm").successCount).toBe(1);

    expect(observer.getStatisticsByPath("jacket").transitionsCount).toBe(3);
    expect(observer.getStatisticsByPath("jacket").successCount).toBe(3);

    expect(observer.getStatisticsByPath("wear").successCount).toBe(1);
  });
});

test("EnsureWarmWithEnsureHoldingHacket", async () => {
  // This test backchains on HoldingHacket => EnsureHoldingHacket to iteratively add reactivity and functionality to the tree.
  // The general structure of the PPA remains the same.
  const xml_text = `
  <root BTTS_format="4">
    <BehaviorTree ID="EnsureWarm">
      <ReactiveFallback>
        <IsWarm />
        <ReactiveSequence>
          <SubTree ID="EnsureHoldingJacket" />
          <WearJacket />
        </ReactiveSequence>
      </ReactiveFallback>
    </BehaviorTree>
    <BehaviorTree ID="EnsureHoldingJacket">
      <ReactiveFallback>
        <IsHoldingJacket />
        <ReactiveSequence>
          <IsNearCloset />
          <GrabJacket />
        </ReactiveSequence>
      </ReactiveFallback>
    </BehaviorTree>
  </root>
  `;

  const factory = new TreeFactory();
  factory.registerNodeType(SimpleCondition, "IsWarm", "is_warm");
  factory.registerNodeType(SimpleCondition, "IsHoldingJacket", "holding_jacket");
  factory.registerNodeType(SimpleCondition, "IsNearCloset", "near_closet");
  factory.registerNodeType(AsyncTestAction, "WearJacket", "is_warm");
  factory.registerNodeType(AsyncTestAction, "GrabJacket", "holding_jacket");

  factory.registerTreeFromXML(xml_text);
  const tree = factory.createTree("EnsureWarm");
  const observer = new TreeObserver(tree);
  expect(observer.statistics().size).toBeGreaterThan(0);

  tree.subtrees[0].blackboard.set("is_warm", false);
  tree.subtrees[1].blackboard.set("holding_jacket", false);
  tree.subtrees[1].blackboard.set("near_closet", true);

  // first tick: not warm, no jacket, start GrabJacket
  expect(await tree.tickExactlyOnce()).toBe(NodeStatus.RUNNING);
  expect(tree.subtrees[0].blackboard.get("is_warm")).toBe(false);
  expect(tree.subtrees[1].blackboard.get("holding_jacket")).toBe(false);
  expect(tree.subtrees[1].blackboard.get("near_closet")).toBe(true);

  // second tick: still GrabJacket
  expect(await tree.tickExactlyOnce()).toBe(NodeStatus.RUNNING);

  // third tick: GrabJacket succeeded, start wearing
  expect(await tree.tickExactlyOnce()).toBe(NodeStatus.RUNNING);
  expect(tree.subtrees[0].blackboard.get("is_warm")).toBe(false);
  expect(tree.subtrees[1].blackboard.get("holding_jacket")).toBe(true);

  // fourth tick: still WearingJacket
  expect(await tree.tickExactlyOnce()).toBe(NodeStatus.RUNNING);

  // fifth tick: warm (WearingJacket succeeded)
  expect(await tree.tickExactlyOnce()).toBe(NodeStatus.SUCCESS);
  expect(tree.subtrees[0].blackboard.get("is_warm")).toBe(true);

  // sixr tick: still warm (just the condition ticked)
  expect(await tree.tickExactlyOnce()).toBe(NodeStatus.SUCCESS);
});
