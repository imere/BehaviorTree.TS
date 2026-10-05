import { beforeEach, describe, expect, it } from "vitest";
import { NodeConfig } from "../TreeNode.js";
import { NodeStatus } from "../basic.js";
import { TreeFactory } from "../TreeFactory.js";
import { AsyncActionTest } from "../testing/ActionTestNode.js";
import { ConditionTestNode } from "../testing/ConditionTestNode.js";
import { registerTestTick } from "../testing/helper.js";
import { ParallelNode } from "./ParallelNode.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("SimpleParallelTest", () => {
  let root: ParallelNode;
  let action1: AsyncActionTest;
  let condition1: ConditionTestNode;
  let action2: AsyncActionTest;
  let condition2: ConditionTestNode;

  beforeEach(() => {
    root = new ParallelNode("root_parallel");
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
