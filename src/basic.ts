import { PostCondPairs, PreCondPairs, TreeNode } from "./TreeNode.js";
import { Primitive, type AbstractConstructorType, type ConstructorType } from "./utils/index.js";
import { now } from "./utils/date-time.js";

export enum NodeType {
  Undefined,
  Action,
  Condition,
  Control,
  Decorator,
  SubTree,
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

/** A port's own string parser, supplied at registration time. */
export type StringConverter<R = unknown> = (portValue: string) => R;

export class PortInfo {
  constructor(
    public readonly direction: PortDirection = PortDirection.INOUT,
    private readonly converter_?: StringConverter
  ) {}

  /** This port's own string parser, when one was supplied at registration. */
  get converter(): StringConverter | undefined {
    return this.converter_;
  }

  description = "";

  private _defaultValue?: Primitive | object;

  get defaultValue() {
    return this._defaultValue;
  }

  set defaultValue(value: Primitive | object) {
    this._defaultValue = value;
    this._defaultValueString = value === undefined ? "" : String(value);
  }

  private _defaultValueString = "";

  get defaultValueString() {
    return this._defaultValueString;
  }
}

/** type checking */
export function ImplementPorts<T extends Required<CtorWithPorts>>(Ctor: T) {
  return Ctor;
}

export class Timestamp {
  constructor(
    public time = now(),
    public seq = 0
  ) {}
}

// Characters that break XML serialization or cause filesystem issues
const FORBIDDEN_CHARS = new Set([
  " ",
  "\t",
  "\n",
  "\r",
  "<",
  ">",
  "&",
  '"',
  "'",
  "/",
  "\\",
  ":",
  "*",
  "?",
  "|",
  ".",
]);

/**
 * The first character of `name` that may not appear in a model name or a port
 * name, or undefined when the name is clean.
 *
 * Bytes with the high bit set are skipped so that a UTF-8 multibyte sequence,
 * and therefore a non-ASCII name, is accepted.
 */
export function findForbiddenChar(name: string): string | undefined {
  for (const c of name) {
    const code = c.charCodeAt(0);
    if (code >= 0x80) continue;
    if (code < 32 || code === 127) return c;
    if (FORBIDDEN_CHARS.has(c)) return c;
  }
  return;
}

/**
 * Describes a character returned by findForbiddenChar for an error message: a
 * control character gets its ASCII code, anything else is quoted.
 */
export function formatForbiddenChar(c: string): string {
  const code = c.charCodeAt(0);
  if (code < 32 || code === 127) return `control character (ASCII ${code})`;
  return `'${c}'`;
}

export function isAllowedPortName(name: string): boolean {
  if (name === "") return false;
  // a port name cannot start with a digit
  if (!/^[a-z]$/i.test(name[0])) return false;
  if (findForbiddenChar(name) !== undefined) return false;
  return !isReservedAttribute(name);
}

export function isReservedAttribute(name: string): boolean {
  if (PreCondPairs.some(([, value]) => value === name)) return true;
  if (PostCondPairs.some(([, value]) => value === name)) return true;
  return ["name", "ID", "_autoremap"].includes(name);
}

export function createPortInfo<V extends Primitive | { toString(this: V): string }>(
  direction: PortDirection,
  description = "",
  defaultValue?: V
): PortInfo {
  const ret = new PortInfo(direction);

  ret.description = description;

  if (defaultValue !== undefined) ret.defaultValue = defaultValue;

  return ret;
}

export function createPort<K extends string, V extends Primitive | { toString(this: V): string }>(
  direction: PortDirection,
  name: K,
  description = "",
  defaultValue?: V
): [K, PortInfo] {
  if (!isAllowedPortName(name)) {
    const c = findForbiddenChar(name) ?? name;
    throw new Error(`Port name '${name}' contains forbidden character ${formatForbiddenChar(c)}`);
  }

  return [name, createPortInfo(direction, description, defaultValue)];
}

export function createInputPort<
  K extends string,
  V extends Primitive | { toString(this: V): string },
>(name: K, description?: string, defaultValue?: V) {
  return createPort(PortDirection.INPUT, name, description, defaultValue);
}

export function createOutputPort<
  K extends string,
  V extends Primitive | { toString(this: V): string },
>(name: K, description?: string, defaultValue?: V) {
  return createPort(PortDirection.OUTPUT, name, description, defaultValue);
}

export function createBidiPort<
  K extends string,
  V extends Primitive | { toString(this: V): string },
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
    case "SubTree":
      return NodeType.SubTree;
    default:
      return NodeType.Undefined;
  }
}
