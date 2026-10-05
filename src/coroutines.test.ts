import { describe, expect, it } from "vitest";
import { CoroActionNode } from "./ActionNode.js";
import { Blackboard } from "./Blackboard.js";
import { assignDefaultRemapping, NodeConfig } from "./TreeNode.js";
import { NodeStatus, PortList, type NodeUserStatus } from "./basic.js";
import { SequenceNode } from "./controls/SequenceNode.js";
import { TimeoutNode } from "./decorators/TimeoutNode.js";

// Ported from BehaviorTree.CPP's tests/gtest_coroutines.cpp. The durations,
// the tree shapes and the assertions are upstream's. `yield` replaces the
// setStatusRunningAndYield() of the C++ version, because only a generator may
// yield.

const SHORT_ACTION_DURATION = 5;
const MEDIUM_ACTION_DURATION = 20;
const LONG_ACTION_DURATION = 50;
const TIMEOUT_DURATION = 30;
const SEQUENCE_TIMEOUT = 35;

class SimpleCoroAction extends CoroActionNode {
  static providedPorts(): PortList {
    return new PortList();
  }

  willFail = false;

  private _requiredTime = MEDIUM_ACTION_DURATION;

  private _startTime = Number.MIN_SAFE_INTEGER;

  private _halted = false;

  setRequiredTime(ms: number): void {
    this._requiredTime = ms;
  }

  wasHalted(): boolean {
    return this._halted;
  }

  protected override *action(): Generator<void, NodeUserStatus, undefined> {
    this._halted = false;

    if (this._startTime === Number.MIN_SAFE_INTEGER) {
      this._startTime = Date.now();
    }

    while (Date.now() < this._startTime + this._requiredTime) {
      yield;
    }

    this._halted = false;
    this._startTime = Number.MIN_SAFE_INTEGER;
    return this.willFail ? NodeStatus.FAILURE : NodeStatus.SUCCESS;
  }

  protected override halt(): void {
    this._startTime = Number.MIN_SAFE_INTEGER;
    this._halted = true;
    super.halt();
  }
}

function config(): NodeConfig {
  const nodeConfig = new NodeConfig();
  nodeConfig.blackboard = Blackboard.create();
  assignDefaultRemapping(SimpleCoroAction, nodeConfig);
  return nodeConfig;
}

/** Tick while RUNNING, letting the event loop turn between ticks. */
async function executeWhileRunning(node: SimpleCoroAction | TimeoutNode): Promise<NodeStatus> {
  let state: NodeStatus;
  do {
    state = node.executeTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } while (state === NodeStatus.RUNNING);
  return state;
}

describe("CoroTest", () => {
  it("do_action", async () => {
    const node = new SimpleCoroAction("Action", config());

    expect(await executeWhileRunning(node)).toBe(NodeStatus.SUCCESS);
    expect(node.wasHalted()).toBe(false);

    expect(await executeWhileRunning(node)).toBe(NodeStatus.SUCCESS);
    expect(node.wasHalted()).toBe(false);

    node.willFail = true;
    expect(await executeWhileRunning(node)).toBe(NodeStatus.FAILURE);
    expect(node.wasHalted()).toBe(false);

    expect(await executeWhileRunning(node)).toBe(NodeStatus.FAILURE);
    expect(node.wasHalted()).toBe(false);
  });

  it("do_action_timeout", async () => {
    // Action takes longer than timeout -> should fail
    const node = new SimpleCoroAction("Action", config());
    node.setRequiredTime(LONG_ACTION_DURATION);
    const timeout = new TimeoutNode("TimeoutAction", config(), TIMEOUT_DURATION);
    timeout.child = node;

    expect(await executeWhileRunning(timeout)).toBe(NodeStatus.FAILURE);
    expect(node.wasHalted()).toBe(true);

    // Action takes less than timeout -> should succeed
    node.setRequiredTime(SHORT_ACTION_DURATION);

    expect(await executeWhileRunning(timeout)).toBe(NodeStatus.SUCCESS);
    expect(node.wasHalted()).toBe(false);
  });

  it("sequence_child", async () => {
    // Two actions each taking MEDIUM_ACTION_DURATION, but the timeout only
    // allows ~1.8x that: the first completes, the second gets halted
    const actionA = new SimpleCoroAction("action_A", config());
    const actionB = new SimpleCoroAction("action_B", config());
    const timeout = new TimeoutNode("timeout", config(), SEQUENCE_TIMEOUT);
    const sequence = new SequenceNode("sequence", config());

    timeout.child = sequence;
    sequence.addChild(actionA);
    sequence.addChild(actionB);

    expect(await executeWhileRunning(timeout)).toBe(NodeStatus.FAILURE);
    expect(actionA.wasHalted()).toBe(false);
    expect(actionB.wasHalted()).toBe(true);
  });

  it("OtherThreadHalt", async () => {
    const node = new SimpleCoroAction("action_A", config());
    node.setRequiredTime(LONG_ACTION_DURATION);
    node.executeTick();

    node.haltNode();
    expect(node.wasHalted()).toBe(true);

    // still usable afterwards
    expect(await executeWhileRunning(node)).toBe(NodeStatus.SUCCESS);
  });
});
