import { NodeStatus, NodeType } from "../basic.js";
import { fail } from "./XmlError.js";
import { validateModelName } from "./nameValidation.js";
import type { TreeNodeObject, TreeObject } from "./TreeObject.js";

const MAX_NESTING_DEPTH = 256;

/** Controls that keep running on their own, so only one may sit in a row. */
const ASYNC_CHILDREN = ["ThreadedAction", "StatefulActionNode", "CoroActionNode", "AsyncSequence"];

/**
 * Checks that the document is a tree the factory can actually build, before
 * anything is instantiated. Every rejection names the element it is about and
 * where that element was written.
 *
 * `builtinTags` are the element names that select a node type by their [ID]
 * rather than by their own name; the factory owns that set.
 */
export function verifyTreeObject(
  json: TreeObject | undefined | null,
  registeredNodes: Map<string, NodeType>,
  builtinTags: ReadonlySet<string>
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
      if (builtinTags.has(node.name) && !node.props?.ID) {
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

    const isBuiltin = builtinTags.has(name);
    if (isBuiltin && !id) {
      fail(node, `The tag <${name}> must have the attribute [ID]`);
    }

    if (name === "SubTree") {
      expectChildren(node, 0, "SubTree" + (id as string));
      if (registeredNodes.has(id as string)) {
        fail(
          node,
          "The attribute [ID] of tag <SubTree> must not use the name of a registered Node"
        );
      }
      validateModelName(id as string, node);
    } else if (name === "BehaviorTree") {
      expectChildren(node, 1, "BehaviorTree" + (id ?? "Tree_0"));
      if (!id && behavior_tree_count > 1) {
        fail(node, "The tag <BehaviorTree> must have the attribute [ID]");
      }
      if (registeredNodes.has(id as string)) {
        fail(
          node,
          "The attribute [ID] of tag <BehaviorTree> must not use the name of a registered Node"
        );
      }
      if (id) validateModelName(id, node);
    } else {
      // use ID for builtin node types, otherwise use the element name
      const lookupName = isBuiltin ? (id as string) : name;

      // a custom node type is registered under its element name
      if (!isBuiltin) validateModelName(name, node);

      const search = registeredNodes.get(lookupName);
      if (search === undefined) {
        fail(node, `Node not recognized: ${lookupName}`);
      }

      if (search === NodeType.Decorator) {
        expectChildren(node, 1, lookupName);
      } else if (search === NodeType.Control) {
        expectChildren(node, Infinity, lookupName);
        if (lookupName === "TryCatch" && (node.children?.length ?? 0) < 2) {
          fail(node, "The node 'TryCatch' must have at least 2 children");
        }
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

/**
 * `name` is what the type was registered under, which is what upstream names in
 * its message: for `<Action ID="AlwaysSuccess">` that is AlwaysSuccess, not the
 * element name Action.
 */
function expectChildren(node: TreeNodeObject, childrenCount: number, name: string): void {
  const count = node.children?.length || 0;
  if (childrenCount === Infinity) {
    if (!count) {
      fail(node, `The node '${name}' must have 1 or more children`);
    }
  } else if (count !== childrenCount) {
    fail(node, `The node '${name}' must have exactly ${childrenCount} child`);
  }
}
