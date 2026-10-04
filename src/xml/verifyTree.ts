import { NodeType } from "../basic.js";
import { fail } from "./XmlError.js";
import type { TreeNodeObject, TreeObject } from "./TreeObject.js";

const MAX_NESTING_DEPTH = 256;

const BUILTIN_TAGS = ["Decorator", "Action", "Condition", "Control", "SubTree"];

/** Controls that keep running on their own, so only one may sit in a row. */
const ASYNC_CHILDREN = ["ThreadedAction", "StatefulActionNode", "CoroActionNode", "AsyncSequence"];

/**
 * Checks that the document is a tree the factory can actually build, before
 * anything is instantiated. Every rejection names the element it is about and
 * where that element was written.
 */
export function verifyTreeObject(
  json: TreeObject | undefined | null,
  registeredNodes: Map<string, NodeType>
): void {
  const root = json;

  if (!root || root.name !== "root") {
    fail(root ?? undefined, "The doc must have a root node called <root>");
  }

  //-------------------------------------------------

  const modelsRoots = root.children.filter((o) => o.name === "TreeNodesModel");

  if (modelsRoots.length > 1) {
    fail(modelsRoots[1], "Only a single node <TreeNodesModel> is supported");
  }

  if (modelsRoots.length > 0) {
    // not having a MetaModel is not an error. But consider that the
    // Graphical editor needs it.
    for (const node of root.children) {
      if (BUILTIN_TAGS.includes(node.name) && !node.props?.ID) {
        fail(node, `${node.name}: The attribute [ID] is mandatory`);
      }
    }
  }

  //-------------------------------------------------

  const behavior_tree_count = root.children.filter((o) => o.name === "BehaviorTree").length;

  for (const btRoot of root.children.filter((o) => o.name === "BehaviorTree")) {
    verifyNode(btRoot, 0);
  }

  function verifyNode(node: TreeNodeObject, depth: number): void {
    if (depth > MAX_NESTING_DEPTH) {
      fail(
        node,
        `Maximum XML nesting depth exceeded (limit: ${MAX_NESTING_DEPTH}). ` +
          `The XML is too deeply nested.`
      );
    }

    const { name } = node;
    const id = node.props?.ID as string | undefined;

    const isBuiltin = BUILTIN_TAGS.includes(name);
    if (isBuiltin && !id) {
      fail(node, `The tag <${name}> must have the attribute [ID]`);
    }

    if (name === "SubTree") {
      expectChildren(node, 0);
      if (registeredNodes.has(id as string)) {
        fail(
          node,
          "The attribute [ID] of tag <SubTree> must not use the name of a registered Node"
        );
      }
    } else if (name === "BehaviorTree") {
      expectChildren(node, 1);
      if (!id && behavior_tree_count > 1) {
        fail(node, "The tag <BehaviorTree> must have the attribute [ID]");
      }
      if (registeredNodes.has(id as string)) {
        fail(
          node,
          "The attribute [ID] of tag <BehaviorTree> must not use the name of a registered Node"
        );
      }
    } else if (!["Sequence", "Fallback"].includes(name)) {
      // builtin node types are looked up by their ID, everything else by the
      // element name
      const lookupName = isBuiltin ? (id as string) : name;
      const search = registeredNodes.get(lookupName);
      if (search === undefined) {
        fail(node, `Node not recognized: ${lookupName}`);
      }

      if (search === NodeType.Decorator) {
        expectChildren(node, 1);
      } else if (search === NodeType.Action || search === NodeType.Condition) {
        expectChildren(node, 0);
      } else if (search === NodeType.Control) {
        expectChildren(node, Infinity);
        // keyed off the registration, as upstream does, so
        // <Control ID="ReactiveSequence"> is checked too
        if (lookupName === "ReactiveSequence") {
          verifyReactiveSequence(node, registeredNodes);
        }
      }
    }

    for (const child of node.children || []) {
      verifyNode(child, depth + 1);
    }
  }
}

/** A ReactiveSequence ticks children as they complete, so two would race. */
function verifyReactiveSequence(
  node: TreeNodeObject,
  registeredNodes: Map<string, NodeType>
): void {
  let asyncCount = 0;
  for (const child of node.children || []) {
    const childType = registeredNodes.get(child.name);
    if (childType === undefined) {
      fail(child, `Unknown node type: ${child.name}`);
    }
    if (childType === NodeType.Control && ASYNC_CHILDREN.includes(child.name)) {
      asyncCount++;
      if (asyncCount > 1) {
        fail(node, "A ReactiveSequence cannot have more than one async child.");
      }
    }
  }
}

function expectChildren(node: TreeNodeObject, childrenCount: number, propNames?: string[]): void {
  const { name } = node;
  const count = node.children?.length || 0;
  if (childrenCount === Infinity) {
    if (!count) {
      fail(node, `The tag <${name}> must have at least 1 child`);
    }
  } else if (count !== childrenCount) {
    fail(
      node,
      `The tag <${name}> must ${
        childrenCount ? `have exactly ${childrenCount}` : "not have any"
      } child`
    );
  }
  propNames?.forEach((prop) => {
    if (!node.props?.[prop]) {
      fail(node, `The tag <${name}> must have the attribute [${prop}]`);
    }
  });
}
