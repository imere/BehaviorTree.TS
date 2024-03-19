import { ControlNode } from "../ControlNode";
import { NodeStatus, type NodeUserStatus } from "../basic";

/**
 * @brief The ReactiveFallback is similar to a ParallelNode.
 * All the children are ticked from first to last:
 *
 * - If a child returns RUNNING, continue to the next sibling.
 * - If a child returns FAILURE, continue to the next sibling.
 * - If a child returns SUCCESS, stop and return SUCCESS.
 *
 * If all the children fail, than this node returns FAILURE.
 *
 * IMPORTANT: to work properly, this node should not have more than
 *            a single asynchronous child.
 *
 */
export class ReactiveFallback extends ControlNode {
  private runningChild = -1;

  private static throwIfMultipleRunning = false;

  private static enableException(enable: boolean): void {
    ReactiveFallback.throwIfMultipleRunning = enable;
  }

  override tick(): NodeUserStatus {
    let allSkipped = true;

    if (this.status === NodeStatus.IDLE) this.runningChild = -1;

    this.setStatus(NodeStatus.RUNNING);

    const childrenCount = this.childrenCount();

    for (let index = 0; index < childrenCount; index++) {
      const currentChildNode = this.children[index];

      const childStatus = currentChildNode.executeTick();

      // switch to RUNNING state as soon as you find an active child
      allSkipped &&= childStatus === NodeStatus.SKIPPED;

      switch (childStatus) {
        case NodeStatus.RUNNING: {
          // reset the previous children, to make sure that they are
          // in IDLE state the next time we tick them
          for (let i = 0; i < childrenCount; i++) {
            if (i !== index) this.haltChild(i);
          }
          if (this.runningChild === -1) {
            this.runningChild = index;
          } else if (ReactiveFallback.throwIfMultipleRunning && this.runningChild !== index) {
            throw new Error(
              "[ReactiveFallback]: only a single child can return RUNNING. This throw can be disabled with ReactiveFallback::enableException(false)"
            );
          }
          return NodeStatus.RUNNING;
        }
        case NodeStatus.FAILURE: {
          break;
        }
        case NodeStatus.SUCCESS: {
          this.resetChildren();
          return NodeStatus.SUCCESS;
        }
        case NodeStatus.SKIPPED: {
          // to allow it to be skipped again, we must reset the node
          this.haltChild(index);
          break;
        }
        case NodeStatus.IDLE: {
          throw new Error(`ReactiveFallback(${this.name}): A children should not return IDLE"`);
        }
      }
    }

    this.resetChildren();

    // Skip if ALL the nodes have been skipped
    return allSkipped ? NodeStatus.SKIPPED : NodeStatus.FAILURE;
  }

  override halt(): void {
    this.runningChild = -1;
    super.halt();
  }
}
