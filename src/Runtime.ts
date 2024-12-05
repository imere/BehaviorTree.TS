export type RuntimeFunction<R = any> = (context: object) => R;

type ArgItem =
  | [name: string, expression?: undefined]
  | [name: string, expression: string, constant?: boolean];

export function attachGlobals(target: object, extra?: [name: string, value: unknown][]) {
  const HOST = [
    ["console", console],
    ["Date", Date],
    ["isNaN", isNaN],
    ["JSON", JSON],
    ["Math", Math],
    ["Number", Number],
    ["BigInt", BigInt],
    ["String", String],
    ["Boolean", Boolean],
    ["Object", Object],
    ["Array", Array],
    ["undefined", undefined],
  ] satisfies Array<[keyof typeof globalThis, unknown]>;

  const globals = (extra || []).concat(HOST);

  for (const [key, value] of globals) {
    Object.defineProperty(target, key, {
      configurable: false,
      writable: false,
      value,
    });
  }

  return new Set(globals.map((_) => _[0]));
}

export class Runtime {
  private constructor() {}

  static create(parent?: object | null, handler?: ProxyHandler<object>) {
    const context = this.createContext(parent, handler);

    return {
      evaluate: <R = any>(script: string, args: ArgItem[] = []): R => {
        return this.runInContext(context, this.createFunction(script, args));
      },
    };
  }

  static createContext(
    parent?: object | null,
    handler?: ProxyHandler<object>,
    globals?: [name: string, value: unknown][]
  ) {
    const o = Object.create(parent || null);

    const attached = attachGlobals(o, globals);

    const context = new Proxy<object>(o, {
      get(t, p, r) {
        return Reflect.get(t, p, r);
      },
      set(t, p, v, r) {
        if (attached.has(p as any)) throw new Error(`Runtime: [${String(p)}] cannot be changed.`);
        return Reflect.set(t, p, v, r);
      },
      ...handler,
      has() {
        return true;
      },
    });

    return context;
  }

  static createFunction<R = any>(script: string, args: ArgItem[]): RuntimeFunction<R> {
    const proxyName = `__proxy__`;
    const initializer = args
      .map(
        ([name, expression, isConst]) =>
          `${isConst ? "const" : "let"} ${name}${expression?.trim() ? `=${expression}` : ""};`
      )
      .join("\n");
    const withBlock = `${initializer} ${script}`;
    let fn: (...args: unknown[]) => R;
    try {
      fn = new Function(proxyName, `with(${proxyName}){${withBlock}}`) as typeof fn;
    } catch (cause) {
      throw new Error(`Runtime.createFunction():\n${withBlock}`, { cause });
    }
    return (context: object) => {
      try {
        return fn.call(context, context);
      } catch (cause) {
        throw new Error(`Runtime.createFunction()():\n${withBlock}`, { cause });
      }
    };
  }

  static runInContext<R = any>(context: object, fn: RuntimeFunction<R>): R;
  static runInContext<R = any>(context: object, code: string, args?: ArgItem[]): R;
  static runInContext<R = any>(
    context: object,
    fnOrCode: RuntimeFunction<R> | string,
    args?: ArgItem[]
  ): R {
    if (typeof fnOrCode === "string") {
      return this.createFunction(fnOrCode, args || [])(context);
    }
    return fnOrCode(context);
  }
}
