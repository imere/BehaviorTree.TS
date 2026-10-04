import { SyncActionNode } from "../ActionNode.js";
import { NodeConfig } from "../TreeNode.js";
import { NodeStatus, type NodeUserStatus } from "../basic.js";
import { FallbackNode } from "./FallbackNode.js";
import { SequenceNode } from "./SequenceNode.js";

class FlipFlop extends SyncActionNode {
  next: NodeUserStatus = NodeStatus.SKIPPED;

  protected override tick(): NodeUserStatus {
    return this.next;
  }
}

function pair(node: SequenceNode | FallbackNode): [FlipFlop, FlipFlop] {
  const a = new FlipFlop("a", new NodeConfig());
  const b = new FlipFlop("b", new NodeConfig());
  node.addChild(a);
  node.addChild(b);
  return [a, b];
}

describe("BehaviorTree.CPPIssue978_SkipCountDoesNotLeak", () => {
  test("sequence: a full all-skipped pass must not poison the next one", () => {
    const seq = new SequenceNode("seq", new NodeConfig());
    const [a, b] = pair(seq);

    expect(seq.executeTick()).toBe(NodeStatus.SKIPPED);

    a.next = NodeStatus.SUCCESS;
    b.next = NodeStatus.SUCCESS;
    expect(seq.executeTick()).toBe(NodeStatus.SUCCESS);
  });

  test("fallback: a full all-skipped pass must not poison the next one", () => {
    const fb = new FallbackNode("fb", new NodeConfig());
    const [a, b] = pair(fb);

    expect(fb.executeTick()).toBe(NodeStatus.SKIPPED);

    a.next = NodeStatus.FAILURE;
    b.next = NodeStatus.FAILURE;
    expect(fb.executeTick()).toBe(NodeStatus.FAILURE);
  });

  test("halt clears the skip counter", () => {
    const seq = new SequenceNode("seq", new NodeConfig());
    pair(seq);

    expect(seq.executeTick()).toBe(NodeStatus.SKIPPED);
    seq.haltNode();
    expect(seq.executeTick()).toBe(NodeStatus.SKIPPED);
  });
});
