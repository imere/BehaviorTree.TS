import { createPortInfo, PortDirection, PortList } from "../basic.js";
import { fail } from "./XmlError.js";
import { validatePortName } from "./nameValidation.js";
import type { TreeNodeObject, TreeObject } from "./TreeObject.js";

/** The ports one <SubTree> declares in a <TreeNodesModel>. */
export type SubtreeModel = {
  ports: PortList;
};

/** Subtree models by the ID they were declared under. */
export type SubtreeModels = Map<string, SubtreeModel>;

const PORT_TAGS: ReadonlyArray<readonly [string, PortDirection]> = [
  ["input_port", PortDirection.INPUT],
  ["output_port", PortDirection.OUTPUT],
  ["inout_port", PortDirection.INOUT],
];

/**
 * Reads every <TreeNodesModel> of a document into `into`, keyed by subtree ID.
 *
 * A subtree declared more than once keeps the ports of all its declarations, so
 * that separate <TreeNodesModel> blocks can each contribute part of a model.
 */
export function loadSubtreeModels(root: TreeObject, into: SubtreeModels): void {
  for (const modelsNode of childrenNamed(root, "TreeNodesModel")) {
    for (const subNode of childrenNamed(modelsNode, "SubTree")) {
      const subtreeId = subNode.props?.ID;
      if (!subtreeId) {
        fail(subNode, "Missing attribute 'ID' in SubTree element within TreeNodesModel");
      }

      let model = into.get(subtreeId);
      if (!model) {
        model = { ports: new PortList() };
        into.set(subtreeId, model);
      }
      readPorts(subNode, model.ports);
    }
  }
}

function readPorts(subNode: TreeNodeObject, ports: PortList): void {
  for (const [tag, direction] of PORT_TAGS) {
    for (const portNode of childrenNamed(subNode, tag)) {
      const portName = portNode.props?.name;
      if (!portName) {
        fail(portNode, "Missing attribute [name] in port (SubTree model)");
      }
      validatePortName(portName, portNode);

      const info = createPortInfo(direction, portNode.props?.description ?? "");
      if (portNode.props?.default !== undefined) {
        info.defaultValue = portNode.props.default;
      }
      ports.set(portName, info);
    }
  }
}

function childrenNamed(parent: TreeNodeObject, name: string): TreeNodeObject[] {
  return (parent.children ?? []).filter((child) => child.name === name);
}
