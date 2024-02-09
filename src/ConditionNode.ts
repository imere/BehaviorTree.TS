import { ControlNode } from "./ControlNode";
import type { NodeConfig } from "./TreeNode";
import { NodeType, type NodeUserStatus } from "./basic";

export abstract class ConditionNode extends ControlNode {
  override type: NodeType = NodeType.Condition;

  override halt(): void {
    this.resetStatus();
  }
}

export class SimpleConditionNode extends ConditionNode {
  constructor(
    name: string,
    config: NodeConfig,
    protected functor: <T extends SimpleConditionNode = SimpleConditionNode>(
      node: T
    ) => NodeUserStatus
  ) {
    super(name, config);
  }

  protected override tick(): NodeUserStatus {
    return this.functor(this);
  }
}
