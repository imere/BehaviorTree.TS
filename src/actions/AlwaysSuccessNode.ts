import { SyncActionNode } from "../ActionNode.js";
import { NodeConfig } from "../TreeNode.js";
import { NodeStatus, type NodeUserStatus } from "../basic.js";

/**
 * Simple actions that always returns SUCCESS.
 */
export class AlwaysSuccessNode extends SyncActionNode {
  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "AlwaysSuccess";
  }

  override tick(): NodeUserStatus {
    return NodeStatus.SUCCESS;
  }
}
