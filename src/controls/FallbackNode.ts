import { ControlNode } from "../ControlNode";
import type { NodeConfig } from "../TreeNode";
import { NodeStatus, type NodeUserStatus } from "../basic";

/**
 * @brief The FallbackNode is used to try different strategies,
 * until one succeeds.
 * If any child returns RUNNING, previous children will NOT be ticked again.
 *
 * - If all the children return FAILURE, this node returns FAILURE.
 *
 * - If a child returns RUNNING, this node returns RUNNING.
 *
 * - If a child returns SUCCESS, stop the loop and return SUCCESS.
 *
 */
export class FallbackNode extends ControlNode {
  private currentChildIdx = 0;

  private skippedCount = 0;

  constructor(
    name: string,
    config: NodeConfig,
    private asynch: boolean = false
  ) {
    super(name, config);
    this.registrationId = asynch ? "AsyncFallback" : "Fallback";
  }

  override tick(): NodeUserStatus {
    if (this.status === NodeStatus.IDLE) this.skippedCount = 0;

    this.setStatus(NodeStatus.RUNNING);

    for (const count = this.childrenCount(); this.currentChildIdx < count; ) {
      const currentChild = this.children[this.currentChildIdx];

      const oldStatus = currentChild.status;

      const status = currentChild.executeTick();

      switch (status) {
        case NodeStatus.RUNNING: {
          return status;
        }
        case NodeStatus.SUCCESS: {
          this.resetChildren();
          this.currentChildIdx = 0;
          return status;
        }
        case NodeStatus.FAILURE: {
          this.currentChildIdx++;
          // Return the execution flow if the child is async,
          // to make this interruptable.
          if (
            this.asynch &&
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
          throw new Error(`${this.name}: A children should not return IDLE"`);
        }
      }
    }

    // The entire while loop completed. This means that all the children returned FAILURE.
    if (this.currentChildIdx === this.childrenCount()) {
      this.resetChildren();
      this.currentChildIdx = 0;
    }

    // Skip if ALL the nodes have been skipped
    return this.skippedCount === this.childrenCount() ? NodeStatus.SKIPPED : NodeStatus.FAILURE;
  }

  override halt(): void {
    this.currentChildIdx = 0;
    super.halt();
  }
}
