import { ControlNode } from "../ControlNode";
import { NodeConfig } from "../TreeNode";
import { NodeStatus, type NodeUserStatus } from "../basic";

/**
 * @brief IfThenElseNode must have exactly 2 or 3 children. This node is NOT reactive.
 *
 * The first child is the "statement" of the if.
 *
 * If that return SUCCESS, then the second child is executed.
 *
 * Instead, if it returned FAILURE, the third child is executed.
 *
 * If you have only 2 children, this node will return FAILURE whenever the
 * statement returns FAILURE.
 *
 * This is equivalent to add AlwaysFailure as 3rd child.
 *
 */
export class IfThenElseNode extends ControlNode {
  private childIdx = 0;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "IfThenElse";
  }

  override tick(): NodeUserStatus {
    const childrenCount = this.children.length;

    if (![2, 3].includes(childrenCount)) {
      throw new Error("IfThenElseNode must have either 2 or 3 children");
    }

    this.setStatus(NodeStatus.RUNNING);

    if (this.childIdx === 0) {
      const condition = this.children[0].executeTick();

      if (condition === NodeStatus.RUNNING) return NodeStatus.RUNNING;

      if (condition === NodeStatus.SUCCESS) {
        this.childIdx = 1;
      } else if (condition === NodeStatus.FAILURE) {
        if (childrenCount === 3) this.childIdx = 2;
        else return condition;
      }
    }

    // not an else
    if (this.childIdx > 0) {
      const status = this.children[this.childIdx].executeTick() as NodeUserStatus;
      if (status === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      } else {
        this.resetChildren();
        this.childIdx = 0;
        return status;
      }
    }

    throw new Error("Something unexpected happened in IfThenElseNode");
  }

  override halt(): void {
    this.childIdx = 0;
    super.halt();
  }
}
