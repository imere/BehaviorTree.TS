import { DecoratorNode } from "../DecoratorNode.js";
import { NodeConfig } from "../TreeNode.js";
import { NodeStatus, isStatusCompleted, type NodeUserStatus } from "../basic.js";

/**
 * @brief The ForceFailureNode returns always FAILURE or RUNNING.
 */
export class ForceFailureNode extends DecoratorNode {
  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "ForceFailure";
  }

  protected override tick(): NodeUserStatus {
    this.setStatus(NodeStatus.RUNNING);

    const childStatus = this.child!.executeTick();

    if (isStatusCompleted(childStatus)) {
      this.resetChild();
      return NodeStatus.FAILURE;
    }

    return childStatus as NodeUserStatus;
  }
}
