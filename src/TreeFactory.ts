import { SimpleActionNode, SimpleAsyncActionNode } from "./ActionNode";
import { Blackboard } from "./Blackboard";
import { SimpleConditionNode } from "./ConditionNode";
import { SimpleDecoratorNode } from "./DecoratorNode";
import { Parser, type TreeObject } from "./Parser";
import { applyRecursiveVisitor, getType } from "./Tree";
import { NodeConfig, TreeNode, TreeNodeManifest } from "./TreeNode";
import { AlwaysFailureNode } from "./actions/AlwaysFailureNode";
import { AlwaysSuccessNode } from "./actions/AlwaysSuccessNode";
import { ScriptNode } from "./actions/ScriptNode";
import { SetBlackboardNode } from "./actions/SetBlackboardNode";
import { SleepNode } from "./actions/SleepNode";
import { TestNode, TestNodeConfig, type ITestNodeConfig } from "./actions/TestNode";
import { UnsetBlackboardNode } from "./actions/UnsetBlackboardNode";
import {
  Metadata,
  NodeStatus,
  PortList,
  getProvidedPorts,
  hasProvidedPorts,
  isStatusCompleted,
  type CtorWithMetadata,
  type CtorWithPorts,
} from "./basic";
import { FallbackNode } from "./controls/FallbackNode";
import { IfThenElseNode } from "./controls/IfThenElseNode";
import { ParallelAllNode } from "./controls/ParallelAllNode";
import { ReactiveFallback } from "./controls/ReactiveFallback";
import { ReactiveSequence } from "./controls/ReactiveSequence";
import { SequenceNode } from "./controls/SequenceNode";
import { createSwitchNode } from "./controls/SwitchNode";
import { DelayNode } from "./decorators/DelayNode";
import { ForceFailureNode } from "./decorators/ForceFailureNode";
import { ForceSuccessNode } from "./decorators/ForceSuccessNode";
import { InverterNode } from "./decorators/InverterNode";
import { RunOnceNode } from "./decorators/RunOnceNode";
import { PreconditionNode } from "./decorators/ScriptPreconditionNode";
import { SubtreeNode } from "./decorators/SubtreeNode";
import { TimeoutNode } from "./decorators/TimeoutNode";
import {
  Environment,
  createRuntimeExecutor,
  supportScriptExpression,
  type EnumsTable,
  type ScriptFunction,
} from "./scripting/parser";
import type { ConstructorType } from "./utils";
import { getEnumKeys } from "./utils";
import { WakeUpSignal } from "./utils/WakeUpSignal";

export type NodeBuilder = (...args: [name: string, config: NodeConfig]) => TreeNode;

export function createBuilder<
  T extends TreeNode,
  C extends ConstructorType<T>,
  A extends ConstructorParameters<C> extends [string, NodeConfig, ...infer P] ? P : never[],
>(Ctor: C, ...args: A): NodeBuilder {
  return function build(name: string, config: NodeConfig): TreeNode {
    return TreeNode.instantiate(Ctor, name, config, ...args);
  };
}

export function createManifest<T extends TreeNode>(
  Ctor: CtorWithMetadata<T>,
  id: string,
  ports = getProvidedPorts(Ctor)
): TreeNodeManifest {
  return new TreeNodeManifest(getType(Ctor), id, ports, Ctor.metadata?.() || new Metadata());
}

export enum TickOption {
  EXACTLY_ONCE,
  ONCE_UNLESS_WOKEN_UP,
  WHILE_RUNNING,
}

type SubstitutionRule = string | TestNodeConfig;

export class TreeFactory {
  readonly builders = new Map<string, NodeBuilder>();

  readonly manifests = new Map<string, TreeNodeManifest>();

  readonly substitutionRules = new Map<string, SubstitutionRule>();

  private readonly builtinIds = new Set<string>();

  private readonly scriptingEnums: EnumsTable;

  private parser: Parser;

  constructor() {
    this.parser = new Parser(this);

    this.registerNodeType(FallbackNode, "Fallback", new PortList());
    this.registerNodeType(FallbackNode, "AsyncFallback", new PortList(), true);
    this.registerNodeType(SequenceNode, "Sequence", new PortList());
    this.registerNodeType(SequenceNode, "AsyncSequence", new PortList(), true);

    this.registerNodeType(ParallelAllNode, "ParallelAll");
    this.registerNodeType(ReactiveSequence, "ReactiveSequence", new PortList());
    this.registerNodeType(ReactiveFallback, "ReactiveFallback", new PortList());
    this.registerNodeType(IfThenElseNode, "IfThenElse", new PortList());

    this.registerNodeType(InverterNode, "Inverter", new PortList());

    this.registerNodeType(TimeoutNode, "Timeout");
    this.registerNodeType(DelayNode, "Delay");
    this.registerNodeType(RunOnceNode, "RunOnce");

    this.registerNodeType(ForceSuccessNode, "ForceSuccess", new PortList());
    this.registerNodeType(ForceFailureNode, "ForceFailure", new PortList());

    this.registerNodeType(AlwaysSuccessNode, "AlwaysSuccess", new PortList());
    this.registerNodeType(AlwaysFailureNode, "AlwaysFailure", new PortList());
    this.registerNodeType(ScriptNode, "Script");
    this.registerNodeType(SetBlackboardNode, "SetBlackboard");
    this.registerNodeType(SleepNode, "Sleep");
    this.registerNodeType(UnsetBlackboardNode, "UnsetBlackboard");

    this.registerNodeType(SubtreeNode, "Subtree");

    this.registerNodeType(PreconditionNode, "Precondition");

    this.registerNodeType(createSwitchNode(2), "Switch2");
    this.registerNodeType(createSwitchNode(3), "Switch3");
    this.registerNodeType(createSwitchNode(4), "Switch4");
    this.registerNodeType(createSwitchNode(5), "Switch5");
    this.registerNodeType(createSwitchNode(6), "Switch6");

    this.builders.forEach((_, id) => {
      this.builtinIds.add(id);
    });

    this.scriptingEnums = new Map();
  }

  unregisterBuilder(id: string): boolean {
    if (this.builtinIds.has(id)) return false;
    if (!this.builders.has(id)) return false;
    this.builders.delete(id);
    this.manifests.delete(id);
    return true;
  }

  registerBuilder(manifest: TreeNodeManifest, builder: NodeBuilder): void {
    const { registrationId } = manifest;
    if (this.builders.has(registrationId)) {
      throw new Error(`ID [${registrationId}] already registered`);
    }
    this.manifests.set(registrationId, manifest);
    this.builders.set(registrationId, builder);
  }

  registerSimpleCondition(
    id: string,
    functor: SimpleConditionNode["functor"],
    ports?: PortList
  ): void {
    this.registerBuilder(
      createManifest(SimpleConditionNode, id, ports),
      createBuilder(SimpleConditionNode, functor)
    );
  }

  registerSimpleAction(id: string, functor: SimpleActionNode["functor"], ports?: PortList): void {
    this.registerBuilder(
      createManifest(SimpleActionNode, id, ports),
      createBuilder(SimpleActionNode, functor)
    );
  }

  registerSimpleAsyncAction(
    id: string,
    functor: SimpleAsyncActionNode["functor"],
    ports?: PortList
  ): void {
    this.registerBuilder(
      createManifest(SimpleAsyncActionNode, id, ports),
      createBuilder(SimpleAsyncActionNode, functor)
    );
  }

  registerSimpleDecorator(
    id: string,
    functor: SimpleDecoratorNode["functor"],
    ports?: PortList
  ): void {
    this.registerBuilder(
      createManifest(SimpleDecoratorNode, id, ports),
      createBuilder(SimpleDecoratorNode, functor)
    );
  }

  registerTreeFromXML(xml: string): void {
    this.parser.loadFromXML(xml);
  }

  registerTreeFromJSON(text: string): void {
    this.registerTreeFromObject(JSON.parse(text));
  }

  registerTreeFromObject(json: TreeObject): void {
    this.parser.loadFromObject(json);
  }

  registeredTrees(): string[] {
    return this.parser.registeredBehaviorTrees;
  }

  clearRegisteredTrees(): void {
    this.parser.clear();
  }

  registerNodeType<
    T extends TreeNode,
    C extends ConstructorType<T> & Required<CtorWithPorts<T>>,
    A extends ConstructorParameters<C> extends [string, NodeConfig, ...infer P] ? P : never[],
  >(Ctor: C, id: string, ...args: A);
  registerNodeType<
    T extends TreeNode,
    C extends ConstructorType<T>,
    A extends ConstructorParameters<C> extends [string, NodeConfig, ...infer P] ? P : never[],
  >(Ctor: C, id: string, ports: PortList, ...args: A);
  registerNodeType<
    T extends TreeNode,
    C extends ConstructorType<T> & CtorWithPorts<T>,
    A extends ConstructorParameters<C> extends [string, NodeConfig, ...infer P] ? P : never[],
  >(Ctor: C, id: string, ...args: A) {
    let ports = args[0];
    if (ports instanceof PortList) {
      args.shift();
    } else {
      ports = undefined;
      if (!hasProvidedPorts(Ctor)) {
        throw new Error(
          `[${Ctor.name}]: you MUST implement the static method: PortsList providedPorts()`
        );
      }
    }
    if (Ctor.length && Ctor.length < 2) {
      throw new Error(
        `[${Ctor.name}]: you MUST add a constructor with signature: (string, NodeConfig)`
      );
    }
    this.registerBuilder(createManifest(Ctor, id, ports as PortList), createBuilder(Ctor, ...args));
  }

  /**
   *  instantiateTreeNode creates an instance of a previously registered TreeNode.
   *
   * @param name name of this particular instance
   * @param id ID used when it was registered
   * @param config configuration that is passed to the constructor of the TreeNode.
   * @return new node.
   */
  instantiateTreeNode<T extends TreeNode = TreeNode>(
    name: string,
    id: string,
    config: NodeConfig
  ): T {
    if (!this.manifests.has(id)) {
      throw new Error(`TreeFactory: ID [${id}] not registered`);
    }

    let node: TreeNode = new TreeNode(name, config);

    let substituted = false;

    for (const [filter, rule] of this.substitutionRules) {
      if (filter === name || filter === id || RegExp(filter).test(config.path)) {
        // first case: the rule is simply a string with the name of the
        // node to create instead
        const substitutedId = typeof rule === "string" ? rule : undefined;
        if (substitutedId !== undefined) {
          if (this.builders.has(substitutedId)) {
            node = this.builders.get(substitutedId)!(name, config);
          } else {
            throw new Error(`Substituted Node ID [${substitutedId}] not found`);
          }
          substituted = true;
          break;
        } else if (rule instanceof TestNodeConfig) {
          // second case, the varian is a TestNodeConfig
          const testNode = new TestNode(name, config);
          testNode.setConfig(rule);
          // node.reset(testNode);
          node = testNode;
          substituted = true;
          break;
        }
      }
    }

    if (!substituted) {
      if (!this.builders.has(id)) {
        throw new Error(`TreeFactory: ID [${id}] not registered`);
      }
      node = this.builders.get(id)!(name, config);
    }

    node.registrationId = id;
    node.config.enums = this.scriptingEnums;

    const assignConditions = (
      conditions: Map<number, string>,
      executors: ScriptFunction[]
    ): void => {
      for (const [condition, script] of conditions) {
        executors[condition] = createExecutor(supportScriptExpression(script));
      }

      function createExecutor(script: string): ScriptFunction {
        let execute: () => unknown;
        return function exec(env: Environment) {
          if (!execute) execute = createRuntimeExecutor(env, script);
          return execute();
        };
      }
    };

    assignConditions(config.preConditions, node.preConditionScripts);
    assignConditions(config.postConditions, node.postConditionScripts);

    return node as T;
  }

  createTreeFromXML(xml: string, blackboard = Blackboard.create()): Tree {
    if (this.registeredTrees().length) {
      console.warn(
        [
          "WARNING: You executed BehaviorTreeFactory::createTreeFromText ",
          "after registerBehaviorTreeFrom[File/Text].\n",
          "This is NOT, probably, what you want to do.\n",
          "You should probably use BehaviorTreeFactory::createTree, instead",
        ].join("")
      );
    }
    this.parser.loadFromXML(xml);
    const tree = this.parser.instantiateTree(blackboard);
    tree.manifests = this.manifests;
    return tree;
  }

  createTree(name: string, blackboard = Blackboard.create()): Tree {
    const ret = this.parser.instantiateTree(blackboard, name);
    ret.manifests = this.manifests;
    return ret;
  }

  addMetadataToManifest(nodeId: string, metadata: Metadata) {
    if (!this.manifests.has(nodeId)) {
      throw new Error("addMetadataToManifest: wrong ID");
    }
    this.manifests.get(nodeId)!.metadata = metadata;
  }

  registerScriptingEnum(name: string, value: number): void {
    this.scriptingEnums.set(name, value);
  }

  registerScriptingEnums(enums: object): void {
    const keys = getEnumKeys(enums);
    for (let value = 0, key: string, len = keys.length; value < len; value++) {
      key = keys[value];
      this.registerScriptingEnum(key, enums[key]);
    }
  }

  addSubstitutionRule(filter: string, rule: SubstitutionRule): void {
    this.substitutionRules.set(filter, rule);
  }

  loadSubstitutionRuleFromJSON(text: string): void {
    this.loadSubstitutionRuleFromObject(JSON.parse(text));
  }

  loadSubstitutionRuleFromObject({
    TestNodeConfigs = {},
    SubstitutionRules,
  }: {
    TestNodeConfigs?: Record<string, ITestNodeConfig>;
    SubstitutionRules: Record<string, string>;
  }): void {
    const configs = new Map<string, ITestNodeConfig>();
    for (const [name, testConfig] of Object.entries(TestNodeConfigs)) {
      if (!configs.has(name)) configs.set(name, new TestNodeConfig());

      const config = configs.get(name)!;
      config.returnStatus = testConfig.returnStatus;
      if (testConfig.asyncDelay !== undefined) {
        config.asyncDelay = testConfig.asyncDelay;
      }
      config.postScript = testConfig.postScript;
    }

    for (const [nodeName, testName] of Object.entries(SubstitutionRules)) {
      if (!configs.has(testName)) {
        this.addSubstitutionRule(nodeName, testName);
      } else {
        this.addSubstitutionRule(nodeName, configs.get(testName) as TestNodeConfig);
      }
    }
  }

  clearSubstitutionRule(): void {
    this.substitutionRules.clear();
  }
}

export class Subtree {
  id: string;

  name: string;

  nodes: TreeNode[];

  blackboard: Blackboard;

  constructor() {
    this.nodes = [];
    this.blackboard = Blackboard.create();
    this.id = this.name = "";
  }
}

export class Tree {
  private uidCounter = 0;

  private wakeUp: WakeUpSignal | undefined;

  subtrees: Subtree[];
  manifests: Map<string, TreeNodeManifest>;

  constructor() {
    this.subtrees = [];
    this.manifests = new Map();
  }

  getNodesByPath(filter: string): TreeNode[] {
    const ret: TreeNode[] = [];
    for (const subtree of this.subtrees) {
      for (const node of subtree.nodes) {
        if (RegExp(filter).test(node.fullPath)) {
          ret.push(node);
        }
      }
    }
    return ret;
  }

  initialize(): void {
    this.wakeUp = new WakeUpSignal();
    for (const subtree of this.subtrees) {
      for (const node of subtree.nodes) {
        node.setWakeUpInstance(this.wakeUp);
      }
    }
  }

  get rootNode(): TreeNode | undefined {
    if (!this.subtrees.length) return;
    const { nodes } = this.subtrees[0];
    return nodes.length ? nodes[0] : undefined;
  }

  async sleep(ms: number): Promise<unknown> {
    return this.wakeUp?.waitFor(ms);
  }

  haltTree(): void {
    const root = this.rootNode;
    if (!root) return;
    // the halt should propagate to all the node if the nodes
    // have been implemented correctly
    root.haltNode();

    // but, just in case.... this should be no-op
    applyRecursiveVisitor(this.rootNode, (node) => node.haltNode());

    root.resetStatus();
  }

  tickExactlyOnce(): Promise<NodeStatus> {
    return this.tickRoot(TickOption.EXACTLY_ONCE);
  }

  tickOnce(): Promise<NodeStatus> {
    return this.tickRoot(TickOption.ONCE_UNLESS_WOKEN_UP);
  }

  tickWhileRunning(sleepMs?: number): Promise<NodeStatus> {
    return this.tickRoot(TickOption.WHILE_RUNNING, sleepMs);
  }

  get rootBlackboard(): Blackboard | undefined {
    if (this.subtrees.length) return this.subtrees[0].blackboard;
  }

  applyVisitor(visitor: Parameters<typeof applyRecursiveVisitor>[1]): void {
    for (const subtree of this.subtrees) {
      applyRecursiveVisitor(subtree.nodes[0], visitor);
    }
  }

  getUID(): number {
    return ++this.uidCounter;
  }

  async tickRoot(opt: TickOption, sleepMs = 0) {
    let status = NodeStatus.IDLE;

    if (!this.wakeUp) this.initialize();

    const root = this.rootNode;

    if (!root) throw new Error("Empty Tree");

    // Inner loop. The previous tick might have triggered the wake-up
    // in this case, unless TickOption::EXACTLY_ONCE, we tick again
    while (
      status === NodeStatus.IDLE ||
      (opt === TickOption.WHILE_RUNNING && status === NodeStatus.RUNNING)
    ) {
      status = root.executeTick();

      while (
        opt !== TickOption.EXACTLY_ONCE &&
        status === NodeStatus.RUNNING &&
        (await this.wakeUp!.waitFor(0))
      ) {
        status = root.executeTick();
      }

      if (isStatusCompleted(status)) root.resetStatus();

      if (status === NodeStatus.RUNNING) {
        await this.sleep(sleepMs);
      }
    }

    return status;
  }
}
