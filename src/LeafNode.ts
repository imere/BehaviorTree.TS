import { TreeNode, type NodeConfig } from "./TreeNode.js";
import type { NodeType, NodeUserStatus } from "./basic.js";

export abstract class LeafNode extends TreeNode {
  abstract override type: NodeType;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
  }

  protected abstract override tick(): NodeUserStatus;

  protected abstract override halt(): void;
}
