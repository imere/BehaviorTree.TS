import { ActionNodeBase } from "./ActionNode.js";
import { SimpleDecoratorNode } from "./DecoratorNode.js";
import { NodeConfig } from "./TreeNode.js";
import { NodeStatus, type NodeUserStatus } from "./basic.js";
import { TimeoutNode } from "./decorators/TimeoutNode.js";
import { TreeFactory } from "./TreeFactory.js";
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

describe("BehaviorTree.CPPIssue1206_ChildCompletedAfterTickIsNotDiscarded", () => {
  // An asynchronous child may complete right after the decorator's tick() saw
  // it RUNNING. executeTick() used to reset such a child to IDLE, losing its
  // result and running the action again. The race is reproduced here
  // deterministically: the decorator marks the child complete itself, right
  // after observing RUNNING.
  class AsyncChild extends ActionNodeBase {
    starts = 0;

    completeFromElsewhere() {
      this.setStatus(NodeStatus.SUCCESS);
    }

    protected override tick(): NodeUserStatus {
      return this.status as NodeUserStatus;
    }

    protected override halt(): void {
      // the child is driven from outside, so there is nothing to unwind here
    }

    override executeTick(): NodeStatus {
      if (this.status === NodeStatus.IDLE) {
        this.starts++;
        this.setStatus(NodeStatus.RUNNING);
      }
      return this.status;
    }
  }

  class WaitChild extends SimpleDecoratorNode {
    constructor(name: string, config: NodeConfig) {
      super(name, config, (childStatus): NodeUserStatus => {
        this.setStatus(NodeStatus.RUNNING);
        const status = this.child!.executeTick();
        if (status === NodeStatus.RUNNING) {
          (this.child as AsyncChild).completeFromElsewhere();
          return NodeStatus.RUNNING;
        }
        this.resetChild();
        return status as NodeUserStatus;
      });
    }
  }

  test("keeps the result of a child that completed mid-tick", () => {
    const child = new AsyncChild("child", new NodeConfig());
    const decorator = new WaitChild("decorator", new NodeConfig());
    decorator.setChild(child);

    expect(decorator.executeTick()).toBe(NodeStatus.RUNNING);
    // the child completed right after tick() observed RUNNING
    expect(child.status).toBe(NodeStatus.SUCCESS);

    // the second tick must surface SUCCESS, not re-run the action
    expect(decorator.executeTick()).toBe(NodeStatus.SUCCESS);
    expect(child.starts).toBe(1);
  });
});

describe("Decorator.KeepRunningUntilFailure", () => {
  const xml = `
    <root BTTS_format="4">
       <BehaviorTree>
          <KeepRunningUntilFailure>
            <SuccessThenFail/>
          </KeepRunningUntilFailure>
       </BehaviorTree>
    </root>`;

  it("keeps returning RUNNING until the child finally fails", async () => {
    const factory = new TreeFactory();

    let tickCount = 0;
    factory.registerSimpleAction("SuccessThenFail", (): NodeUserStatus => {
      tickCount++;
      if (tickCount < 3) {
        return NodeStatus.SUCCESS;
      }
      return NodeStatus.FAILURE;
    });

    const tree = factory.createTreeFromXML(xml);

    // First tick - child succeeds, should return RUNNING
    expect(await tree.tickOnce()).toBe(NodeStatus.RUNNING);
    expect(tickCount).toBe(1);

    // Second tick - child succeeds again, should return RUNNING
    expect(await tree.tickOnce()).toBe(NodeStatus.RUNNING);
    expect(tickCount).toBe(2);

    // Third tick - child fails, should return FAILURE
    expect(await tree.tickOnce()).toBe(NodeStatus.FAILURE);
    expect(tickCount).toBe(3);
  });
});

describe("RetryTest.RetryTestA", () => {
  it("retries a failing child up to num_attempts, then fails", async () => {
    const factory = new TreeFactory();
    const state = { expected: NodeStatus.FAILURE as NodeUserStatus, ticks: 0 };
    factory.registerSimpleAction("Controllable", (): NodeUserStatus => {
      state.ticks++;
      return state.expected;
    });

    const xml = `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
        <RetryUntilSuccessful num_attempts="3">
          <Controllable/>
        </RetryUntilSuccessful>
      </BehaviorTree>
    </root>`;

    const tree = factory.createTreeFromXML(xml);

    expect(await tree.tickOnce()).toBe(NodeStatus.FAILURE);
    expect(state.ticks).toBe(3);

    state.ticks = 0;
    state.expected = NodeStatus.SUCCESS;

    expect(await tree.tickOnce()).toBe(NodeStatus.SUCCESS);
    expect(state.ticks).toBe(1);
  });
});
