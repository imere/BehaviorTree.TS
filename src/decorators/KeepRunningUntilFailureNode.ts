import { DecoratorNode } from "../DecoratorNode.js";
import { NodeStatus, type NodeUserStatus } from "../basic.js";

/**
 * The child is always re-ticked from the beginning.
 *
 * - If the child returns RUNNING, this node returns RUNNING.
 *
 * - If the child returns SUCCESS, this node returns RUNNING and the child is
 * restarted on the next tick.
 *
 * - If the child returns FAILURE, return FAILURE.
 *
 * This creates an infinite loop that stops only when the child fails.
 */
export class KeepRunningUntilFailureNode extends DecoratorNode {
  protected override tick(): NodeUserStatus {
    this.setStatus(NodeStatus.RUNNING);

    const childState = this.child!.executeTick();

    switch (childState) {
      case NodeStatus.FAILURE: {
        this.resetChild();
        return NodeStatus.FAILURE;
      }
      case NodeStatus.SUCCESS: {
        this.resetChild();
        return NodeStatus.RUNNING;
      }
      case NodeStatus.RUNNING: {
        return NodeStatus.RUNNING;
      }
      default: {
        return this.status as NodeUserStatus;
      }
    }
  }
}
