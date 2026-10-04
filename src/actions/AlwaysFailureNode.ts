import { SyncActionNode } from "../ActionNode.js";
import { NodeConfig } from "../TreeNode.js";
import { NodeStatus, type NodeUserStatus } from "../basic.js";

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
