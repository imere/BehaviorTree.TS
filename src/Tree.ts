import { ActionNodeBase } from "./ActionNode.js";
import { ConditionNode } from "./ConditionNode.js";
import { ControlNode } from "./ControlNode.js";
import { DecoratorNode } from "./DecoratorNode.js";
import { TreeNode } from "./TreeNode.js";
import { NodeType } from "./basic.js";
import { info } from "./Logger.js";
import { SubTreeNode } from "./decorators/SubtreeNode.js";
import { type AbstractConstructorType, type ConstructorType } from "./utils/index.js";

export function applyRecursiveVisitor(
  node: TreeNode | undefined,
  visitor: <T extends TreeNode>(node: T) => void
): void {
  if (!node) {
    throw new Error("One of the children of a DecoratorNode or ControlNode is undefined");
  }

  visitor(node);

  if (node instanceof ControlNode) {
    for (const child of node.children) {
      applyRecursiveVisitor(child, visitor);
    }
  } else if (node instanceof DecoratorNode) {
    applyRecursiveVisitor(node.child, visitor);
  }
}

export function printTreeRecursively(
  root: TreeNode,
  line: (line: string) => void = (text) => info(text)
): void {
  print(0, root);

  function print(indent: number, node: TreeNode | undefined): void {
    let ret = "  ".repeat(indent);

    if (!node) {
      ret += "!null!";
      line(ret);
      return;
    }

    ret += node.name;

    line(ret);

    indent++;

    if (node instanceof ControlNode) {
      for (const child of node.children) {
        print(indent, child);
      }
    } else if (node instanceof DecoratorNode) {
      print(indent, node.child);
    }
  }
}

export function isDerivedFrom(
  Ctor: ConstructorType<unknown> | AbstractConstructorType<unknown>,
  base: ConstructorType<unknown> | AbstractConstructorType<unknown>
): boolean {
  let proto = Ctor;
  while (proto) {
    if (proto === base) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

export function getType<T extends TreeNode>(
  Ctor: ConstructorType<T> | AbstractConstructorType<T>
): NodeType {
  if (isDerivedFrom(Ctor, ActionNodeBase)) return NodeType.Action;
  if (isDerivedFrom(Ctor, ConditionNode)) return NodeType.Condition;
  if (isDerivedFrom(Ctor, SubTreeNode)) return NodeType.SubTree;
  if (isDerivedFrom(Ctor, DecoratorNode)) return NodeType.Decorator;
  if (isDerivedFrom(Ctor, ControlNode)) return NodeType.Control;
  return NodeType.Undefined;
}
