import {
  convertNodeNameToNodeType,
  isAllowedPortName,
  isReservedAttribute,
  NodeType,
  PortDirection,
  type PortList,
} from "./basic";
import { Blackboard } from "./Blackboard";
import { ControlNode } from "./ControlNode";
import { DecoratorNode } from "./DecoratorNode";
import { SubTreeNode } from "./decorators/SubtreeNode";
import { ElementType, parseDocument, type Element } from "./modules/htmlparser2/exports";
import { type EnumsTable } from "./scripting/parser";
import { Subtree, Tree, type TreeFactory } from "./TreeFactory";
import {
  convertToString as convertConditionToString,
  NodeConfig,
  PortsRemapping,
  PostCondition,
  PreCondition,
  TreeNode,
  TreeNodeManifest,
  type NonPortAttributes,
} from "./TreeNode";
import { getEnumKeys } from "./utils";

export const convertFromString = (scriptingEnums: EnumsTable, value: string | undefined) => {
  if (value === undefined) return;
  if (scriptingEnums.has(value)) return scriptingEnums.get(value);
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export interface TreeObject {
  name: string;
  props?: Partial<Record<"BTTS_format" | (string & {}), string>>;
  children: TreeNodeObject[];
}

export interface TreeNodeObject {
  name: string;
  props?: Partial<Record<"ID" | "name" | (string & {}), string>>;
  children?: TreeNodeObject[];
}

interface SubtreeModel {
  ports: PortList;
}

export function parseXML(xml: string): TreeObject {
  xml = xml.trim();

  const ret: TreeObject = { name: "root", children: [] };
  const doc = parseDocument(xml, { xmlMode: true }) as unknown as Element;

  for (const element of withoutSpecialTextChildren(doc)) {
    if (element.type === ElementType.Text && !element.data?.trim()) continue;
    setNode(ret, element);
  }

  return ret;

  function setNode(parent: TreeNodeObject, element: Element): void {
    if (element.type === ElementType.Text) {
      return;
    }

    parent.name = element.name;
    parent.props = element.attribs;

    let children = withoutSpecialTextChildren(element);
    const shouldStripText = children.some((child) => child.type === ElementType.Tag);
    const shouldStitchText =
      !shouldStripText && children.every((child) => child.type === ElementType.Text);

    if (shouldStripText) {
      children = children.filter((child) => child.type !== ElementType.Text);
    }

    if (shouldStitchText) {
      return;
    }

    for (const elem of children) {
      const node: TreeNodeObject = {
        name: "",
        props: {},
        children: [],
      };
      parent.children?.push(node);
      setNode(node, elem);
    }
  }

  function withoutSpecialTextChildren(element: Element): Element[] {
    return (element.children || []).filter((child) => {
      return ![ElementType.CDATA, ElementType.Comment].includes(child.type);
    });
  }
}

export class Parser {
  private openedDocuments: TreeObject[];

  private treeRoots: Map<string, TreeNodeObject>;

  private subtreeModels = new Map<string, SubtreeModel>();

  private suffixCount = 0;

  constructor(private readonly factory: TreeFactory) {
    this.openedDocuments = [];
    this.treeRoots = new Map();
  }

  get registeredBehaviorTrees(): string[] {
    return [...this.treeRoots.keys()];
  }

  loadFromXML(xml: string): void {
    this.loadFromObject(parseXML(xml));
  }

  loadSubtreeModel(_json: TreeObject): void {
    // for (
    //   let modelsNodeIdx = json.children.findIndex((child) => child.name === "TreeNodesModel"),
    //     modelsNode = json.children[modelsNodeIdx];
    //   modelsNode;
    //   modelsNodeIdx = json.children.findIndex(
    //     (child, i) => modelsNodeIdx < i && child.name === "TreeNodesModel"
    //   )
    // ) {
    //   for (
    //     let subNodeIdx = modelsNode.children?.findIndex((child) => child.name === "SubTree"),
    //       subNode = modelsNode.children?.[subNodeIdx!];
    //     subNode;
    //     subNodeIdx = modelsNode.children?.findIndex(
    //       (child, i) => subNodeIdx! < i && child.name === "SubTree"
    //     )
    //   ) {
    //     const subtreeId = subNode.props?.ID;
    //   }
    // }
  }

  loadFromObject(json: TreeObject): void {
    this.openedDocuments.push(json);
    this._loadFromObject(json);
  }

  private _loadFromObject(json: TreeObject): void {
    if (!json.props?.BTTS_format) {
      console.warn("The first tag of the (<root>) should contain the attribute [BTTS_format]");
    }

    // Collect the names of all nodes registered with the behavior tree factory
    const registeredNodes = new Map<string, NodeType>();
    for (const [key, { type }] of this.factory.manifests) {
      registeredNodes.set(key, type);
    }

    this.verifyTreeObject(json, registeredNodes);

    this.loadSubtreeModel(json);

    for (let i = 0, node: TreeNodeObject = json.children[i]; (node = json.children[i]); i++) {
      const treeName = node.props?.ID || `Tree_${this.suffixCount++}`;
      this.treeRoots.set(treeName, node);
    }
  }

  verifyTreeObject(
    json: TreeObject | undefined | null,
    registeredNodes: Map<string, NodeType>
  ): void {
    const root = json;

    if (!root || root.name !== "root") {
      throw new Error("The doc must have a root node called <root>");
    }

    //-------------------------------------------------

    const modelsRoots = root.children.filter((o) => o.name === "TreeNodesModel");
    const modelsRoot = modelsRoots[0];

    if (modelsRoots.length > 1) {
      throw new Error("Only a single node <TreeNodesModel> is supported");
    }

    if (modelsRoot) {
      // not having a MetaModel is not an error. But consider that the
      // Graphical editor needs it.
      for (const node of root.children) {
        const { name } = node;
        if (["Action", "Decorator", "SubTree", "Condition", "Control"].includes(name)) {
          const id = node.props?.ID;
          if (!id) {
            throw new Error(`${name}: The attribute  [ID] is mandatory`);
          }
        }
      }
    }

    //-------------------------------------------------

    const behavior_tree_count = root.children.filter((o) => o.name === "BehaviorTree").length;

    // function to be called recursively
    const recursiveStep = (node: TreeNodeObject) => {
      const { name } = node;
      if (name === "Decorator") {
        expect(node, 1, ["ID"]);
      } else if (name === "Action") {
        expect(node, 0, ["ID"]);
      } else if (name === "Condition") {
        expect(node, 0, ["ID"]);
      } else if (name === "Control") {
        expect(node, Infinity, ["ID"]);
      } else if (["Sequence", "SequenceStar", "Fallback"].includes(name)) {
        expect(node, Infinity);
      } else if (name === "SubTree") {
        expect(node, 0, ["ID"]);
        if (registeredNodes.has(node.props?.ID as string)) {
          throw new Error(
            "The attribute [ID] of tag <SubTree> must not use the name of a registered Node"
          );
        }
      } else if (name === "BehaviorTree") {
        expect(node, 1);
        if (!node.props?.ID && behavior_tree_count > 1) {
          throw new Error("The tag <BehaviorTree> must have the attribute [ID]");
        }
        if (registeredNodes.has(node.props?.ID as string)) {
          throw new Error(
            "The attribute [ID] of tag <BehaviorTree> must not use the name of a registered Node"
          );
        }
      } else {
        const search = registeredNodes.get(name);
        if (search === undefined) {
          throw new Error(`Node not recognized: ${name}`);
        }

        if (search === NodeType.Decorator) {
          expect(node, 1);
        } else if (search === NodeType.Control) {
          expect(node, Infinity);
          if (name === "ReactiveSequence") {
            let asyncCount = 0;
            for (const { name: childName } of node.children || []) {
              const childType = registeredNodes.get(childName);
              if (
                childType === NodeType.Control &&
                [
                  "ThreadedAction",
                  "StatefulActionNode",
                  "CoroActionNode",
                  "AsyncSequence",
                ].includes(childName)
              ) {
                asyncCount++;
                if (asyncCount > 1) {
                  throw new Error("A ReactiveSequence cannot have more than one async child.");
                }
              }
            }
          }
        }
      }

      //recursion
      for (const child of node.children || []) {
        recursiveStep(child);
      }
    };

    for (const btRoot of root.children.filter((o) => o.name === "BehaviorTree")) {
      recursiveStep(btRoot);
    }

    function expect(node: TreeNodeObject, childrenCount: number, propNames?: string[]) {
      const { name } = node;
      const count = node.children?.length || 0;
      if (childrenCount === Infinity) {
        if (!count) {
          throw new Error(`The tag <${name}> must  have at least 1 child`);
        }
      } else if (count !== childrenCount) {
        throw new Error(
          `The tag <${name}> must ${
            childrenCount ? `have exactly ${childrenCount}` : "not have any"
          } child`
        );
      }
      propNames?.forEach((prop) => {
        if (!node.props?.[prop]) {
          throw new Error(`The tag <${name}> must have the attribute [${prop}]`);
        }
      });
    }
  }

  instantiateTree(
    rootBlackboard: Blackboard,
    mainTreeId: string | undefined,
    params: { scriptingEnums: EnumsTable }
  ): Tree {
    const ret: Tree = new Tree();

    if (!mainTreeId) {
      const firstRoot = this.openedDocuments[0];
      mainTreeId = firstRoot.props?.mainTreeToExecute;
      if (!mainTreeId) {
        if (this.treeRoots.size === 1) {
          mainTreeId = [...this.treeRoots.keys()][0];
        } else {
          throw new Error("[mainTreeToExecute] was not specified correctly");
        }
      }
    }

    if (!rootBlackboard) {
      throw new Error("instantiateTree needs a non-empty root_blackboard");
    }

    this.recursivelyCreateSubtree(
      mainTreeId,
      "",
      "",
      ret,
      rootBlackboard,
      new TreeNode("", new NodeConfig()),
      params
    );

    ret.initialize();

    return ret;
  }

  recursivelyCreateSubtree(
    treeId: string | undefined,
    treeName: string,
    prefixPath: string,
    tree: Tree,
    blackboard: Blackboard,
    rootNode: TreeNode,
    params: { scriptingEnums: EnumsTable }
  ): void {
    const recursiveStep = (
      parent: TreeNode,
      subtree: Subtree,
      prefix: string,
      json: TreeNodeObject
    ): void => {
      // create the node
      const node = this.createNodeFromObject(json, blackboard, parent, prefix, tree);
      subtree.nodes.push(node);

      // common case: iterate through all children
      if (node.type !== NodeType.SubTree) {
        for (const child of json.children || []) {
          recursiveStep(node, subtree, prefix, child);
        }
      } else {
        const newBB = Blackboard.create(blackboard);
        const subtreeId = json.props?.ID;
        const subtreeRemapping = new Map();
        let doAutoRemap = false;

        for (let [attrName, attrValue] of Object.entries(json.props || {})) {
          if (attrValue === "{=}") attrValue = `{${attrName}}`;

          if (attrName === "_autoremap") {
            doAutoRemap = convertFromString(params.scriptingEnums, attrValue);
            newBB.enableAutoRemapping(doAutoRemap);
            continue;
          }

          if (!isAllowedPortName(attrName)) continue;

          subtreeRemapping.set(attrName, convertFromString(params.scriptingEnums, attrValue));
        }
        // check if this subtree has a model. If it does,
        // we want to check if all the mandatory ports were remapped and
        // add default ones, if necessary
        if (this.subtreeModels.has(subtreeId!)) {
          const subtreeModel = this.subtreeModels.get(subtreeId!)!;
          const subtreeModelPorts = subtreeModel.ports;
          // check if:
          // - remapping contains mandatory ports
          // - if any of these has default value
          for (const [portName, portInfo] of subtreeModelPorts) {
            // don't override existing remapping
            if (!subtreeRemapping.has(portName) && !doAutoRemap) {
              // remapping is not explicitly defined in the XML: use the model
              if (typeof portInfo.defaultValue === "undefined") {
                throw new Error(
                  [
                    'In the <TreeNodesModel> the <SubTree ID="',
                    subtreeId,
                    '"> is defining a mandatory port called [',
                    portName,
                    "], but you are not remapping it",
                  ].join("")
                );
              } else {
                subtreeRemapping.set(portName, portInfo.defaultValue);
              }
            }
          }
        }

        for (const [attrName, attrValue] of subtreeRemapping) {
          if (TreeNode.stripBlackboardPointer(attrValue)) {
            // do remapping
            const portName = TreeNode.stripBlackboardPointer(attrValue)!;
            newBB.addSubtreeRemapping(attrName, portName);
          } else {
            // constant string: just set that constant value into the BB
            // IMPORTANT: this must not be auto remapped!!!
            newBB.enableAutoRemapping(false);
            newBB.set(attrName, convertFromString(params.scriptingEnums, attrValue));
            newBB.enableAutoRemapping(doAutoRemap);
          }
        }

        let subtreePath = subtree.name;
        if (subtreePath) subtreePath += "/";
        subtreePath += json.props?.name || `${subtreeId}::${node.uid}`;

        this.recursivelyCreateSubtree(
          subtreeId,
          subtreePath,
          `${subtreePath}/`,
          tree,
          newBB,
          node,
          params
        );
      }
    };

    if (treeId === undefined || !this.treeRoots.has(treeId)) {
      throw new Error(`Can't find a tree with name: ${treeId}`);
    }

    const root = this.treeRoots.get(treeId)!.children![0];

    //-------- start recursion -----------

    // Append a new subtree to the list
    const newTree = new Subtree();
    newTree.blackboard = blackboard;
    newTree.name = treeName;
    newTree.id = treeId;
    tree.subtrees.push(newTree);

    recursiveStep(rootNode, newTree, prefixPath, root);
  }

  createNodeFromObject(
    json: TreeNodeObject,
    blackboard: Blackboard,
    nodeParent: TreeNode | undefined,
    prefixPath: string,
    tree: Tree
  ): TreeNode {
    const [name, id] = [json.name, json.props?.ID];
    const nodeType = convertNodeNameToNodeType(name);

    // name used by the factory
    let typeId: string;
    if (nodeType === NodeType.Undefined) {
      // This is the case of nodes like <MyCustomAction>
      // check if the factory has this name
      if (!this.factory.builders.has(name)) {
        throw new Error(`${name} is not a registered node`);
      }
      typeId = name;
      if (id) {
        throw new Error(`Attribute [ID] is not allowed in <${typeId}>`);
      }
    } else {
      typeId = id!;
      // in this case, it is mandatory to have a field "ID"
      if (!id) {
        throw new Error(`Attribute [ID] is mandatory in <${typeId}>`);
      }
    }

    // By default, the instance name is equal to ID, unless the
    // attribute [name] is present.
    const attrName = json.props?.name;
    const instanceName = attrName || typeId;

    const manifest: TreeNodeManifest | undefined = this.factory.manifests.get(typeId);

    const portRemap: PortsRemapping = new Map();
    const otherAttributes: NonPortAttributes = new Map();

    for (const [portName, portValue] of Object.entries(
      (json.props || {}) as Record<string, string>
    )) {
      if (isAllowedPortName(portName)) {
        if (manifest) {
          if (!manifest.ports.has(portName)) {
            throw new Error(
              `A port with name [${portName}] is found in the XML, but not in the providedPorts()`
            );
          }
        }

        portRemap.set(portName, portValue);
      } else if (!isReservedAttribute(portName)) {
        otherAttributes.set(portName, portValue);
      }
    }

    const config = new NodeConfig();
    config.blackboard = blackboard;
    config.path = `${prefixPath}${instanceName}`;
    config.uid = tree.getUID();
    config.manifest = manifest;

    if (typeId === instanceName) {
      config.path += `::${config.uid}`;
    }

    const addCondition = (
      conditions: Map<string | number, string>,
      attrName: string,
      id: string | number
    ) => {
      const script = json.props?.[attrName];
      if (script) {
        conditions.set(id, script);
        otherAttributes.delete(attrName);
      }
    };

    for (const key of getEnumKeys(PreCondition)) {
      addCondition(config.preConditions, convertConditionToString(key), PreCondition[key]);
    }

    for (const key of getEnumKeys(PostCondition)) {
      addCondition(config.postConditions, convertConditionToString(key), PostCondition[key]);
    }

    config.otherAttributes = otherAttributes;

    //---------------------------------------------

    let newNode: TreeNode = new TreeNode(instanceName, config);

    if (nodeType === NodeType.SubTree) {
      config.input = portRemap;
      newNode = this.factory.instantiateTreeNode(instanceName, NodeType[NodeType.SubTree], config);
      const subtreeNode = newNode as SubTreeNode;
      subtreeNode.setSubtreeId(typeId);
    } else {
      if (!manifest) {
        throw new Error("Missing manifest. It shouldn't happen. Please report this issue");
      }

      // Check that name in remapping can be found in the manifest
      for (const key of portRemap.keys()) {
        if (!manifest.ports.has(key)) {
          throw new Error(`you tried to remap port [${key}] in node [${typeId} / ${instanceName}]`);
        }
      }

      // Initialize the ports in the BB to set the type
      for (const [portName, portInfo] of manifest.ports) {
        if (!portRemap.has(portName)) continue;
        const remappedPort = portRemap.get(portName)!;
        const portKey = TreeNode.getRemappedKey(portName, remappedPort);
        if (portKey !== undefined) {
          const prevInfo = blackboard.portInfo(portKey);
          // not found, insert for the first time.
          if (!prevInfo) blackboard.createEntry(portKey, portInfo);
        }
      }

      // Set the port direction in config
      for (const remap of portRemap) {
        const portName = remap[0];
        if (manifest.ports.has(portName)) {
          const { direction } = manifest.ports.get(portName)!;
          if (direction !== PortDirection.OUTPUT) config.input.set(...remap);
          if (direction !== PortDirection.INPUT) config.output.set(...remap);
        }
      }

      // use default value if available for empty ports. Only inputs
      for (const [portName, portInfo] of manifest.ports) {
        const { direction, defaultValue, defaultValueString } = portInfo;

        if (defaultValue !== undefined) {
          if (direction !== PortDirection.OUTPUT && !config.input.has(portName)) {
            config.input.set(portName, defaultValueString);
          }

          if (direction !== PortDirection.INPUT && !config.output.has(portName)) {
            config.output.set(portName, defaultValueString);
          }
        }
      }

      newNode = this.factory.instantiateTreeNode(instanceName, typeId, config);
    }

    // add the pointer of this node to the parent
    if (nodeParent) {
      if (nodeParent instanceof ControlNode) {
        nodeParent.addChild(newNode);
      } else if (nodeParent instanceof DecoratorNode) {
        nodeParent.setChild(newNode);
      }
    }

    return newNode;
  }

  clear(): void {
    this.suffixCount = 0;
    this.openedDocuments.splice(0);
    this.treeRoots.clear();
  }
}

export function buildTreeFromObject(
  factory: TreeFactory,
  json: TreeObject,
  blackboard: Blackboard,
  params: { scriptingEnums: EnumsTable }
): Tree {
  const parser = new Parser(factory);
  parser.loadFromObject(json);
  return parser.instantiateTree(blackboard, undefined, params);
}
