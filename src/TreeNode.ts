import { Blackboard } from "./Blackboard";
import {
  NodeStatus,
  NodeType,
  PortDirection,
  getProvidedPorts,
  isStatusCompleted,
  type CtorWithPorts,
  type Metadata,
  type NodeUserStatus,
  type PortList,
} from "./basic";
import type { EnumsTable, Environment, ScriptFunction } from "./scripting/parser";
import type { ConstructorType } from "./utils";
import { getEnumKeys } from "./utils";
import { Emitter } from "./utils/Emitter";
import { WakeUpSignal } from "./utils/WakeUpSignal";

/** This information is used mostly by the Parser. */
export class TreeNodeManifest {
  constructor(
    public type: NodeType,
    public registrationId: string,
    public ports: PortList,
    public metadata: Metadata
  ) {}
}

export enum PreCondition {
  FAILURE_IF,
  SUCCESS_IF,
  SKIP_IF,
  WHILE_TRUE,
}

export enum PostCondition {
  ON_HALTED,
  ON_FAILURE,
  ON_SUCCESS,
  ALWAYS,
}

/** 转换到字符串 */
export function convertToString<T extends typeof PreCondition, K extends PreCondition>(
  o: T,
  key: K
): string;
export function convertToString<T extends typeof PostCondition, K extends PostCondition>(
  o: T,
  key: K
): string;
export function convertToString<
  T extends typeof PreCondition | typeof PostCondition,
  K extends PreCondition | PostCondition,
>(o: T, key: K): string {
  switch (o[key]) {
    case "FAILURE_IF":
      return "_failureIf";
    case "SUCCESS_IF":
      return "_successIf";
    case "SKIP_IF":
      return "_skipIf";
    case "WHILE_TRUE":
      return "_while";
    case "ON_HALTED":
      return "_onHalted";
    case "ON_FAILURE":
      return "_onFailure";
    case "ON_SUCCESS":
      return "_onSuccess";
    case "ALWAYS":
      return "_post";
    default:
      return "Undefined";
  }
}

export class NodeConfig {
  blackboard: Blackboard = Blackboard.create();

  enums: EnumsTable = new Map();

  input = new Map<string, string>();

  output = new Map<string, string>();

  manifest?: TreeNodeManifest;

  uid = 0;

  path = "";

  preConditions = new Map<PreCondition, string>();

  postConditions = new Map<PostCondition, string>();

  // static create<K extends keyof NodeConfig>(
  //   o: Record<K, NodeConfig[K]>
  // ): NodeConfig {
  //   const ret = new NodeConfig();
  //   Object.entries(o).forEach(([k, v]) => {
  //     ret[k as any] = v;
  //   });
  //   return ret;
  // }
}

export type PortsRemapping = Map<string, string>;

export type ConditionCallback = <T extends TreeNode>(node: T) => NodeUserStatus;

export type Converter<R> = (portValue: any, param: { hints: { remap: boolean } }) => R;

const defaultConvert: Converter<any> = (_) => _;

export function assignDefaultRemapping<T extends CtorWithPorts<TreeNode>>(
  Ctor: T,
  config: NodeConfig
): void {
  for (const [name, { direction }] of getProvidedPorts(Ctor)) {
    if (direction !== PortDirection.OUTPUT) {
      config.input.set(name, "{=}");
    }
    if (direction !== PortDirection.INPUT) {
      config.output.set(name, "{=}");
    }
  }
}

export class TreeNode extends Emitter<{
  "status-change": [status: NodeStatus, oldStatus: NodeStatus];
  "wake-up": [];
}> {
  static instantiate<
    T extends TreeNode,
    C extends ConstructorType<T>,
    A extends ConstructorParameters<C> extends [string, NodeConfig, ...infer P] ? P : never[],
  >(Ctor: C, name: string, config: NodeConfig, ...args: A) {
    return new Ctor(name, config, ...args);
  }

  /** Override this from {@link TreeNode} */
  type!: NodeType;

  registrationId?: string;

  private substitutionCallback?: ConditionCallback;

  private postConditionCallback?: ConditionCallback;

  private wakeUp: WakeUpSignal | undefined;

  get preConditionScripts() {
    return this.preParsed;
  }

  get postConditionScripts() {
    return this.postParsed;
  }

  private preParsed: ScriptFunction[] = [];

  private postParsed: ScriptFunction[] = [];

  get fullPath(): string {
    return this.config.path;
  }

  constructor(
    public readonly name: string,
    readonly config: NodeConfig
  ) {
    super();
  }

  get uid(): number {
    return this.config.uid;
  }

  static stripBlackboardPointer(string: string): `{${string}}` | undefined {
    string = string.trim();
    if (string.length < 3) return;
    const ret = /^{(\w+)}$/.exec(string);
    if (!ret) return;
    return ret[1] as `{${string}}`;
  }

  static getRemappedKey(portName: string, remappedPort: string): string | undefined {
    if (remappedPort === "{=}") return portName;
    const ret = this.stripBlackboardPointer(remappedPort);
    if (ret !== undefined) return ret;
  }

  getInput<R = string>(key: string, convert: Converter<R> = defaultConvert): R | undefined {
    const parseString: Converter<R | undefined> = (str: string, ...args): R | undefined => {
      if (this.config.enums.has(str)) {
        return this.config.enums.get(str) as R;
      }
      return convert(str, ...args);
    };

    if (!this.config.input.has(key)) return;

    // special case. Empty port value, we should use the default value,
    // if available in the model.
    // BUT, it the port type is a string, then an empty string might be
    // a valid value
    const portValueStr = this.config.input.get(key);
    if (portValueStr === undefined) {
      const portManifest = this.config.manifest?.ports.get(key);
      return portManifest?.defaultValue as R;
    }

    const param: Parameters<Converter<any>>[1] = {
      hints: { remap: false },
    };

    const remappedKey = TreeNode.getRemappedKey(key, portValueStr);

    if (remappedKey === undefined) return parseString(portValueStr, param);

    if (!this.config.blackboard) return;

    param.hints.remap = true;

    const value = this.config.blackboard.get(remappedKey);

    if (value !== undefined) {
      if (typeof value === "string") return parseString(value, param);
      return value;
    }
  }

  getInputOrThrow<R = string>(key: string, convert: Converter<R> = defaultConvert): R {
    const ret = this.getInput(key, convert);
    if (ret === undefined) {
      const name =
        this.registrationId === this.name || !this.registrationId
          ? this.name
          : `${this.name}(${this.registrationId})`;
      throw new Error(`${name}: missing port [${key}]`);
    }
    return ret;
  }

  setOutput<T extends CtorWithPorts>(
    key: T extends {
      providedPorts: () => infer O;
    }
      ? O extends Map<infer K, any>
        ? K
        : string
      : string,
    value: unknown
  ): void {
    if (!this.config.blackboard) {
      throw new Error(
        "setOutput() failed: trying to access a Blackboard(BB) entry, but BB is invalid"
      );
    }
    if (!this.config.output.has(key)) {
      throw new Error(
        `setOutput() failed: NodeConfig::output_ports does not contain the key: [${key}]`
      );
    }
    let remappedKey = this.config.output.get(key)!;
    if (remappedKey === "{=}") {
      this.config.blackboard.set(key, value);
      return;
    }
    if (!/^{(.+)}$/.test(remappedKey)) {
      throw new Error("setOutput requires a blackboard pointer. Use {}");
    }
    remappedKey = TreeNode.stripBlackboardPointer(remappedKey)!;
    this.config.blackboard.set(remappedKey, value);
  }

  executeTick(): NodeStatus {
    let newStatus = this.status as NodeUserStatus;

    const pre = this.checkPreConditions();

    if (pre !== undefined) {
      newStatus = pre;
    } else {
      let substituted = false;
      if (!isStatusCompleted(this.status)) {
        const callback = this.substitutionCallback;
        if (callback) {
          const overrides = callback(this);
          if (isStatusCompleted(overrides)) {
            substituted = true;
            newStatus = overrides;
          }
        }
      }

      if (!substituted) newStatus = this.tick();
    }

    // injected post callback
    if (isStatusCompleted(newStatus)) {
      this.checkPostConditions(newStatus);
      const callback = this.postConditionCallback;
      if (callback) {
        const overrides = callback(this);
        if (isStatusCompleted(overrides)) {
          newStatus = overrides;
        }
      }
    }

    if (newStatus !== NodeStatus.SKIPPED) this.setStatus(newStatus);

    return newStatus;
  }

  private _status: NodeStatus = NodeStatus.IDLE;

  get status() {
    return this._status;
  }

  setStatus(status: NodeUserStatus) {
    // @ts-expect-error This comparison appears to be unintentional because the types 'NodeUserStatus' and 'NodeStatus.IDLE' have no overlap.
    if (status === NodeStatus.IDLE) {
      throw new Error(
        `Node [${this.name}]: you are not allowed to set manually the status to IDLE. If you know what you are doing (?) use resetStatus() instead.`
      );
    }
    const oldStatus = this._status;
    this._status = status;
    if (oldStatus !== status) {
      this.emit("status-change", status, oldStatus);
    }
  }

  resetStatus(): void {
    const oldStatus = this._status;
    this._status = NodeStatus.IDLE;
    if (oldStatus !== NodeStatus.IDLE) {
      this.emit("status-change", NodeStatus.IDLE, oldStatus);
    }
  }

  checkPreConditions(): NodeUserStatus | undefined {
    const env: Environment = [this.config.blackboard, this.config.enums];
    // check the pre-conditions
    for (let preId = 0, len = getEnumKeys(PreCondition).length; preId < len; preId++) {
      const executor = this.preParsed[preId];
      if (!executor) continue;

      // Some preconditions are applied only when the node state is IDLE or SKIPPED
      if (this.status === NodeStatus.IDLE || this.status === NodeStatus.SKIPPED) {
        // what to do if the condition is true
        if (executor(env)) {
          if (preId === PreCondition.FAILURE_IF) return NodeStatus.FAILURE;
          else if (preId === PreCondition.SUCCESS_IF) return NodeStatus.SUCCESS;
          else if (preId === PreCondition.SKIP_IF) return NodeStatus.SKIPPED;
        }
        // if the conditions is false
        else if (preId === PreCondition.WHILE_TRUE) return NodeStatus.SKIPPED;
      } else if (this.status === NodeStatus.RUNNING && preId === PreCondition.WHILE_TRUE) {
        // what to do if the condition is false
        if (!executor(env)) {
          this.haltNode();
          this.resetStatus();
          return NodeStatus.SKIPPED;
        }
      }
    }
    return undefined;
  }

  checkPostConditions(status: NodeStatus): void {
    const executeScript = (condition: PostCondition) => {
      const executor = this.postParsed[condition];
      if (executor) {
        const env: Environment = [this.config.blackboard, this.config.enums];
        executor(env);
      }
    };
    if (status === NodeStatus.SUCCESS) {
      executeScript(PostCondition.ON_SUCCESS);
    } else if (status === NodeStatus.FAILURE) {
      executeScript(PostCondition.ON_FAILURE);
    }
    executeScript(PostCondition.ALWAYS);
  }

  async waitValidStatus(): Promise<NodeStatus> {
    while (this.isHalted()) {
      await new Promise((resolve) => {
        this.once("status-change", resolve);
      });
    }

    return this.status;
  }

  isHalted(): boolean {
    return this.status === NodeStatus.IDLE;
  }

  setPreTickFunction(fn: ConditionCallback): void {
    this.substitutionCallback = fn;
  }

  setPostTickFunction(fn: ConditionCallback): void {
    this.postConditionCallback = fn;
  }

  /** Override this from {@link TreeNode} */
  protected tick(): NodeUserStatus {
    throw new Error("Override this: [tick]");
  }

  /** Override this from {@link TreeNode} */
  protected halt(): void {
    throw new Error("Override this: [halt]");
  }

  haltNode(): void {
    this.halt();
  }

  setWakeUpInstance(instance: WakeUpSignal): void {
    this.wakeUp = instance;
  }

  emitWakeUpSignal(): void {
    this.wakeUp?.emitSignal();
  }

  requiresWakeUp(): boolean {
    return Boolean(this.wakeUp);
  }
}
