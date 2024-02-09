import { DecoratorNode } from "../DecoratorNode";
import { NodeConfig } from "../TreeNode";
import { NodeStatus, isStatusCompleted, type NodeUserStatus } from "../basic";

/**
 * @brief The ForceSuccessNode returns always SUCCESS or RUNNING.
 */
export class ForceSuccessNode extends DecoratorNode {
  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "ForceSuccess";
  }

  protected override tick(): NodeUserStatus {
    this.setStatus(NodeStatus.RUNNING);

    const childStatus = this.child!.executeTick();

    if (isStatusCompleted(childStatus)) {
      this.resetChild();
      return NodeStatus.SUCCESS;
    }

    return childStatus as NodeUserStatus;
  }
}
