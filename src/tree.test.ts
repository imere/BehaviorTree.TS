import { printTreeRecursively } from "./Tree";
import { NodeConfig } from "./TreeNode";
import { NodeStatus } from "./basic";
import { FallbackNode } from "./controls/FallbackNode";
import { SequenceNode } from "./controls/SequenceNode";
import { AsyncActionTest } from "./testing/ActionTestNode";
import { ConditionTestNode } from "./testing/ConditionTestNode";

describe("BehaviorTreeTest", () => {
  let root: SequenceNode;
  let action_1: AsyncActionTest;
  let condition_1: ConditionTestNode;
  let condition_2: ConditionTestNode;

  let fal_conditions: FallbackNode;

  beforeEach(() => {
    root = new SequenceNode("root_sequence", new NodeConfig());
    action_1 = new AsyncActionTest("action_1", new NodeConfig(), 100);
    condition_1 = new ConditionTestNode("condition_1");
    condition_2 = new ConditionTestNode("condition_2");
    fal_conditions = new FallbackNode("fal_conditions", new NodeConfig());

    root.addChild(fal_conditions);
    fal_conditions.addChild(condition_1);
    fal_conditions.addChild(condition_2);
    root.addChild(action_1);
  });

  test("Condition1ToFalseCondition2True", () => {
    condition_1.setExpectedResult(NodeStatus.FAILURE);
    condition_2.setExpectedResult(NodeStatus.SUCCESS);

    const status = root.executeTick();

    expect(status).toBe(NodeStatus.RUNNING);
    expect(fal_conditions.status).toBe(NodeStatus.SUCCESS);
    expect(condition_1.status).toBe(NodeStatus.IDLE);
    expect(condition_2.status).toBe(NodeStatus.IDLE);
    expect(action_1.status).toBe(NodeStatus.RUNNING);
  });

  test("Condition2ToFalseCondition1True", () => {
    condition_2.setExpectedResult(NodeStatus.FAILURE);
    condition_1.setExpectedResult(NodeStatus.SUCCESS);

    const status = root.executeTick();

    expect(status).toBe(NodeStatus.RUNNING);
    expect(fal_conditions.status).toBe(NodeStatus.SUCCESS);
    expect(condition_1.status).toBe(NodeStatus.IDLE);
    expect(condition_2.status).toBe(NodeStatus.IDLE);
    expect(action_1.status).toBe(NodeStatus.RUNNING);
  });

  test("PrintWithStream", () => {
    const lines: string[] = [];

    const indent = "  ";

    printTreeRecursively(root, lines.push.bind(lines));

    expect(lines.shift()).toBe(`${indent.repeat(0)}${root.name}`);

    expect(lines.shift()).toBe(`${indent.repeat(1)}${fal_conditions.name}`);

    expect(lines.shift()).toBe(`${indent.repeat(2)}${condition_1.name}`);

    expect(lines.shift()).toBe(`${indent.repeat(2)}${condition_2.name}`);

    expect(lines.shift()).toBe(`${indent.repeat(1)}${action_1.name}`);

    expect(lines.length).toBe(0);
  });
});
