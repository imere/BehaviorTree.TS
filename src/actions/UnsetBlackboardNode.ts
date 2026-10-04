import { SyncActionNode } from "../ActionNode.js";
import type { NodeConfig } from "../TreeNode.js";
import { NodeStatus, PortList, createInputPort, type NodeUserStatus } from "../basic.js";

export class UnsetBlackboardNode extends SyncActionNode {
  static providedPorts() {
    return new PortList([createInputPort("key", "Key of the entry to remove")]);
  }

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "UnsetBlackboard";
  }

  override tick(): NodeUserStatus {
    const key = this.getInputOrThrow("key");
    this.config.blackboard.delete(key);
    return NodeStatus.SUCCESS;
  }
}
