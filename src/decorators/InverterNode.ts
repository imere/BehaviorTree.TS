import { DecoratorNode } from "../DecoratorNode.js";
import { NodeConfig } from "../TreeNode.js";
import { NodeStatus, type NodeUserStatus } from "../basic.js";

/**
 * @brief The InverterNode returns SUCCESS if child fails
 * of FAILURE is child succeeds.
 * RUNNING status is propagated
 */
export class InverterNode extends DecoratorNode {
  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "Inverter";
  }

  protected override tick(): NodeUserStatus {
    this.setStatus(NodeStatus.RUNNING);

    const childStatus = this.child!.executeTick();

    switch (childStatus) {
      case NodeStatus.SUCCESS: {
        this.resetChild();
        return NodeStatus.FAILURE;
      }
      case NodeStatus.FAILURE: {
        this.resetChild();
        return NodeStatus.SUCCESS;
      }
      case NodeStatus.RUNNING:
      case NodeStatus.SKIPPED: {
        return childStatus;
      }
      case NodeStatus.IDLE: {
        throw new Error(`${this.name}: A children should not return IDLE`);
      }
    }

    return this.status as NodeUserStatus;
  }
}
