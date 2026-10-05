import {
  SimpleActionNode,
  SimpleAsyncActionNode,
  microtaskExecutor,
  type OffTickExecutor,
} from "./ActionNode.js";
import { Blackboard } from "./Blackboard.js";
import { SimpleConditionNode } from "./ConditionNode.js";
import { warn } from "./Logger.js";
import { SimpleDecoratorNode } from "./DecoratorNode.js";
import { Parser, type TreeObject } from "./Parser.js";
import { fail } from "./xml/XmlError.js";
import { applyRecursiveVisitor, getType } from "./Tree.js";
import {
  NodeConfig,
  TreeNode,
  TreeNodeManifest,
  type PostCondition,
  type PreCondition,
} from "./TreeNode.js";
import { AlwaysFailureNode } from "./actions/AlwaysFailureNode.js";
import { AlwaysSuccessNode } from "./actions/AlwaysSuccessNode.js";
import { ScriptNode } from "./actions/ScriptNode.js";
import { ScriptConditionNode } from "./actions/ScriptConditionNode.js";
import { SetBlackboardNode } from "./actions/SetBlackboardNode.js";
import { SleepNode } from "./actions/SleepNode.js";
import { TestNode, TestNodeConfig, type ITestNodeConfig } from "./actions/TestNode.js";
import { UnsetBlackboardNode } from "./actions/UnsetBlackboardNode.js";
import {
  Metadata,
  NodeStatus,
  NodeType,
  PortList,
  getProvidedPorts,
  hasProvidedPorts,
  isStatusCompleted,
  type CtorWithMetadata,
  type CtorWithPorts,
} from "./basic.js";
import { FallbackNode } from "./controls/FallbackNode.js";
import { IfThenElseNode } from "./controls/IfThenElseNode.js";
import { ParallelAllNode } from "./controls/ParallelAllNode.js";
import { ParallelNode } from "./controls/ParallelNode.js";
import { TryCatchNode } from "./controls/TryCatchNode.js";
import { WhileDoElseNode } from "./controls/WhileDoElseNode.js";
import { ReactiveFallback } from "./controls/ReactiveFallback.js";
import { ReactiveSequence } from "./controls/ReactiveSequence.js";
import { SequenceNode } from "./controls/SequenceNode.js";
import { SequenceWithMemory } from "./controls/SequenceWithMemoryNode.js";
import { createSwitchNode } from "./controls/SwitchNode.js";
import { DelayNode } from "./decorators/DelayNode.js";
import { ForceFailureNode } from "./decorators/ForceFailureNode.js";
import { ForceSuccessNode } from "./decorators/ForceSuccessNode.js";
import { InverterNode } from "./decorators/InverterNode.js";
import { KeepRunningUntilFailureNode } from "./decorators/KeepRunningUntilFailureNode.js";
import { LoopNode } from "./decorators/LoopNode.js";
import { RepeatNode } from "./decorators/RepeatNode.js";
import { RetryNode } from "./decorators/RetryNode.js";
import { RunOnceNode } from "./decorators/RunOnceNode.js";
import { PreconditionNode } from "./decorators/ScriptPreconditionNode.js";
import { SkipUnlessUpdated, WaitValueUpdate } from "./decorators/UpdatedDecorator.js";
import { EntryUpdatedAction } from "./actions/UpdatedAction.js";
import { SubTreeNode } from "./decorators/SubtreeNode.js";
import { TimeoutNode } from "./decorators/TimeoutNode.js";

import {
  createRuntimeExecutor,
  supportScriptExpression,
  type EnumsTable,
  type Environment,
  type ScriptFunction,
} from "./scripting/parser.js";
import type { ConstructorType } from "./utils/index.js";
import { getEnumKeys } from "./utils/index.js";
import { WakeUpSignal } from "./utils/WakeUpSignal.js";

export type NodeBuilder = (...args: [name: string, config: NodeConfig]) => TreeNode;

export function createBuilder<
  T extends TreeNode,
  C extends ConstructorType<T>,
  A extends (ConstructorParameters<C> extends [string, NodeConfig, ...infer P] ? P : never[]),
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

  /**
   * Handed to every ThreadedAction this factory builds, so the action runs its
   * tick outside the tick path. Defaults to microtaskExecutor; pass a worker or
   * a WASM-thread backend to run the work somewhere else.
   */
  readonly offTickExecutor: OffTickExecutor;

  /**
   * The element names that pick a node type by their [ID] rather than by their
   * own name. A custom node type is written as <MyAction/>, so its element name
   * is the registered ID; these five are the generic tags of the XML format
   * itself, and a document may add to the set.
   */
  readonly builtinTags = new Set(["Decorator", "Action", "Condition", "Control", "SubTree"]);

  private readonly builtinIds = new Set<string>();

  private readonly scriptingEnums: EnumsTable;

  private parser: Parser;

  constructor(options: { offTickExecutor?: OffTickExecutor } = {}) {
    this.offTickExecutor = options.offTickExecutor ?? microtaskExecutor;
    this.parser = new Parser(this);

    this.registerNodeType(FallbackNode, "Fallback", new PortList());
    this.registerNodeType(FallbackNode, "AsyncFallback", new PortList(), true);
    this.registerNodeType(SequenceNode, "Sequence", new PortList());
    this.registerNodeType(SequenceNode, "AsyncSequence", new PortList(), true);
    this.registerNodeType(SequenceWithMemory, "SequenceWithMemory", new PortList());

    this.registerNodeType(ParallelAllNode, "ParallelAll");
    this.registerNodeType(ParallelNode, "Parallel");
    this.registerNodeType(ReactiveSequence, "ReactiveSequence", new PortList());
    this.registerNodeType(ReactiveFallback, "ReactiveFallback", new PortList());
    this.registerNodeType(IfThenElseNode, "IfThenElse", new PortList());
    this.registerNodeType(WhileDoElseNode, "WhileDoElse", new PortList());
    this.registerNodeType(TryCatchNode, "TryCatch");
    this.registerNodeType(KeepRunningUntilFailureNode, "KeepRunningUntilFailure", new PortList());

    this.registerNodeType(InverterNode, "Inverter", new PortList());
    this.registerNodeType(RetryNode, "RetryUntilSuccessful");
    this.registerNodeType(LoopNode, "Loop");
    // upstream registers four instantiations of a templated LoopNode; this port
    // has a single untyped implementation, so they are aliases of it
    this.registerNodeType(LoopNode, "LoopInt");
    this.registerNodeType(LoopNode, "LoopBool");
    this.registerNodeType(LoopNode, "LoopDouble");
    this.registerNodeType(LoopNode, "LoopString");
    this.registerNodeType(RepeatNode, "Repeat");

    this.registerNodeType(TimeoutNode, "Timeout");
    this.registerNodeType(DelayNode, "Delay");
    this.registerNodeType(RunOnceNode, "RunOnce");

    this.registerNodeType(ForceSuccessNode, "ForceSuccess", new PortList());
    this.registerNodeType(ForceFailureNode, "ForceFailure", new PortList());

    this.registerNodeType(AlwaysSuccessNode, "AlwaysSuccess", new PortList());
    this.registerNodeType(AlwaysFailureNode, "AlwaysFailure", new PortList());
    this.registerNodeType(ScriptConditionNode, "ScriptCondition");
    this.registerNodeType(ScriptNode, "Script");
    this.registerNodeType(SetBlackboardNode, "SetBlackboard");
    this.registerNodeType(SleepNode, "Sleep");
    this.registerNodeType(UnsetBlackboardNode, "UnsetBlackboard");

    this.registerNodeType(SubTreeNode, "SubTree");

    this.registerNodeType(PreconditionNode, "Precondition");

    this.registerNodeType(createSwitchNode(2), "Switch2");
    this.registerNodeType(createSwitchNode(3), "Switch3");
    this.registerNodeType(createSwitchNode(4), "Switch4");
    this.registerNodeType(createSwitchNode(5), "Switch5");
    this.registerNodeType(createSwitchNode(6), "Switch6");

    this.registerNodeType(EntryUpdatedAction, "WasEntryUpdated");
    this.registerNodeType(SkipUnlessUpdated, "SkipUnlessUpdated");
    this.registerNodeType(WaitValueUpdate, "WaitValueUpdate");

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
    A extends (ConstructorParameters<C> extends [string, NodeConfig, ...infer P] ? P : never[]),
  >(Ctor: C, id: string, ...args: A);
  registerNodeType<
    T extends TreeNode,
    C extends ConstructorType<T>,
    A extends (ConstructorParameters<C> extends [string, NodeConfig, ...infer P] ? P : never[]),
  >(Ctor: C, id: string, ports: PortList, ...args: A);
  registerNodeType<
    T extends TreeNode,
    C extends ConstructorType<T> & CtorWithPorts<T>,
    A extends (ConstructorParameters<C> extends [string, NodeConfig, ...infer P] ? P : never[]),
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
      // extra arguments were passed, so the constructor most likely takes
      // different types than the ones supplied
      if (args.length > 0) {
        throw new Error(
          `[${Ctor.name}]: the constructor is NOT compatible with the arguments provided. ` +
            `Verify that the types of the extra arguments passed to registerNodeType ` +
            `match the constructor signature: (string, NodeConfig, ...)`
        );
      }
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
            fail(config, `Substituted Node ID [${substitutedId}] not found`);
          }
          substituted = true;
          break;
        } else if (rule instanceof TestNodeConfig) {
          // second case, the varian is a TestNodeConfig
          const testNode = new TestNode(name, config, rule);
          // node.reset(testNode);
          node = testNode;
          substituted = true;
          break;
        }
      }
    }

    if (!substituted) {
      if (!this.builders.has(id)) {
        fail(config, `TreeFactory: ID [${id}] not registered`);
      }
      node = this.builders.get(id)!(name, config);
    }

    if (substituted) {
      // A substitution rule must not turn a node into a structurally
      // incompatible type. The XML was validated (children count, mandatory
      // ID) against the original node type, so replacing a leaf with a SubTree,
      // Decorator or Control leaves a node whose child or "ID" attribute the
      // XML never supplied. Allow same-type swaps and swaps to a leaf, which
      // covers the common "replace with a mock action" case.
      const originalType = this.manifests.get(id)!.type;
      const newType = node.type;
      if (
        newType !== originalType &&
        newType !== NodeType.Action &&
        newType !== NodeType.Condition
      ) {
        fail(
          config,
          `Substitution of node [${name}] of type [${NodeType[originalType]}] with a node ` +
            `of type [${NodeType[newType]}] is not allowed: a substitution may only keep ` +
            `the same type or replace the node with a leaf (Action/Condition)`
        );
      }
    }

    node.registrationId = id;
    node.config.enums = this.scriptingEnums;

    const assignConditions = (
      conditions: Map<PreCondition | PostCondition, string>,
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
      warn(
        [
          "WARNING: You executed BehaviorTreeFactory::createTreeFromText ",
          "after registerBehaviorTreeFrom[File/Text].\n",
          "This is NOT, probably, what you want to do.\n",
          "You should probably use BehaviorTreeFactory::createTree, instead",
        ].join("")
      );
    }
    this.parser.loadFromXML(xml);
    const tree = this.parser.instantiateTree(blackboard, undefined, {
      scriptingEnums: this.scriptingEnums,
    });
    tree.manifests = this.manifests;
    return tree;
  }

  createTree(name: string, blackboard = Blackboard.create()): Tree {
    const ret = this.parser.instantiateTree(blackboard, name, {
      scriptingEnums: this.scriptingEnums,
    });
    ret.manifests = this.manifests;
    return ret;
  }

  addMetadataToManifest(nodeId: string, metadata: Metadata) {
    if (!this.manifests.has(nodeId)) {
      throw new Error(`addMetadataToManifest: wrong ID [${nodeId}]`);
    }
    this.manifests.get(nodeId)!.metadata = metadata;
  }

  registerScriptingEnum(name: string, value: number): void {
    if (!this.scriptingEnums.has(name)) {
      this.scriptingEnums.set(name, value);
    } else {
      if (this.scriptingEnums.get(name) !== value) {
        throw new Error(
          [
            "Registering the enum [",
            name,
            "] twice with different values, first ",
            this.scriptingEnums.get(name),
            " and later ",
            value,
          ].join("")
        );
      }
    }
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
      if (testConfig.return_status !== undefined) {
        config.return_status = testConfig.return_status;
      }
      if (testConfig.async_delay !== undefined) {
        config.async_delay = testConfig.async_delay;
      }
      if (testConfig.post_script !== undefined) {
        config.post_script = testConfig.post_script;
      }
      if (testConfig.success_script !== undefined) {
        config.success_script = testConfig.success_script;
      }
      if (testConfig.failure_script !== undefined) {
        config.failure_script = testConfig.failure_script;
      }
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

    // interrupt the sleep of tickWhileRunning(), if it is waiting
    this.wakeUp?.emitSignal();
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
    applyRecursiveVisitor(this.rootNode, visitor);
  }

  getUID(): number {
    return ++this.uidCounter;
  }

  async tickRoot(opt: TickOption, sleepMs = 0) {
    let status = NodeStatus.IDLE;

    if (!this.wakeUp) this.initialize();

    const root = this.rootNode;

    if (!root) throw new Error("Empty Tree");

    // haltTree() resets the root to IDLE. If that happens while the last tick
    // returned RUNNING we must not tick again, because that would restart the
    // tree.
    const halted = () => status === NodeStatus.RUNNING && root.status === NodeStatus.IDLE;

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
        // haltTree() can land while we are waiting: the condition above was
        // evaluated before the await, so re-check before ticking again
        if (halted()) break;
        status = root.executeTick();
      }

      if (halted()) {
        return NodeStatus.IDLE;
      }

      if (isStatusCompleted(status)) root.resetStatus();

      if (status === NodeStatus.RUNNING) {
        await this.sleep(sleepMs);
      }

      if (halted()) {
        return NodeStatus.IDLE;
      }
    }

    return status;
  }
}

export function blackboardRestore(backup: Blackboard[], tree: Tree): void {
  if (backup.length !== tree.subtrees.length) {
    throw new Error(
      `BlackboardRestore: the backup contains ${backup.length} blackboards, ` +
        `but the tree has ${tree.subtrees.length} subtrees`
    );
  }
  for (let i = 0; i < tree.subtrees.length; i++) {
    backup[i].cloneInto(tree.subtrees[i].blackboard);
  }
}

export function blackboardBackup(tree: Tree): Blackboard[] {
  return tree.subtrees.map((sub) => {
    const ret = Blackboard.create();
    sub.blackboard.cloneInto(ret);
    return ret;
  });
}
