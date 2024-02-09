export type ConstructorType<T> = new (...args: any[]) => T;

export type AbstractConstructorType<T> = abstract new (...args: any[]) => T;

export type Primitive = number | bigint | string | boolean | symbol | null | undefined;

export type Fn<R = any> = (...args: any) => R;

export type MaybePromise<T> = T | Promise<T>;

export interface Disposable {
  dispose(): void;
}

export const noop = () => {
  // noop
};

export function matchPattern(tests: (string | RegExp)[], value: unknown): boolean {
  return tests.some((t) => {
    if (typeof t === "string") {
      return value === t;
    } else {
      return t.test(value as string);
    }
  });
}

export function getEnumKeys(value: object): any[] {
  return Object.keys(value).filter((_) => isNaN(Number(_)));
}

export function createEmptyObject<O extends object = {}>(): O {
  return Object.create(null);
}
