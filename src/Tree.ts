import { ActionNodeBase } from "./ActionNode";
import { ConditionNode } from "./ConditionNode";
import { ControlNode } from "./ControlNode";
import { DecoratorNode } from "./DecoratorNode";
import { TreeNode } from "./TreeNode";
import { NodeType } from "./basic";
import { SubtreeNode } from "./decorators/SubtreeNode";
import { type AbstractConstructorType, type ConstructorType } from "./utils";

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
  line: (line: string) => void = console.log
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
  if (isDerivedFrom(Ctor, SubtreeNode)) return NodeType.Subtree;
  if (isDerivedFrom(Ctor, DecoratorNode)) return NodeType.Decorator;
  if (isDerivedFrom(Ctor, ControlNode)) return NodeType.Control;
  return NodeType.Undefined;
}
