import { Blackboard } from "../Blackboard";
import { NodeConfig } from "../TreeNode";
import { NodeStatus } from "../basic";
import { AsyncActionTest } from "../testing/ActionTestNode";
import { createSwitchNode, type Switch } from "./SwitchNode";

const sleepFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const Switch2 = createSwitchNode(2);

describe("SwitchTest", () => {
  let root: Switch;
  let action_1: AsyncActionTest;
  let action_42: AsyncActionTest;
  let action_def: AsyncActionTest;
  let bb: Blackboard;
  let simpleSwitchConfig: NodeConfig;

  beforeEach(() => {
    action_1 = new AsyncActionTest("action_1", new NodeConfig(), 200);
    action_42 = new AsyncActionTest("action_42", new NodeConfig(), 200);
    action_def = new AsyncActionTest("action_default", new NodeConfig(), 200);

    bb = Blackboard.create();

    simpleSwitchConfig = new NodeConfig();
    simpleSwitchConfig.blackboard = bb;
    simpleSwitchConfig.input = new Map([
      ["variable", "{my_var}"],
      ["case_1", "1"],
      ["case_2", "42"],
    ]);

    root = new Switch2("simple_switch", simpleSwitchConfig);

    root.addChild(action_1);
    root.addChild(action_42);
    root.addChild(action_def);
  });

  afterEach(() => {
    root.halt();
  });

  test("DefaultCase", async () => {
    let state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.RUNNING);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(300);
    state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.SUCCESS);
  });

  test("Case1", async () => {
    bb.set("my_var", 1);
    let state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(300);
    state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.SUCCESS);
  });

  test("Case2", async () => {
    bb.set("my_var", 42);
    let state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.RUNNING);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(300);
    state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.SUCCESS);
  });

  test("CaseNone", async () => {
    bb.set("my_var", "none");
    let state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.RUNNING);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(300);
    state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.SUCCESS);
  });

  test("CaseSwitchToDefault", async () => {
    bb.set("my_var", 1);
    let state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(20);
    state = root.executeTick();
    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.RUNNING);

    // Switch Node does not feels changes. Only when tick.
    // (not reactive)
    await sleepFor(20);
    bb.set("my_var", "");
    await sleepFor(20);
    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(20);
    state = root.executeTick();
    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.RUNNING);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(300);
    state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.SUCCESS);
  });

  test("CaseSwitchToDefault", async () => {
    bb.set("my_var", 1);
    let state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(20);
    state = root.executeTick();
    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.RUNNING);

    // Switch Node does not feels changes. Only when tick.
    // (not reactive)
    await sleepFor(20);
    bb.set("my_var", "");
    await sleepFor(20);
    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(20);
    state = root.executeTick();
    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.RUNNING);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(300);
    state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.SUCCESS);
  });

  test("CaseSwitchToAction2", async () => {
    bb.set("my_var", 1);
    let state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.RUNNING);

    bb.set("my_var", 42);
    await sleepFor(20);
    state = root.executeTick();
    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.RUNNING);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(300);
    state = root.executeTick();

    expect(action_1.status).toBe(NodeStatus.IDLE);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.SUCCESS);
  });

  test("ActionFailure", async () => {
    bb.set("my_var", 1);
    let state = root.executeTick();

    action_1.setExpectedResult(NodeStatus.FAILURE);

    expect(action_1.status).toBe(NodeStatus.RUNNING);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(300);
    state = root.executeTick();

    expect(state).toBe(NodeStatus.FAILURE);
    expect(action_42.status).toBe(NodeStatus.IDLE);
    expect(action_def.status).toBe(NodeStatus.IDLE);
    expect(action_1.status).toBe(NodeStatus.IDLE);
  });
});
