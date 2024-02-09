import { DecoratorNode } from "../DecoratorNode";
import { NodeConfig } from "../TreeNode";
import { NodeStatus, isStatusCompleted, type NodeUserStatus } from "../basic";

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
