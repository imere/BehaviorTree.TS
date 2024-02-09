import { NodeConfig } from "./TreeNode";
import { NodeStatus } from "./basic";
import { FallbackNode } from "./controls/FallbackNode";
import { AsyncActionTest } from "./testing/ActionTestNode";
import { ConditionTestNode } from "./testing/ConditionTestNode";

describe("SimpleFallbackTest", () => {
  let root: FallbackNode;
  let condition: ConditionTestNode;
  let action: AsyncActionTest;

  beforeEach(() => {
    root = new FallbackNode("root_fallback", new NodeConfig());
    condition = new ConditionTestNode("condition");
    action = new AsyncActionTest("action", new NodeConfig(), 100);

    root.addChild(condition);
    root.addChild(action);
  });

  test("ConditionTrue", () => {
    condition.setExpectedResult(NodeStatus.SUCCESS);

    const status = root.executeTick();

    expect(status).toBe(NodeStatus.SUCCESS);
    expect(condition.status).toBe(NodeStatus.IDLE);
    expect(action.status).toBe(NodeStatus.IDLE);
  });

  test("ConditionChangeWhileRunning", () => {
    let state = NodeStatus.IDLE;

    condition.setExpectedResult(NodeStatus.FAILURE);
    state = root.executeTick();

    expect(state).toBe(NodeStatus.RUNNING);
    expect(condition.status).toBe(NodeStatus.FAILURE);
    expect(action.status).toBe(NodeStatus.RUNNING);

    condition.setExpectedResult(NodeStatus.SUCCESS);
    state = root.executeTick();

    expect(state).toBe(NodeStatus.RUNNING);
    expect(condition.status).toBe(NodeStatus.FAILURE);
    expect(action.status).toBe(NodeStatus.RUNNING);
  });
});

describe("SimpleFallbackWithMemoryTest", () => {
  let root: FallbackNode;
  let action: AsyncActionTest;
  let condition: ConditionTestNode;

  beforeEach(() => {
    root = new FallbackNode("root_sequence", new NodeConfig());
    action = new AsyncActionTest("action", new NodeConfig(), 100);
    condition = new ConditionTestNode("condition");

    root.addChild(condition);
    root.addChild(action);
  });

  test("ConditionFalse", () => {
    condition.setExpectedResult(NodeStatus.FAILURE);

    const status = root.executeTick();

    expect(status).toBe(NodeStatus.RUNNING);
    expect(condition.status).toBe(NodeStatus.FAILURE);
    expect(action.status).toBe(NodeStatus.RUNNING);
  });

  test("ConditionTurnToTrue", () => {
    condition.setExpectedResult(NodeStatus.FAILURE);
    let state = root.executeTick();

    expect(state).toBe(NodeStatus.RUNNING);
    expect(condition.status).toBe(NodeStatus.FAILURE);
    expect(action.status).toBe(NodeStatus.RUNNING);

    condition.setExpectedResult(NodeStatus.SUCCESS);
    state = root.executeTick();

    expect(state).toBe(NodeStatus.RUNNING);
    expect(condition.status).toBe(NodeStatus.FAILURE);
    expect(action.status).toBe(NodeStatus.RUNNING);
  });
});

describe("ComplexFallbackWithMemoryTest", () => {
  let root: FallbackNode;

  let action_1: AsyncActionTest;
  let action_2: AsyncActionTest;

  let condition_1: ConditionTestNode;
  let condition_2: ConditionTestNode;

  let fal_conditions: FallbackNode;
  let fal_actions: FallbackNode;

  beforeEach(() => {
    root = new FallbackNode("root_fallback", new NodeConfig());
    action_1 = new AsyncActionTest("action_1", new NodeConfig(), 100);
    action_2 = new AsyncActionTest("action_2", new NodeConfig(), 100);
    condition_1 = new ConditionTestNode("condition_1");
    condition_2 = new ConditionTestNode("condition_2");
    fal_conditions = new FallbackNode("fallback_conditions", new NodeConfig());
    fal_actions = new FallbackNode("fallback_actions", new NodeConfig());

    root.addChild(fal_conditions);
    fal_conditions.addChild(condition_1);
    fal_conditions.addChild(condition_2);
    root.addChild(fal_actions);
    fal_actions.addChild(action_1);
    fal_actions.addChild(action_2);
  });

  test("ConditionsTrue", () => {
    const state = root.executeTick();

    expect(state).toBe(NodeStatus.SUCCESS);
    expect(fal_conditions.status).toBe(NodeStatus.IDLE);
    expect(condition_1.status).toBe(NodeStatus.IDLE);
    expect(condition_2.status).toBe(NodeStatus.IDLE);
    expect(fal_actions.status).toBe(NodeStatus.IDLE);
    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_2.status).toBe(NodeStatus.IDLE);
  });

  test("Condition1False", () => {
    condition_1.setExpectedResult(NodeStatus.FAILURE);
    const state = root.executeTick();

    expect(state).toBe(NodeStatus.SUCCESS);
    expect(fal_conditions.status).toBe(NodeStatus.IDLE);
    expect(condition_1.status).toBe(NodeStatus.IDLE);
    expect(condition_2.status).toBe(NodeStatus.IDLE);
    expect(fal_actions.status).toBe(NodeStatus.IDLE);
    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_2.status).toBe(NodeStatus.IDLE);
  });

  test("ConditionsFalse", () => {
    condition_1.setExpectedResult(NodeStatus.FAILURE);
    condition_2.setExpectedResult(NodeStatus.FAILURE);
    const state = root.executeTick();

    expect(state).toBe(NodeStatus.RUNNING);
    expect(fal_conditions.status).toBe(NodeStatus.FAILURE);
    expect(condition_1.status).toBe(NodeStatus.IDLE);
    expect(condition_2.status).toBe(NodeStatus.IDLE);
    expect(fal_actions.status).toBe(NodeStatus.RUNNING);
    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_2.status).toBe(NodeStatus.IDLE);
  });

  test("Conditions1ToTrue", () => {
    condition_1.setExpectedResult(NodeStatus.FAILURE);
    condition_2.setExpectedResult(NodeStatus.FAILURE);
    let state = root.executeTick();

    condition_1.setExpectedResult(NodeStatus.SUCCESS);
    state = root.executeTick();

    expect(state).toBe(NodeStatus.RUNNING);
    expect(fal_conditions.status).toBe(NodeStatus.FAILURE);
    expect(condition_1.status).toBe(NodeStatus.IDLE);
    expect(condition_2.status).toBe(NodeStatus.IDLE);
    expect(fal_actions.status).toBe(NodeStatus.RUNNING);
    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_2.status).toBe(NodeStatus.IDLE);
  });

  test("Conditions2ToTrue", () => {
    condition_1.setExpectedResult(NodeStatus.FAILURE);
    condition_2.setExpectedResult(NodeStatus.FAILURE);
    let state = root.executeTick();

    condition_2.setExpectedResult(NodeStatus.SUCCESS);
    state = root.executeTick();

    expect(state).toBe(NodeStatus.RUNNING);
    expect(fal_conditions.status).toBe(NodeStatus.FAILURE);
    expect(condition_1.status).toBe(NodeStatus.IDLE);
    expect(condition_2.status).toBe(NodeStatus.IDLE);
    expect(fal_actions.status).toBe(NodeStatus.RUNNING);
    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_2.status).toBe(NodeStatus.IDLE);
  });

  test("Action1Failed", async () => {
    action_1.setExpectedResult(NodeStatus.FAILURE);
    action_2.setExpectedResult(NodeStatus.SUCCESS);
    condition_1.setExpectedResult(NodeStatus.FAILURE);
    condition_2.setExpectedResult(NodeStatus.FAILURE);

    let state = root.executeTick();

    state = root.executeTick();
    await new Promise((resolve) => setTimeout(resolve, 500));
    state = root.executeTick();

    expect(state).toBe(NodeStatus.RUNNING);
    expect(fal_conditions.status).toBe(NodeStatus.FAILURE);
    expect(condition_1.status).toBe(NodeStatus.IDLE);
    expect(condition_2.status).toBe(NodeStatus.IDLE);
    expect(fal_actions.status).toBe(NodeStatus.RUNNING);
    expect(action_1.status).toBe(NodeStatus.FAILURE);
    expect(action_2.status).toBe(NodeStatus.RUNNING);
  });
});
