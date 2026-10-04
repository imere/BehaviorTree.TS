import { NodeConfig, TreeNode } from "./TreeNode.js";
import { NodeStatus, NodeType, type NodeUserStatus } from "./basic.js";

export abstract class DecoratorNode extends TreeNode {
  override type: NodeType = NodeType.Decorator;

  child: TreeNode | undefined;

  setChild(node: TreeNode): void {
    this.child = node;
  }

  override halt(): void {
    this.resetChild();
    this.resetStatus();
  }

  haltChild(): void {
    this.resetChild();
  }

  resetChild(): void {
    if (!this.child) return;
    if (this.child.status === NodeStatus.RUNNING) this.child.haltNode();
    this.child.resetStatus();
  }
}

/**
 * @brief The SimpleDecoratorNode provides an easy to use DecoratorNode.
 * The user should simply provide a callback with this signature
 *
 *    BT::NodeStatus functionName(BT::NodeStatus child_status)
 *
 * This avoids the hassle of inheriting from a DecoratorNode.
 *
 * Using lambdas or std::bind it is easy to pass a pointer to a method.
 * SimpleDecoratorNode does not support halting, NodeParameters, nor Blackboards.
 */
export class SimpleDecoratorNode extends DecoratorNode {
  constructor(
    name: string,
    config: NodeConfig,
    protected functor: <T extends SimpleDecoratorNode = SimpleDecoratorNode>(
      childStatus: NodeStatus,
      node: T
    ) => NodeUserStatus
  ) {
    super(name, config);
  }

  override tick(): NodeUserStatus {
    return this.functor(this.child!.executeTick(), this);
  }

  override executeTick(): NodeStatus {
    const status = super.executeTick();
    // Safety net for the decorators that don't reset a completed child.
    // Skipped while RUNNING: an asynchronous child may complete right after
    // tick() saw it RUNNING, and resetting it here would discard its result,
    // i.e. execute the action twice.
    if (status !== NodeStatus.RUNNING) {
      const childStatus = this.child!.status;
      if (childStatus === NodeStatus.SUCCESS || childStatus === NodeStatus.FAILURE) {
        this.child!.resetStatus();
      }
    }
    return status;
  }
}
