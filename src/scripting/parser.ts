import { type Blackboard } from "../Blackboard";
import { Runtime } from "../Runtime";
import { createEmptyObject } from "../utils";

export type EnumsTable = Map<PropertyKey, any>;

export type Environment = [Blackboard, EnumsTable];

export type ScriptFunction<R = any> = (env: Environment) => R;

const cache = new Map<string, ScriptFunction>();

export function parseScript(script: string | undefined): ScriptFunction | undefined {
  if (script === undefined) return;
  try {
    script = script.trim();
    if (!cache.has(script)) {
      cache.set(script, new Function("[$B,$E]", supportScriptExpression(script)) as ScriptFunction);
    }
    return cache.get(script);
  } catch (cause) {
    throw new Error(`Error parseScript: ${script}`, { cause });
  }
}

export function parseScriptAndExecute<R = any>(env: Environment, script: string): R | undefined {
  return parseScript(script)?.(env);
}

export function supportScriptExpression(script: string): string {
  if (!script.trim()) return "";
  if (script.includes("return ")) return script;
  if (/{.+}/s.test(script)) return script;
  if (script.includes(";")) return script;
  return `return (${script})`;
}

export function createReturnFunction<T = unknown>(returns: T): () => T {
  return typeof returns === "object"
    ? () => returns
    : (new Function(`return (${returns})`) as () => T);
}

export function createRuntimeExecutionContext([Blackboard, EnumsTable]: Environment) {
  const base = Object.defineProperties(createEmptyObject(), {
    $B: {
      writable: false,
      value: Blackboard,
    },
    $E: {
      writable: false,
      value: EnumsTable,
    },
  });

  const context = Runtime.createContext(base, {
    get(target, p, receiver) {
      if (Reflect.has(target, p)) return Reflect.get(target, p, receiver);

      if (EnumsTable.has(p)) return EnumsTable.get(p);

      return Blackboard.get(p);
    },
    set(target, p, newValue, receiver) {
      if (Reflect.has(target, p)) return Reflect.set(target, p, newValue, receiver);

      if (EnumsTable.has(p)) return false;

      Blackboard.set(p, newValue);
      return true;
    },
  });

  return context;
}

export function createRuntimeExecutor(env: Environment, script: string) {
  const fn = Runtime.createFunction(script, []);

  const context = createRuntimeExecutionContext(env);

  return (argObject: object = createEmptyObject()) => {
    return Runtime.runInContext(Object.assign(context, argObject), fn);
  };
}
