import { NodeConfig } from "../TreeNode";
import { NodeStatus } from "../basic";
import { AsyncActionTest, SyncActionTest } from "../testing/ActionTestNode";
import { ConditionTestNode } from "../testing/ConditionTestNode";
import { ReactiveSequence } from "./ReactiveSequence";
import { SequenceNode } from "./SequenceNode";

describe("SimpleSequenceTest", () => {
  let root: SequenceNode, condition: ConditionTestNode, action: AsyncActionTest;

  beforeEach(() => {
    root = new SequenceNode("root_sequence", new NodeConfig());
    condition = new ConditionTestNode("condition");
    action = new AsyncActionTest("action", new NodeConfig(), 100);

    root.addChild(condition);
    root.addChild(action);
  });

  test("ConditionTrue", () => {
    expect(root.executeTick()).toBe(NodeStatus.RUNNING);
    expect(action.status).toBe(NodeStatus.RUNNING);
  });

  test("ConditionTurnToFalse", () => {
    condition.setExpectedResult(NodeStatus.FAILURE);
    let state = root.executeTick();

    state = root.executeTick();
    expect(state).toBe(NodeStatus.FAILURE);
    expect(condition.status).toBe(NodeStatus.IDLE);
    expect(action.status).toBe(NodeStatus.IDLE);
  });
});

describe("ComplexSequenceTest", () => {
  let root: ReactiveSequence,
    action_1: AsyncActionTest,
    condition_1: ConditionTestNode,
    condition_2: ConditionTestNode,
    seq_conditions: SequenceNode;

  beforeEach(() => {
    root = new ReactiveSequence("root", new NodeConfig());
    action_1 = new AsyncActionTest("action_1", new NodeConfig(), 100);
    condition_1 = new ConditionTestNode("condition_1");
    condition_2 = new ConditionTestNode("condition_2");
    seq_conditions = new SequenceNode("sequence_conditions", new NodeConfig());

    root.addChild(seq_conditions);
    seq_conditions.addChild(condition_1);
    seq_conditions.addChild(condition_2);
    root.addChild(action_1);
  });

  test("ComplexSequenceConditionsTrue", () => {
    expect(root.executeTick()).toBe(NodeStatus.RUNNING);
    // reactive node already reset seq_conditions
    expect(seq_conditions.status).toBe(NodeStatus.IDLE);
    expect(condition_1.status).toBe(NodeStatus.IDLE);
    expect(condition_2.status).toBe(NodeStatus.IDLE);
    expect(action_1.status).toBe(NodeStatus.RUNNING);
  });

  test("ComplexSequenceConditions1ToFalse", () => {
    let state = root.executeTick();

    condition_1.setExpectedResult(NodeStatus.FAILURE);

    state = root.executeTick();

    expect(state).toBe(NodeStatus.FAILURE);
    expect(seq_conditions.status).toBe(NodeStatus.IDLE);
    expect(condition_1.status).toBe(NodeStatus.IDLE);
    expect(condition_2.status).toBe(NodeStatus.IDLE);
    expect(action_1.status).toBe(NodeStatus.IDLE);
  });

  test("ComplexSequenceConditions2ToFalse", () => {
    let state = root.executeTick();

    condition_2.setExpectedResult(NodeStatus.FAILURE);

    state = root.executeTick();

    expect(state).toBe(NodeStatus.FAILURE);
    expect(seq_conditions.status).toBe(NodeStatus.IDLE);
    expect(condition_1.status).toBe(NodeStatus.IDLE);
    expect(condition_2.status).toBe(NodeStatus.IDLE);
    expect(action_1.status).toBe(NodeStatus.IDLE);
  });
});

describe("SequenceTripleActionTest", () => {
  let root: SequenceNode,
    condition: ConditionTestNode,
    action_1: AsyncActionTest,
    action_2: SyncActionTest,
    action_3: AsyncActionTest;

  beforeEach(() => {
    root = new SequenceNode("root_sequence", new NodeConfig());
    condition = new ConditionTestNode("condition");
    action_1 = new AsyncActionTest("action_1", new NodeConfig(), 100);
    action_2 = new SyncActionTest("action_2");
    action_3 = new AsyncActionTest("action_3", new NodeConfig(), 100);

    root.addChild(condition);
    root.addChild(action_1);
    root.addChild(action_2);
    root.addChild(action_3);
  });

  test("TripleAction", async () => {
    const margin_msec = process.platform === "win32" ? 60 : 20;
    const timeout = Date.now() + (600 + margin_msec);

    action_1.setTime(300);
    action_3.setTime(300);

    let state = root.executeTick();

    expect(state).toBe(NodeStatus.RUNNING);
    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_2.status).toBe(NodeStatus.IDLE);
    expect(action_3.status).toBe(NodeStatus.IDLE);

    // continue until successful
    while (state !== NodeStatus.SUCCESS && Date.now() < timeout) {
      await new Promise((resolve) => setTimeout(resolve));
      state = root.executeTick();
    }

    expect(state).toBe(NodeStatus.SUCCESS);

    // Condition is called only once
    expect(condition.tickCount()).toBe(1);
    // all the actions are called only once
    expect(action_1.tickCount()).toBe(1);
    expect(action_2.tickCount()).toBe(1);
    expect(action_3.tickCount()).toBe(1);

    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_2.status).toBe(NodeStatus.IDLE);
    expect(action_3.status).toBe(NodeStatus.IDLE);
    expect(Date.now() < timeout).toBeTruthy();
  });
});

describe("ComplexSequence2ActionsTest", () => {
  let root: SequenceNode,
    action_1: AsyncActionTest,
    action_2: AsyncActionTest,
    seq_1: SequenceNode,
    seq_2: SequenceNode,
    condition_1: ConditionTestNode,
    condition_2: ConditionTestNode;

  beforeEach(() => {
    root = new SequenceNode("root_sequence", new NodeConfig());
    action_1 = new AsyncActionTest("action_1", new NodeConfig(), 100);
    action_2 = new AsyncActionTest("action_3", new NodeConfig(), 100);
    seq_1 = new SequenceNode("sequence_1", new NodeConfig());
    seq_2 = new SequenceNode("sequence_2", new NodeConfig());
    condition_1 = new ConditionTestNode("condition_1");
    condition_2 = new ConditionTestNode("condition_2");

    root.addChild(seq_1);
    seq_1.addChild(condition_1);
    seq_1.addChild(action_1);
    root.addChild(seq_2);
    seq_2.addChild(condition_2);
    seq_2.addChild(action_2);
  });

  test("ConditionsTrue", async () => {
    let state = root.executeTick();

    state = root.executeTick();

    expect(state).toBe(NodeStatus.RUNNING);
    expect(seq_1.status).toBe(NodeStatus.RUNNING);
    expect(condition_1.status).toBe(NodeStatus.SUCCESS);
    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(seq_2.status).toBe(NodeStatus.IDLE);
    expect(condition_2.status).toBe(NodeStatus.IDLE);
    expect(action_2.status).toBe(NodeStatus.IDLE);

    await new Promise((resolve) => setTimeout(resolve, 300));
    state = root.executeTick();

    expect(state).toBe(NodeStatus.RUNNING);
    expect(seq_1.status).toBe(NodeStatus.SUCCESS);
    expect(condition_1.status).toBe(NodeStatus.IDLE);
    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(seq_2.status).toBe(NodeStatus.RUNNING);
    expect(condition_2.status).toBe(NodeStatus.SUCCESS);
    expect(action_2.status).toBe(NodeStatus.RUNNING);
  });
});
