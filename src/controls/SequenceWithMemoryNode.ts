import { ControlNode } from "../ControlNode.js";
import { NodeStatus, isStatusActive, type NodeUserStatus } from "../basic.js";

/**
 * @brief The SequenceWithMemory is used to tick children in an ordered sequence.
 * If any child returns RUNNING, previous children will NOT be ticked again.
 *
 * - If all the children return SUCCESS, this node returns SUCCESS.
 *
 * - If a child returns RUNNING, this node returns RUNNING.
 *   Loop is NOT restarted, the same running child will be ticked again.
 *
 * - If a child returns FAILURE, stop the loop and return FAILURE.
 *   Loop is NOT restarted, the same running child will be ticked again.
 *
 */
export class SequenceWithMemory extends ControlNode {
  private currentChildIdx = 0;

  private skippedCount = 0;

  override tick(): NodeUserStatus {
    if (!isStatusActive(this.status)) this.skippedCount = 0;

    this.setStatus(NodeStatus.RUNNING);

    for (const count = this.childrenCount(); this.currentChildIdx < count;) {
      const currentChild = this.children[this.currentChildIdx];

      const oldStatus = currentChild.status;

      const status = currentChild.executeTick();

      switch (status) {
        case NodeStatus.RUNNING: {
          return status;
        }
        case NodeStatus.FAILURE: {
          // DO NOT reset currentChildIdx on failure
          for (let i = this.currentChildIdx; i < count; i++) {
            this.haltChild(i);
          }
          return status;
        }
        case NodeStatus.SUCCESS: {
          this.currentChildIdx++;
          // Return the execution flow if the child is async,
          // to make this interruptable.
          if (
            this.requiresWakeUp() &&
            oldStatus === NodeStatus.IDLE &&
            this.currentChildIdx < count
          ) {
            this.emitWakeUpSignal();
            return NodeStatus.RUNNING;
          }
          break;
        }
        case NodeStatus.SKIPPED: {
          this.currentChildIdx++;
          this.skippedCount++;
          break;
        }
        case NodeStatus.IDLE: {
          throw new Error(`${this.name}: A children should not return IDLE`);
        }
      }
    }

    // The entire loop completed, so all the children returned SUCCESS.
    const allChildrenSkipped = this.skippedCount === this.childrenCount();
    if (this.currentChildIdx === this.childrenCount()) {
      this.resetChildren();
      this.currentChildIdx = 0;
      this.skippedCount = 0;
    }

    // Skip if ALL the nodes have been skipped
    return allChildrenSkipped ? NodeStatus.SKIPPED : NodeStatus.SUCCESS;
  }

  // halt() is inherited on purpose: it must not rewind currentChildIdx, which is
  // what tells this node apart from SequenceNode
}
