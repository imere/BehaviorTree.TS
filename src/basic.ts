import { TreeNode } from "./TreeNode";
import {
  Primitive,
  matchPattern,
  type AbstractConstructorType,
  type ConstructorType,
} from "./utils";

export enum NodeType {
  Undefined,
  Action,
  Condition,
  Control,
  Decorator,
  Subtree,
}

export enum NodeStatus {
  SUCCESS,
  FAILURE,
  RUNNING,
  SKIPPED,
  IDLE,
}

export type NodeUserStatus = Exclude<NodeStatus, NodeStatus.IDLE>;

export function isStatusActive(
  status: NodeStatus
): status is Exclude<NodeStatus, NodeStatus.IDLE | NodeStatus.SKIPPED> {
  return status !== NodeStatus.IDLE && status !== NodeStatus.SKIPPED;
}

export function isStatusCompleted(
  status: NodeStatus
): status is NodeStatus.SUCCESS | NodeStatus.FAILURE {
  return status === NodeStatus.SUCCESS || status === NodeStatus.FAILURE;
}

export enum PortDirection {
  INPUT,
  OUTPUT,
  INOUT,
}

export class PortInfo {
  constructor(
    public readonly direction: PortDirection = PortDirection.INOUT,
    private readonly converter?: <R = any>(string: string) => R
  ) {}

  description = "";

  private _defaultValue?: Primitive;

  get defaultValue() {
    return this._defaultValue;
  }

  set defaultValue(value: any) {
    this._defaultValue = value;
    this._defaultValueString = value === undefined ? "" : String(value);
  }

  private _defaultValueString = "";

  get defaultValueString() {
    return this._defaultValueString;
  }

  // parseString<R = any>(string: string): R | undefined {
  //   if (this.converter) return this.converter(string);
  // }
}

/** type checking */
export function ImplementPorts<T extends Required<CtorWithPorts>>(Ctor: T) {
  return Ctor;
}

const forbidPortNamePatterns: Array<string | RegExp> = ["", "id", "name", /^[^a-z]/i];

export function isAllowedPortName(name: string): boolean {
  return !matchPattern(forbidPortNamePatterns, name);
}

export function createPortInfo<
  V extends Primitive | { [K: PropertyKey]: unknown; toString(this: V): string }
>(direction: PortDirection, description = "", defaultValue?: V): PortInfo {
  const ret = new PortInfo(direction);

  ret.description = description;

  if (defaultValue !== undefined) ret.defaultValue = defaultValue;

  return ret;
}

export function createPort<
  K extends string,
  V extends Primitive | { [K: PropertyKey]: unknown; toString(this: V): string }
>(direction: PortDirection, name: K, description = "", defaultValue?: V): [K, PortInfo] {
  if (!isAllowedPortName(name)) {
    throw new Error(
      `The name of a port must not be [${forbidPortNamePatterns}], and must start with an alphabetic character. Underscore is reserved.`
    );
  }

  return [name, createPortInfo(direction, description, defaultValue)];
}

export function createInputPort<
  K extends string,
  V extends Primitive | { [K: PropertyKey]: unknown; toString(this: V): string }
>(name: K, description?: string, defaultValue?: V) {
  return createPort(PortDirection.INPUT, name, description, defaultValue);
}

export function createOutputPort<
  K extends string,
  V extends Primitive | { [K: PropertyKey]: unknown; toString(this: V): string }
>(name: K, description?: string, defaultValue?: V) {
  return createPort(PortDirection.OUTPUT, name, description, defaultValue);
}

export function createBidiPort<
  K extends string,
  V extends Primitive | { [K: PropertyKey]: unknown; toString(this: V): string }
>(name: K, description?: string, defaultValue?: V) {
  return createPort(PortDirection.INOUT, name, description, defaultValue);
}

export class Metadata<K = string> extends Map<K, any> {
  private readonly symbol = Symbol.for("Metadata");
}

export type CtorWithMetadata<T = unknown> = (ConstructorType<T> | AbstractConstructorType<T>) & {
  metadata?: () => Metadata;
};

export function hasMetadata<T extends TreeNode, C extends CtorWithMetadata<T>>(
  Ctor: C
): Ctor is C & Required<CtorWithMetadata<T>> {
  return typeof Ctor.metadata === "function";
}

const PortListSymbol = Symbol("PortList");

export class PortList<K = string> extends Map<K, PortInfo> {
  private readonly [PortListSymbol] = PortListSymbol;
}

export type CtorWithPorts<T = unknown> = (ConstructorType<T> | AbstractConstructorType<T>) & {
  providedPorts?: () => PortList;
};

export function hasProvidedPorts<T extends TreeNode, C extends CtorWithPorts<T>>(
  Ctor: C
): Ctor is C & Required<CtorWithPorts<T>> {
  return typeof Ctor.providedPorts === "function";
}

export function getProvidedPorts<T extends TreeNode, C extends CtorWithPorts<T>>(
  Ctor?: C
): PortList {
  return Ctor && hasProvidedPorts(Ctor) ? Ctor.providedPorts() : new PortList();
}

export function convertNodeNameToNodeType(name: string): NodeType {
  switch (name) {
    case "Action":
      return NodeType.Action;
    case "Condition":
      return NodeType.Condition;
    case "Control":
      return NodeType.Control;
    case "Decorator":
      return NodeType.Decorator;
    case "Subtree":
      return NodeType.Subtree;
    default:
      return NodeType.Undefined;
  }
}
