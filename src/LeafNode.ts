import { TreeNode, type NodeConfig } from "./TreeNode";
import type { NodeType, NodeUserStatus } from "./basic";

export abstract class LeafNode extends TreeNode {
  abstract override type: NodeType;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
  }

  protected abstract override tick(): NodeUserStatus;

  protected abstract override halt(): void;
}
