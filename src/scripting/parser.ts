import { type Blackboard } from "../Blackboard.js";
import { Runtime } from "../Runtime.js";
import { createEmptyObject } from "../utils/index.js";

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

const DECLARATION = /^(let|const|var|function|class)\b/;

/**
 * Turns a script into a function body. Upstream parses the script into a list of
 * statements, evaluates all of them and returns the value of the last one, so a
 * comma- or semicolon-separated script yields its final expression. The
 * comma-separated form JavaScript already does, because `a,b` evaluates to `b`.
 * A semicolon-separated one does not, so the last statement is returned
 * explicitly.
 */
export function supportScriptExpression(script: string): string {
  if (!script.trim()) return "";
  if (script.includes("return ")) return script;
  if (/{.+}/s.test(script)) return script;
  if (!script.includes(";")) return `return (${script})`;

  const statements = splitStatements(script);
  const last = statements.pop();
  if (last === undefined || last === "" || DECLARATION.test(last.trim())) {
    return script;
  }
  return `${statements.join(";\n")};\nreturn (${last});`;
}

/**
 * Splits on the semicolons that separate top-level statements, ignoring the ones
 * inside string literals and inside (), [] or {}.
 */
function splitStatements(script: string): string[] {
  const statements: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | undefined;

  for (let i = 0; i < script.length; i++) {
    const c = script[i];

    if (quote) {
      current += c;
      if (c === "\\") {
        current += script[++i] ?? "";
      } else if (c === quote) {
        quote = undefined;
      }
      continue;
    }

    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      current += c;
      continue;
    }

    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;

    if (c === ";" && depth === 0) {
      statements.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  statements.push(current);
  return statements;
}

export function createReturnFunction<T = unknown>(returns: T): () => T {
  return typeof returns === "object"
    ? () => returns
    : (new Function(`return (${returns})`) as () => T);
}

export function createTreeExecutionContext([Blackboard, EnumsTable]: Environment) {
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

  const context = createTreeExecutionContext(env);

  return (argObject: object = createEmptyObject()) => {
    return Runtime.runInContext(Object.assign(context, argObject), fn);
  };
}
