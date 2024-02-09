import { SyncActionNode } from "../ActionNode";
import { NodeConfig } from "../TreeNode";
import { NodeStatus, type NodeUserStatus } from "../basic";

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
