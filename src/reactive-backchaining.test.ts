import { StatefulActionNode } from "./ActionNode";
import { ConditionNode } from "./ConditionNode";
import { TreeFactory } from "./TreeFactory";
import { NodeConfig } from "./TreeNode";
import { NodeStatus, NodeUserStatus, PortList } from "./basic";

class SimpleCondition extends ConditionNode {
  static providedPorts(): PortList {
    return new PortList();
  }

  constructor(
    name: string,
    config: NodeConfig,
    private portName: string
  ) {
    super(name, config);
  }

  protected override tick(): NodeUserStatus {
    return this.config.blackboard.get(this.portName) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

class AsyncTestAction extends StatefulActionNode {
  static providedPorts(): PortList {
    return new PortList();
  }

  private counter = 0;

  constructor(
    name: string,
    config: NodeConfig,
    private portName: string
  ) {
    super(name, config);
  }

  override onStart(): NodeUserStatus {
    this.counter = 0;
    return NodeStatus.RUNNING;
  }

  override onRunning(): NodeUserStatus {
    if (++this.counter === 2) {
      this.config.blackboard.set(this.portName, true);
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
    // const observer = new TreeObserver(tree);

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

    // expect(observer.getStatistics("warm").failure_count).toBe(3);
    // expect(observer.getStatistics("warm").success_count).toBe(1);

    // expect(observer.getStatistics("jacket").transitions_count).toBe(3);
    // expect(observer.getStatistics("jacket").success_count).toBe(3);

    // expect(observer.getStatistics("wear").success_count).toBe(1);
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
  // const observer = new TreeObserver(tree);

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
