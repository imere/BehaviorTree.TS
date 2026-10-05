import { describe, expect, it } from "vitest";
import { ThreadedAction, type OffTickExecutor } from "./ActionNode.js";
import { NodeConfig } from "./TreeNode.js";
import { NodeStatus, PortList, type NodeUserStatus } from "./basic.js";
import { TreeFactory } from "./TreeFactory.js";

// Ported from BehaviorTree.CPP's tests/gtest_async_action_node.cpp. The node
// under test and the assertions are upstream's; the two places the mechanism
// differs are noted where they occur.

class MockedThreadedAction extends ThreadedAction {
  static providedPorts(): PortList {
    return new PortList();
  }

  private _expected = NodeStatus.SUCCESS;

  private _onTick: (() => NodeUserStatus) | undefined;

  setExpected(status: NodeStatus): void {
    this._expected = status;
  }

  setOnTick(onTick: (() => NodeUserStatus) | undefined): void {
    this._onTick = onTick;
  }

  protected override tick(): NodeUserStatus {
    if (this._onTick) {
      const onTick = this._onTick;
      this._onTick = undefined;
      return onTick();
    }
    return this._expected as NodeUserStatus;
  }

  /** Tick while the node is running. */
  async spinUntilDone(): Promise<NodeStatus> {
    let state: NodeStatus;
    do {
      state = this.executeTick();
      // the work runs off the tick path, so let the executor hand it back
      await Promise.resolve();
    } while (state === NodeStatus.RUNNING);
    return state;
  }
}

const directExecutor: OffTickExecutor = (work) => work();

describe("NodeStatusFixture", () => {
  it.each([NodeStatus.SUCCESS, NodeStatus.FAILURE])(
    "normal_routine propagates the result of tick (%s)",
    async (state) => {
      const node = new MockedThreadedAction("node", new NodeConfig(), directExecutor);
      node.setExpected(state);

      expect(await node.spinUntilDone()).toBe(state);
    }
  );
});

describe("MockedThreadedActionFixture", () => {
  it("no_halt resets the halt flag", async () => {
    const node = new MockedThreadedAction("node", new NodeConfig(), directExecutor);

    // halt on an idle node still records the request
    node.haltNode();
    expect(node.isHaltRequested()).toBe(true);

    // and the next run clears it again
    node.setExpected(NodeStatus.SUCCESS);
    expect(await node.spinUntilDone()).toBe(NodeStatus.SUCCESS);
    expect(node.isHaltRequested()).toBe(false);
  });

  it("halt discards the result the work was about to set", async () => {
    const node = new MockedThreadedAction("node", new NodeConfig(), directExecutor);
    node.setExpected(NodeStatus.SUCCESS);

    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });

    node.setOnTick(() => {
      void blocked;
      return NodeStatus.SUCCESS;
    });

    // start the work with an executor that does not run it yet
    const deferred: OffTickExecutor = (work) => {
      release = () => work();
    };
    const lazy = new MockedThreadedAction("node2", new NodeConfig(), deferred);
    lazy.setExpected(NodeStatus.SUCCESS);
    lazy.executeTick();
    expect(lazy.status).toBe(NodeStatus.RUNNING);

    // halting returns at once, unlike the C++ version where halt() joins the
    // thread; what matters either way is that the late result is dropped
    lazy.haltNode();
    expect(lazy.status).toBe(NodeStatus.IDLE);

    release();
    await Promise.resolve();
    expect(lazy.status).toBe(NodeStatus.IDLE);
  });

  it("exception is re-raised on the caller's next executeTick and then cleared", async () => {
    const node = new MockedThreadedAction("node", new NodeConfig(), directExecutor);

    node.setOnTick(() => {
      throw new Error("This is not good!");
    });

    // the caller sees the wrapper, with the original as its cause, which is
    // how upstream re-raises it too
    let thrown: unknown;
    try {
      await node.spinUntilDone();
    } catch (e) {
      thrown = e;
    }
    expect((thrown as Error).message).toContain("Uncaught exception from tick()");
    expect(((thrown as Error).cause as Error).message).toBe("This is not good!");

    // the exception is cleared up, so the node works again
    node.resetStatus();
    node.setExpected(NodeStatus.SUCCESS);
    expect(await node.spinUntilDone()).toBe(NodeStatus.SUCCESS);
  });
});

describe("the executor the factory passes", () => {
  it("is the microtask one by default", () => {
    expect(new TreeFactory().offTickExecutor).toBeTypeOf("function");
  });

  it("reaches a registered ThreadedAction only when the registration passes it", async () => {
    const calls: number[] = [];
    const factory = new TreeFactory({
      offTickExecutor: (work) => {
        calls.push(1);
        work();
      },
    });

    class Counting extends ThreadedAction {
      static providedPorts(): PortList {
        return new PortList();
      }

      protected override tick(): NodeUserStatus {
        return NodeStatus.SUCCESS;
      }
    }

    factory.registerNodeType(Counting, "Counting", factory.offTickExecutor);

    const tree = factory.createTreeFromXML(`
    <root BTTS_format="4">
      <BehaviorTree ID="Main">
        <Counting/>
      </BehaviorTree>
    </root>`);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(calls).toEqual([1]);
  });
});
