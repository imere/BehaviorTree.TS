import { TreeNode } from "./TreeNode";
import { NodeStatus, NodeType } from "./basic";

export abstract class ControlNode extends TreeNode {
  override type: NodeType = NodeType.Control;

  readonly children: TreeNode[] = [];

  addChild(child: TreeNode): void {
    this.children.push(child);
  }

  childrenCount(): number {
    return this.children.length;
  }

  override halt(): void {
    this.resetChildren();
    this.resetStatus();
  }

  resetChildren(): void {
    for (const child of this.children) {
      if (child.status === NodeStatus.RUNNING) child.haltNode();
      child.resetStatus();
    }
  }

  haltChild(i: number): void {
    const child = this.children[i];
    if (child.status === NodeStatus.RUNNING) child.haltNode();
    child.resetStatus();
  }

  haltChildren(): void {
    for (let i = 0; i < this.children.length; i++) this.haltChild(i);
  }
}
