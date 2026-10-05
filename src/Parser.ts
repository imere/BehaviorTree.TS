import {
  convertNodeNameToNodeType,
  isAllowedPortName,
  isReservedAttribute,
  NodeType,
  PortDirection,
} from "./basic.js";
import { Blackboard } from "./Blackboard.js";
import { ControlNode } from "./ControlNode.js";
import { warn } from "./Logger.js";
import { DecoratorNode } from "./DecoratorNode.js";
import { SubTreeNode } from "./decorators/SubtreeNode.js";
import { parseXmlDocument } from "./xml/XmlDocument.js";
import { fail, type Positioned } from "./xml/XmlError.js";
import { validateInstanceName } from "./xml/nameValidation.js";
import { toTreeObject, type TreeNodeObject, type TreeObject } from "./xml/TreeObject.js";
import { loadSubtreeModels, type SubtreeModels } from "./xml/TreeNodesModel.js";
import { verifyTreeObject as verify } from "./xml/verifyTree.js";
import { type EnumsTable } from "./scripting/parser.js";
import { Subtree, Tree, type TreeFactory } from "./TreeFactory.js";
import {
  convertToString as convertConditionToString,
  NodeConfig,
  PortsRemapping,
  PostCondition,
  PreCondition,
  TreeNode,
  TreeNodeManifest,
  type NonPortAttributes,
} from "./TreeNode.js";
import { getEnumKeys } from "./utils/index.js";

export { type TreeNodeObject, type TreeObject };

export const convertFromString = (scriptingEnums: EnumsTable, value: string | undefined) => {
  if (value === undefined) return;
  if (scriptingEnums.has(value)) return scriptingEnums.get(value);
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export function parseXML(xml: string): TreeObject {
  return toTreeObject(parseXmlDocument(xml));
}

export class Parser {
  private openedDocuments: TreeObject[];

  private treeRoots: Map<string, TreeNodeObject>;

  private subtreeModels: SubtreeModels = new Map();

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

  loadFromObject(json: TreeObject): void {
    this.openedDocuments.push(json);

    if (!json.props?.BTTS_format) {
      warn("The first tag of the (<root>) should contain the attribute [BTTS_format]");
    }

    this.verifyTreeObject(json, this.registeredNodeTypes(), this.factory.builtinTags);
    this.loadSubtreeModel(json);

    // only <BehaviorTree> declares a tree; <TreeNodesModel> and anything else
    // sitting under <root> is not a runnable tree
    for (const node of json.children) {
      if (node.name !== "BehaviorTree") continue;
      this.treeRoots.set(node.props?.ID || `BehaviorTree_${this.suffixCount++}`, node);
    }
  }

  /**
   * Reads the subtree port models this document declares. They accumulate
   * across documents, so a model registered separately still applies.
   */
  loadSubtreeModel(json: TreeObject): void {
    loadSubtreeModels(json, this.subtreeModels);
  }

  private registeredNodeTypes(): Map<string, NodeType> {
    const registeredNodes = new Map<string, NodeType>();
    for (const [key, { type }] of this.factory.manifests) {
      registeredNodes.set(key, type);
    }
    return registeredNodes;
  }

  verifyTreeObject(
    json: TreeObject | undefined | null,
    registeredNodes: Map<string, NodeType>,
    builtinTags: ReadonlySet<string>
  ): void {
    verify(json, registeredNodes, builtinTags);
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
          fail(firstRoot, "[mainTreeToExecute] was not specified correctly");
        }
      }
    }

    if (!rootBlackboard) {
      fail(undefined, "instantiateTree needs a non-empty root_blackboard");
    }

    this.recursivelyCreateSubtree(
      mainTreeId,
      "",
      "",
      ret,
      rootBlackboard,
      new TreeNode("", new NodeConfig()),
      params,
      new Set<string>(),
      undefined
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
    params: { scriptingEnums: EnumsTable },
    ancestors: Set<string> = new Set(),
    origin?: Positioned
  ): void {
    if (treeId !== undefined) {
      if (ancestors.has(treeId)) {
        fail(origin, `Recursive subtree detected: [${treeId}] refers to itself`);
      }
      ancestors.add(treeId);
    }

    try {
      this.createSubtreeBody(
        treeId,
        treeName,
        prefixPath,
        tree,
        blackboard,
        rootNode,
        params,
        ancestors,
        origin
      );
    } finally {
      // a subtree may legitimately be referenced from several branches, so
      // the guard has to be released on the way back out
      if (treeId !== undefined) ancestors.delete(treeId);
    }
  }

  private createSubtreeBody(
    treeId: string | undefined,
    treeName: string,
    prefixPath: string,
    tree: Tree,
    blackboard: Blackboard,
    rootNode: TreeNode,
    params: { scriptingEnums: EnumsTable },
    ancestors: Set<string>,
    origin?: Positioned
  ): void {
    if (treeId === undefined || !this.treeRoots.has(treeId)) {
      fail(origin, `Can't find a tree with name: ${treeId}`);
    }

    const root = this.treeRoots.get(treeId)!.children![0];

    const newTree = new Subtree();
    newTree.blackboard = blackboard;
    newTree.name = treeName;
    newTree.id = treeId;
    tree.subtrees.push(newTree);

    //-------- start recursion -----------

    const recursiveStep = (
      parent: TreeNode,
      subtree: Subtree,
      prefix: string,
      json: TreeNodeObject
    ): void => {
      const node = this.createNodeFromObject(json, blackboard, parent, prefix, tree);
      subtree.nodes.push(node);

      // common case: iterate through all children
      if (node.type !== NodeType.SubTree) {
        for (const child of json.children || []) {
          recursiveStep(node, subtree, prefix, child);
        }
        return;
      }

      const newBB = Blackboard.create(blackboard);
      const subtreeId = json.props?.ID;
      const { remapping, autoRemap } = this.readSubtreePorts(json, newBB, params);

      this.applySubtreeModel(json, subtreeId!, remapping, autoRemap);

      for (const [attrName, attrValue] of remapping) {
        const portName = TreeNode.stripBlackboardPointer(attrValue);
        if (portName) {
          newBB.addSubtreeRemapping(attrName, portName);
        } else {
          // constant string: just set that constant value into the BB
          // IMPORTANT: this must not be auto remapped!!!
          newBB.enableAutoRemapping(false);
          newBB.set(attrName, convertFromString(params.scriptingEnums, attrValue));
          newBB.enableAutoRemapping(autoRemap);
        }
      }

      let subtreePath = subtree.name;
      if (subtreePath) subtreePath += "/";
      subtreePath += json.props?.name || `${subtreeId}::${node.uid}`;

      if (tree.subtrees.some((existing) => existing.name === subtreePath)) {
        fail(
          json,
          `Duplicate SubTree path detected: '${subtreePath}'. SubTree nodes in the ` +
            `same tree cannot share a 'name' attribute, even under different ` +
            `parent nodes. Please use unique names or omit the 'name' attribute ` +
            `to auto-generate unique paths.`
        );
      }

      this.recursivelyCreateSubtree(
        subtreeId,
        subtreePath,
        `${subtreePath}/`,
        tree,
        newBB,
        node,
        params,
        ancestors,
        json
      );
    };

    recursiveStep(rootNode, newTree, prefixPath, root);
  }

  /** The attributes of a <SubTree> that are neither reserved nor its own name. */
  private readSubtreePorts(
    json: TreeNodeObject,
    subtreeBB: Blackboard,
    params: { scriptingEnums: EnumsTable }
  ): { remapping: PortsRemapping; autoRemap: boolean } {
    const remapping: PortsRemapping = new Map();
    let autoRemap = false;

    for (const [attrName, rawValue] of Object.entries(json.props || {})) {
      if (rawValue === undefined) continue;
      let attrValue = rawValue;

      if (attrValue === "{=}") attrValue = `{${attrName}}`;

      if (attrName === "_autoremap") {
        autoRemap = Boolean(convertFromString(params.scriptingEnums, attrValue));
        subtreeBB.enableAutoRemapping(autoRemap);
        continue;
      }

      if (isAllowedPortName(attrName)) remapping.set(attrName, attrValue);
    }

    return { remapping, autoRemap };
  }

  /**
   * Fills in the remapping a <TreeNodesModel> asks for, unless the XML already
   * declared it or the subtree remaps everything automatically.
   */
  private applySubtreeModel(
    json: TreeNodeObject,
    subtreeId: string,
    remapping: PortsRemapping,
    autoRemap: boolean
  ): void {
    const model = this.subtreeModels.get(subtreeId);
    if (!model) return;

    for (const [portName, portInfo] of model.ports) {
      // don't override existing remapping
      if (remapping.has(portName) || autoRemap) continue;

      // an empty default means the model gave none, so the port is mandatory
      if (portInfo.defaultValueString === "") {
        fail(
          json,
          `In the <TreeNodesModel> the <SubTree ID="${subtreeId}"> is defining a ` +
            `mandatory port called [${portName}], but you are not remapping it`
        );
      }
      remapping.set(portName, portInfo.defaultValueString);
    }
  }

  createNodeFromObject(
    json: TreeNodeObject,
    blackboard: Blackboard,
    nodeParent: TreeNode | undefined,
    prefixPath: string,
    tree: Tree
  ): TreeNode {
    const typeId = this.resolveTypeId(json);

    // By default, the instance name is equal to ID, unless the
    // attribute [name] is present.
    const instanceName = json.props?.name || typeId;
    if (json.props?.name !== undefined) validateInstanceName(json.props.name, json);

    const manifest: TreeNodeManifest | undefined = this.factory.manifests.get(typeId);
    const { portRemap, otherAttributes } = readAttributes(json, manifest);

    const config = new NodeConfig();
    config.blackboard = blackboard;
    config.path = `${prefixPath}${instanceName}`;
    config.uid = tree.getUID();
    config.manifest = manifest;
    config.otherAttributes = otherAttributes;
    config.line = json.line;
    config.column = json.column;

    if (typeId === instanceName) {
      config.path += `::${config.uid}`;
    }

    applyConditions(json, config);

    //---------------------------------------------

    let newNode: TreeNode;

    if (convertNodeNameToNodeType(json.name) === NodeType.SubTree) {
      config.input = portRemap;
      newNode = this.factory.instantiateTreeNode(instanceName, NodeType[NodeType.SubTree], config);
      // a substitution rule may have replaced the SubTree with a different
      // node, in which case this is not a SubTreeNode at all
      const subtreeNode = newNode instanceof SubTreeNode ? newNode : undefined;
      subtreeNode?.setSubtreeId(typeId);
    } else {
      if (!manifest) {
        fail(json, "Missing manifest. It shouldn't happen. Please report this issue");
      }

      applyManifestPorts(config, blackboard, manifest, portRemap);

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

  /** The key the factory builds this element under. */
  private resolveTypeId(json: TreeNodeObject): string {
    const { name } = json;
    const id = json.props?.ID;

    if (convertNodeNameToNodeType(name) === NodeType.Undefined) {
      // a node declared by its own element name, e.g. <MyCustomAction>
      if (!this.factory.builders.has(name)) {
        fail(json, `${name} is not a registered node`);
      }
      if (id) {
        fail(json, `Attribute [ID] is not allowed in <${name}>`);
      }
      return name;
    }

    // a builtin type is declared by its tag and identified by its ID
    if (!id) {
      fail(json, `Attribute [ID] is mandatory in <${name}>`);
    }
    return id!;
  }

  clear(): void {
    this.suffixCount = 0;
    this.openedDocuments.splice(0);
    this.treeRoots.clear();
  }
}

/** Splits the attributes of an element into port remapping and the rest. */
function readAttributes(
  json: TreeNodeObject,
  manifest: TreeNodeManifest | undefined
): { portRemap: PortsRemapping; otherAttributes: NonPortAttributes } {
  const portRemap: PortsRemapping = new Map();
  const otherAttributes: NonPortAttributes = new Map();

  for (const [portName, portValue] of Object.entries(
    (json.props || {}) as Record<string, string>
  )) {
    if (isAllowedPortName(portName)) {
      if (manifest && !manifest.ports.has(portName)) {
        fail(
          json,
          `A port with name [${portName}] is found in the XML, but not in the providedPorts()`
        );
      }
      portRemap.set(portName, portValue);
    } else if (!isReservedAttribute(portName)) {
      otherAttributes.set(portName, portValue);
    }
  }

  return { portRemap, otherAttributes };
}

/** Moves the pre/post condition attributes out of the free-form attributes. */
function applyConditions(json: TreeNodeObject, config: NodeConfig): void {
  const add = (conditions: Map<string | number, string>, attrName: string, id: string | number) => {
    const script = json.props?.[attrName];
    if (script) {
      conditions.set(id, script);
      config.otherAttributes.delete(attrName);
    }
  };

  for (const key of getEnumKeys(PreCondition)) {
    add(config.preConditions, convertConditionToString(key), PreCondition[key]);
  }
  for (const key of getEnumKeys(PostCondition)) {
    add(config.postConditions, convertConditionToString(key), PostCondition[key]);
  }
}

/**
 * Gives every remapped port a typed entry in the blackboard, points the
 * manifest's directions at the remapping, and fills in the defaults for ports
 * the XML left out.
 */
function applyManifestPorts(
  config: NodeConfig,
  blackboard: Blackboard,
  manifest: TreeNodeManifest,
  portRemap: PortsRemapping
): void {
  // Initialize the ports in the BB to set the type
  for (const [portName, portInfo] of manifest.ports) {
    if (!portRemap.has(portName)) continue;
    const remappedPort = portRemap.get(portName)!;
    const portKey = TreeNode.getRemappedKey(portName, remappedPort);
    if (portKey !== undefined && !blackboard.portInfo(portKey)) {
      // not found, insert for the first time.
      blackboard.createEntry(portKey, portInfo);
    }
  }

  // Set the port direction in config
  for (const [portName, portValue] of portRemap) {
    const portInfo = manifest.ports.get(portName);
    if (!portInfo) continue;
    const { direction } = portInfo;
    if (direction !== PortDirection.OUTPUT) config.input.set(portName, portValue);
    if (direction !== PortDirection.INPUT) config.output.set(portName, portValue);
  }

  // use default value if available for empty ports. Only inputs
  for (const [portName, portInfo] of manifest.ports) {
    const { direction, defaultValue, defaultValueString } = portInfo;

    if (defaultValue === undefined) continue;

    if (direction !== PortDirection.OUTPUT && !config.input.has(portName)) {
      config.input.set(portName, defaultValueString);
    }
    if (direction !== PortDirection.INPUT && !config.output.has(portName)) {
      config.output.set(portName, defaultValueString);
    }
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
