import { ControlNode } from "../ControlNode";
import { NodeStatus, type NodeUserStatus } from "../basic";

/**
 * @brief The ReactiveSequence is similar to a ParallelNode.
 * All the children are ticked from first to last:
 *
 * - If a child returns RUNNING, halt the remaining siblings in the sequence and return RUNNING.
 * - If a child returns SUCCESS, tick the next sibling.
 * - If a child returns FAILURE, stop and return FAILURE.
 *
 * If all the children return SUCCESS, this node returns SUCCESS.
 *
 * IMPORTANT: to work properly, this node should not have more than a single
 *            asynchronous child.
 *
 */
export class ReactiveSequence extends ControlNode {
  private runningChild = -1;

  private static throwIfMultipleRunning = true;

  private static enableException(enable: boolean): void {
    ReactiveSequence.throwIfMultipleRunning = enable;
  }

  override tick(): NodeUserStatus {
    let allSkipped = true;

    if (this.status === NodeStatus.IDLE) this.runningChild = -1;

    this.setStatus(NodeStatus.RUNNING);

    const childrenCount = this.childrenCount();

    for (let index = 0; index < childrenCount; index++) {
      const child = this.children[index];

      const childStatus = child.executeTick();

      // switch to RUNNING state as soon as you find an active child
      allSkipped &&= childStatus === NodeStatus.SKIPPED;

      switch (childStatus) {
        case NodeStatus.RUNNING: {
          // reset the previous children, to make sure that they are in IDLE state
          // the next time we tick them
          for (let i = 0; i < childrenCount; i++) {
            if (i !== index) this.haltChild(i);
          }
          if (this.runningChild === -1) {
            this.runningChild = index;
          } else if (ReactiveSequence.throwIfMultipleRunning && this.runningChild !== index) {
            throw new Error(
              "[ReactiveSequence]: only a single child can return RUNNING. This throw can be disabled with ReactiveSequence::enableException(false)"
            );
          }
          return NodeStatus.RUNNING;
        }
        case NodeStatus.FAILURE: {
          this.resetChildren();
          return NodeStatus.FAILURE;
        }
        case NodeStatus.SUCCESS: {
          // do nothing if SUCCESS
          break;
        }
        case NodeStatus.SKIPPED: {
          // to allow it to be skipped again, we must reset the node
          this.haltChild(index);
          break;
        }
        case NodeStatus.IDLE: {
          throw new Error(`ReactiveSequence(${this.name}): A children should not return IDLE"`);
        }
      }
    }

    this.resetChildren();

    // Skip if ALL the nodes have been skipped
    return allSkipped ? NodeStatus.SKIPPED : NodeStatus.SUCCESS;
  }

  override halt(): void {
    this.runningChild = -1;
    super.halt();
  }
}
