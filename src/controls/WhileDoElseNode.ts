import { ControlNode } from "../ControlNode.js";
import { NodeStatus, type NodeUserStatus } from "../basic.js";

/**
 * The 1st child is the statement, the 2nd and 3rd are the blocks to execute
 * depending on the result of the statement.
 *
 * If result is SUCCESS, the 2nd child is executed.
 *
 * If result is FAILURE, the third child is executed.
 *
 * If the 2nd or 3d child is RUNNING and the statement changes,
 * the RUNNING child will be stopped before starting the sibling.
 */
export class WhileDoElseNode extends ControlNode {
  override halt(): void {
    super.halt();
  }

  protected override tick(): NodeUserStatus {
    const childrenCount = this.childrenCount();

    if (childrenCount !== 2 && childrenCount !== 3) {
      throw new Error("WhileDoElseNode must have either 2 or 3 children");
    }

    this.setStatus(NodeStatus.RUNNING);

    const conditionStatus = this.children[0].executeTick();

    if (conditionStatus === NodeStatus.RUNNING) {
      return conditionStatus;
    }

    let status = NodeStatus.IDLE;

    if (conditionStatus === NodeStatus.SUCCESS) {
      if (childrenCount === 3) {
        this.haltChild(2);
      }
      status = this.children[1].executeTick();
    } else if (conditionStatus === NodeStatus.FAILURE) {
      if (childrenCount === 3) {
        this.haltChild(1);
        status = this.children[2].executeTick();
      } else if (childrenCount === 2) {
        status = NodeStatus.FAILURE;
      }
    }

    if (status === NodeStatus.RUNNING) {
      return NodeStatus.RUNNING;
    }
    this.resetChildren();
    return status as NodeUserStatus;
  }
}
