import { SyncActionNode } from "../ActionNode";
import { NodeConfig } from "../TreeNode";
import { NodeStatus, type NodeUserStatus } from "../basic";

/**
 * Simple actions that always returns FAILURE.
 */
export class AlwaysFailureNode extends SyncActionNode {
  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "AlwaysFailure";
  }

  override tick(): NodeUserStatus {
    return NodeStatus.FAILURE;
  }
}
