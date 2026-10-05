import { beforeEach, describe, expect, it } from "vitest";
import { NodeConfig } from "../TreeNode.js";
import { NodeStatus } from "../basic.js";
import { TestNode, TestNodeConfig, type ITestNodeConfig } from "../actions/TestNode.js";
import { TreeFactory } from "../TreeFactory.js";
import { TreeObserver } from "../TreeObserver.js";
import { AsyncActionTest } from "../testing/ActionTestNode.js";
import { ConditionTestNode } from "../testing/ConditionTestNode.js";
import { registerTestTick } from "../testing/helper.js";
import { ParallelNode } from "./ParallelNode.js";

function registerTestNode(
  factory: TreeFactory,
  id: string,
  asyncDelay: number,
  returnStatus: string
): void {
  const config = new TestNodeConfig();
  config.async_delay = asyncDelay;
  config.return_status = returnStatus as ITestNodeConfig["return_status"];
  factory.registerNodeType(TestNode, id, config);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("SimpleParallelTest", () => {
  let root: ParallelNode;
  let action1: AsyncActionTest;
  let condition1: ConditionTestNode;
  let action2: AsyncActionTest;
  let condition2: ConditionTestNode;

  beforeEach(() => {
    root = new ParallelNode("root_parallel", new NodeConfig());
    action1 = new AsyncActionTest("action_1", new NodeConfig(), 100);
    condition1 = new ConditionTestNode("condition_1");
    action2 = new AsyncActionTest("action_2", new NodeConfig(), 300);
    condition2 = new ConditionTestNode("condition_2");

    root.addChild(condition1);
    root.addChild(action1);
    root.addChild(condition2);
    root.addChild(action2);
  });

  it("ConditionsTrue", async () => {
    expect(root.executeTick()).toBe(NodeStatus.RUNNING);
    expect(condition1.status).toBe(NodeStatus.SUCCESS);
    expect(condition2.status).toBe(NodeStatus.SUCCESS);
    expect(action1.status).toBe(NodeStatus.RUNNING);
    expect(action2.status).toBe(NodeStatus.RUNNING);

    await sleep(200);
    expect(root.executeTick()).toBe(NodeStatus.RUNNING);
    expect(action1.status).toBe(NodeStatus.SUCCESS);
    expect(action2.status).toBe(NodeStatus.RUNNING);

    await sleep(200);
    expect(root.executeTick()).toBe(NodeStatus.SUCCESS);
    expect(condition1.status).toBe(NodeStatus.IDLE);
    expect(condition2.status).toBe(NodeStatus.IDLE);
    expect(action1.status).toBe(NodeStatus.IDLE);
    expect(action2.status).toBe(NodeStatus.IDLE);
  });

  it("Threshold_3", async () => {
    root.setSuccessThreshold(3);
    action1.setTime(100);
    action2.setTime(500); // this takes a lot of time

    expect(root.executeTick()).toBe(NodeStatus.RUNNING);
    expect(condition1.status).toBe(NodeStatus.SUCCESS);
    expect(condition2.status).toBe(NodeStatus.SUCCESS);
    expect(action1.status).toBe(NodeStatus.RUNNING);
    expect(action2.status).toBe(NodeStatus.RUNNING);

    await sleep(150);
    // action1 should be completed, but not action2; nevertheless it is
    // sufficient because threshold is 3
    expect(root.executeTick()).toBe(NodeStatus.SUCCESS);
    expect(action1.status).toBe(NodeStatus.IDLE);
    expect(action2.status).toBe(NodeStatus.IDLE);
  });

  it("Threshold_neg2", async () => {
    root.setSuccessThreshold(-2);
    action1.setTime(100);
    action2.setTime(500); // this takes a lot of time

    expect(root.executeTick()).toBe(NodeStatus.RUNNING);
    expect(condition1.status).toBe(NodeStatus.SUCCESS);
    expect(condition2.status).toBe(NodeStatus.SUCCESS);
    expect(action1.status).toBe(NodeStatus.RUNNING);
    expect(action2.status).toBe(NodeStatus.RUNNING);

    await sleep(150);
    expect(root.executeTick()).toBe(NodeStatus.SUCCESS);
    expect(action1.status).toBe(NodeStatus.IDLE);
    expect(action2.status).toBe(NodeStatus.IDLE);
  });

  it("Threshold_neg1", async () => {
    root.setSuccessThreshold(-1);
    action1.setTime(100);
    action2.setTime(500); // this takes a lot of time

    expect(root.executeTick()).toBe(NodeStatus.RUNNING);
    expect(condition1.status).toBe(NodeStatus.SUCCESS);
    expect(condition2.status).toBe(NodeStatus.SUCCESS);
    expect(action1.status).toBe(NodeStatus.RUNNING);
    expect(action2.status).toBe(NodeStatus.RUNNING);

    await sleep(150);
    // second tick: action1 should be completed, but not action2
    expect(root.executeTick()).toBe(NodeStatus.RUNNING);
    expect(condition1.status).toBe(NodeStatus.SUCCESS);
    expect(condition2.status).toBe(NodeStatus.SUCCESS);
    expect(action1.status).toBe(NodeStatus.SUCCESS);
    expect(action2.status).toBe(NodeStatus.RUNNING);

    await sleep(650);
    // third tick: all actions completed
    expect(root.executeTick()).toBe(NodeStatus.SUCCESS);
    expect(condition1.status).toBe(NodeStatus.IDLE);
    expect(condition2.status).toBe(NodeStatus.IDLE);
    expect(action1.status).toBe(NodeStatus.IDLE);
    expect(action2.status).toBe(NodeStatus.IDLE);
  });

  it("Threshold_thresholdFneg1", async () => {
    root.setSuccessThreshold(1);
    root.setFailureThreshold(-1);
    action1.setTime(100);
    action1.setExpectedResult(NodeStatus.FAILURE);
    condition1.setExpectedResult(NodeStatus.FAILURE);
    action2.setTime(200);
    condition2.setExpectedResult(NodeStatus.FAILURE);
    action2.setExpectedResult(NodeStatus.FAILURE);

    expect(root.executeTick()).toBe(NodeStatus.RUNNING);

    await sleep(250);
    expect(root.executeTick()).toBe(NodeStatus.FAILURE);
  });

  it("Threshold_2", () => {
    root.setSuccessThreshold(2);
    expect(root.executeTick()).toBe(NodeStatus.SUCCESS);
    expect(condition1.status).toBe(NodeStatus.IDLE);
    expect(condition2.status).toBe(NodeStatus.IDLE);
    expect(action1.status).toBe(NodeStatus.IDLE);
    expect(action2.status).toBe(NodeStatus.IDLE);
  });
});

describe("Parallel.FailingParallel", () => {
  it("stops as soon as one child succeeded, without failing the others", async () => {
    const factory = new TreeFactory();
    registerTestNode(factory, "GoodTest", 200, "SUCCESS");
    registerTestNode(factory, "BadTest", 100, "FAILURE");
    registerTestNode(factory, "SlowTest", 300, "SUCCESS");

    const tree = factory.createTreeFromXML(`
<root BTTS_format="4">
  <BehaviorTree ID="MainTree">
    <Parallel name="parallel" success_count="1" failure_count="3">
      <GoodTest name="first"/>
      <BadTest name="second"/>
      <SlowTest name="third"/>
    </Parallel>
  </BehaviorTree>
</root>  `);
    const observer = new TreeObserver(tree);

    // since at least one succeeded.
    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(observer.getStatisticsByPath("first").successCount).toBe(1);
    expect(observer.getStatisticsByPath("second").failureCount).toBe(1);
    expect(observer.getStatisticsByPath("third").failureCount).toBe(0);
  });
});

describe("Parallel.ParallelAll", () => {
  function build(maxFailures: number) {
    const factory = new TreeFactory();
    registerTestNode(factory, "GoodTest", 300, "SUCCESS");
    registerTestNode(factory, "BadTest", 100, "FAILURE");

    const tree = factory.createTreeFromXML(`
<root BTTS_format="4">
  <BehaviorTree ID="MainTree">
    <ParallelAll max_failures="${maxFailures}">
      <BadTest name="first"/>
      <GoodTest name="second"/>
      <GoodTest name="third"/>
    </ParallelAll>
  </BehaviorTree>
</root>  `);
    return { tree, observer: new TreeObserver(tree) };
  }

  it("fails when max_failures is reached", async () => {
    const { tree, observer } = build(1);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.FAILURE);
    expect(observer.getStatisticsByPath("first").failureCount).toBe(1);
    expect(observer.getStatisticsByPath("second").successCount).toBe(1);
    expect(observer.getStatisticsByPath("third").successCount).toBe(1);
  });

  it("succeeds when max_failures is not reached", async () => {
    const { tree, observer } = build(2);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(observer.getStatisticsByPath("first").failureCount).toBe(1);
    expect(observer.getStatisticsByPath("second").successCount).toBe(1);
    expect(observer.getStatisticsByPath("third").successCount).toBe(1);
  });
});

describe("ComplexParallelTest", () => {
  let parallelRoot: ParallelNode;
  let parallelLeft: ParallelNode;
  let parallelRight: ParallelNode;
  let actionL1: AsyncActionTest;
  let conditionL1: ConditionTestNode;
  let actionL2: AsyncActionTest;
  let conditionL2: ConditionTestNode;
  let actionR: AsyncActionTest;
  let conditionR: ConditionTestNode;

  beforeEach(() => {
    parallelRoot = new ParallelNode("root", new NodeConfig());
    parallelLeft = new ParallelNode("par1", new NodeConfig());
    parallelRight = new ParallelNode("par2", new NodeConfig());
    actionL1 = new AsyncActionTest("action_1", new NodeConfig(), 100);
    conditionL1 = new ConditionTestNode("condition_1");
    actionL2 = new AsyncActionTest("action_2", new NodeConfig(), 200);
    conditionL2 = new ConditionTestNode("condition_2");
    actionR = new AsyncActionTest("action_3", new NodeConfig(), 400);
    conditionR = new ConditionTestNode("condition_3");

    parallelRoot.addChild(parallelLeft);
    parallelLeft.addChild(conditionL1);
    parallelLeft.addChild(actionL1);
    parallelLeft.addChild(conditionL2);
    parallelLeft.addChild(actionL2);
    parallelRoot.addChild(parallelRight);
    parallelRight.addChild(conditionR);
    parallelRight.addChild(actionR);

    parallelRoot.setSuccessThreshold(2);
    parallelLeft.setSuccessThreshold(3);
    parallelRight.setSuccessThreshold(1);
  });

  it("ConditionsTrue", async () => {
    const state = parallelRoot.executeTick();

    expect(parallelLeft.status).toBe(NodeStatus.RUNNING);
    expect(conditionL1.status).toBe(NodeStatus.SUCCESS);
    expect(conditionL2.status).toBe(NodeStatus.SUCCESS);
    expect(actionL1.status).toBe(NodeStatus.RUNNING);
    expect(actionL2.status).toBe(NodeStatus.RUNNING);

    expect(parallelRight.status).toBe(NodeStatus.SUCCESS);
    expect(conditionR.status).toBe(NodeStatus.IDLE);
    expect(actionR.status).toBe(NodeStatus.IDLE);

    expect(state).toBe(NodeStatus.RUNNING);

    await sleep(200);
    expect(parallelRoot.executeTick()).toBe(NodeStatus.SUCCESS);
  });

  it("ConditionsLeftFalse", () => {
    parallelLeft.setFailureThreshold(3);
    parallelLeft.setSuccessThreshold(3);
    conditionL1.setExpectedResult(NodeStatus.FAILURE);
    conditionL2.setExpectedResult(NodeStatus.FAILURE);
    const state = parallelRoot.executeTick();

    // It fails because Parallel Left will never succeed (two already fail)
    // even though threshold_failure == 3
    expect(parallelLeft.status).toBe(NodeStatus.IDLE);
    expect(conditionL1.status).toBe(NodeStatus.IDLE);
    expect(conditionL2.status).toBe(NodeStatus.IDLE);
    expect(actionL1.status).toBe(NodeStatus.IDLE);
    expect(actionL2.status).toBe(NodeStatus.IDLE);

    expect(parallelRight.status).toBe(NodeStatus.IDLE);
    expect(conditionR.status).toBe(NodeStatus.IDLE);
    expect(actionR.status).toBe(NodeStatus.IDLE);

    expect(state).toBe(NodeStatus.FAILURE);
  });

  it("ConditionRightFalse", () => {
    conditionR.setExpectedResult(NodeStatus.FAILURE);
    const state = parallelRoot.executeTick();
    expect(state).toBe(NodeStatus.FAILURE);
  });

  it("ConditionRightFalse_thresholdF_2", async () => {
    parallelRight.setFailureThreshold(2);
    conditionR.setExpectedResult(NodeStatus.FAILURE);
    const state = parallelRoot.executeTick();

    // All the actions are running
    expect(parallelLeft.status).toBe(NodeStatus.RUNNING);
    expect(conditionL1.status).toBe(NodeStatus.SUCCESS);
    expect(conditionL2.status).toBe(NodeStatus.SUCCESS);
    expect(actionL1.status).toBe(NodeStatus.RUNNING);
    expect(actionL2.status).toBe(NodeStatus.RUNNING);

    expect(parallelRight.status).toBe(NodeStatus.RUNNING);
    expect(conditionR.status).toBe(NodeStatus.FAILURE);
    expect(actionR.status).toBe(NodeStatus.RUNNING);

    expect(state).toBe(NodeStatus.RUNNING);

    await sleep(500);
    expect(parallelRoot.executeTick()).toBe(NodeStatus.SUCCESS);
  });
});

describe("Parallel.Issue593", () => {
  it("does not tick a child skipped by _skipIf", async () => {
    const factory = new TreeFactory();
    const counters: number[] = [0];
    registerTestTick(factory, "Test", counters);

    const xml = `
<root BTTS_format="4">
  <BehaviorTree ID="TestTree">
    <Sequence>
      <Script code="test = true"/>
      <Parallel failure_count="1" success_count="-1">
        <TestA _skipIf="test == true"/>
        <Sleep msec="100"/>
      </Parallel>
    </Sequence>
  </BehaviorTree>
</root>`;

    const tree = factory.createTreeFromXML(xml);
    await tree.tickWhileRunning();

    expect(counters[0]).toBe(0);
  });
});

// The remaining tests in gtest_parallel.cpp (FailingParallel, ParallelAll and the
// ComplexParallelTest group) assert through BT::TreeObserver statistics, which
// this port has no equivalent of.
