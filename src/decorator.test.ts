import { NodeConfig } from "./TreeNode.js";
import { NodeStatus } from "./basic.js";
import { TimeoutNode } from "./decorators/TimeoutNode.js";
import { AsyncActionTest } from "./testing/ActionTestNode.js";

const sleepFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("DeadlineTest", () => {
  let root: TimeoutNode, action: AsyncActionTest;

  beforeEach(() => {
    root = new TimeoutNode("deadline", new NodeConfig(), 300);
    action = new AsyncActionTest("action", new NodeConfig(), 600);
    root.setChild(action);
  });

  test("DeadlineTriggeredTest", async () => {
    let state = root.executeTick();

    expect(action.status).toBe(NodeStatus.RUNNING);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(400);
    state = root.executeTick();
    expect(state).toBe(NodeStatus.FAILURE);
    expect(action.status).toBe(NodeStatus.IDLE);
  });

  test("DeadlineNotTriggeredTest", async () => {
    action.setTime(200);

    let state = root.executeTick();

    expect(action.status).toBe(NodeStatus.RUNNING);
    expect(state).toBe(NodeStatus.RUNNING);

    await sleepFor(400);
    state = root.executeTick();
    expect(action.status).toBe(NodeStatus.IDLE);
    expect(state).toBe(NodeStatus.SUCCESS);
  });
});
