import { ControlNode } from "../ControlNode.js";
import {
  NodeStatus,
  PortList,
  createInputPort,
  isStatusActive,
  type NodeUserStatus,
} from "../basic.js";

/**
 * Executes the first N-1 children as a Sequence, then the last one as a
 * cleanup. If any of the try-block children fail, the last child is executed and
 * this node returns FAILURE.
 *
 * Port "catch_on_halt" (default false): if true, the catch child is also
 * executed when the node is halted while the try-block was still running.
 */
export class TryCatchNode extends ControlNode {
  private currentChildIdx = 0;

  private skippedCount = 0;

  private inCatch = false;

  static providedPorts(): PortList {
    return new PortList([
      createInputPort(
        "catch_on_halt",
        "Execute the catch child when this node is halted during the try-block",
        false
      ),
    ]);
  }

  override halt(): void {
    // the port arrives as the string "false", so it needs JSON.parse and not
    // Boolean, which would turn any non-empty string into true
    const catchOnHalt = this.getInput("catch_on_halt", (_) => JSON.parse(_)) ?? false;

    // If catch_on_halt is enabled and we were in the try-block (not already in
    // catch), execute the catch child synchronously before halting.
    if (catchOnHalt && !this.inCatch && isStatusActive(this.status) && this.childrenCount() >= 2) {
      // Halt all try-block children first
      for (let i = 0; i < this.childrenCount() - 1; i++) {
        this.haltChild(i);
      }

      // Tick the catch child. If it returns RUNNING, halt it too
      // (best-effort cleanup during halt).
      const catchChild = this.children[this.childrenCount() - 1];
      if (catchChild.executeTick() === NodeStatus.RUNNING) {
        this.haltChild(this.childrenCount() - 1);
      }
    }

    this.currentChildIdx = 0;
    this.skippedCount = 0;
    this.inCatch = false;
    super.halt();
  }

  protected override tick(): NodeUserStatus {
    const childrenCount = this.childrenCount();

    if (childrenCount < 2) {
      throw new Error(`${this.name}: TryCatch requires at least 2 children`);
    }

    if (!isStatusActive(this.status)) {
      this.skippedCount = 0;
      this.inCatch = false;
    }

    this.setStatus(NodeStatus.RUNNING);

    const tryCount = childrenCount - 1;

    // If we are in catch mode, tick the last child (cleanup)
    if (this.inCatch) {
      const catchChild = this.children[childrenCount - 1];
      const catchStatus = catchChild.executeTick();

      if (catchStatus === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }

      // Catch child finished (SUCCESS or FAILURE): return FAILURE
      this.resetChildren();
      this.currentChildIdx = 0;
      this.inCatch = false;
      return NodeStatus.FAILURE;
    }

    // Try-block: execute children 0..N-2 as a Sequence
    while (this.currentChildIdx < tryCount) {
      const childStatus = this.children[this.currentChildIdx].executeTick();

      switch (childStatus) {
        case NodeStatus.RUNNING: {
          return NodeStatus.RUNNING;
        }
        case NodeStatus.FAILURE: {
          // Enter catch mode: halt try-block children, then tick catch child
          this.resetChildren();
          this.currentChildIdx = 0;
          this.inCatch = true;
          return this.tick(); // re-enter to tick the catch child
        }
        case NodeStatus.SUCCESS: {
          this.currentChildIdx++;
          break;
        }
        case NodeStatus.SKIPPED: {
          this.currentChildIdx++;
          this.skippedCount++;
          break;
        }
        case NodeStatus.IDLE: {
          throw new Error(`${this.name}: A child should not return IDLE`);
        }
      }
    }

    // All try-children completed successfully (or were skipped)
    const allSkipped = this.skippedCount === tryCount;
    this.resetChildren();
    this.currentChildIdx = 0;
    this.skippedCount = 0;

    return allSkipped ? NodeStatus.SKIPPED : NodeStatus.SUCCESS;
  }
}
