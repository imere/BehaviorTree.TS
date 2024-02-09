import { type Fn, type MaybePromise } from ".";

export type TOnFilter<T = string> = T | null | undefined;

export type TEmitFilter<T = string> = TOnFilter<T> | RegExp;

export type Listener<P extends unknown[]> = (...params: P) => MaybePromise<unknown>;

export class Emitter<Events extends Record<string, unknown[]>> {
  private listener = new Map<keyof Events, Fn[]>();

  on<K extends keyof Events>(ev: K, fn: Listener<Events[K]>): () => void {
    if (!this.listener.has(ev)) this.listener.set(ev, []);
    this.listener.get(ev)!.push(fn);
    return () => {
      this.off(ev, fn);
    };
  }

  once<K extends keyof Events>(ev: K, fn: Listener<Events[K]>): () => void {
    if (!this.listener.has(ev)) this.listener.set(ev, []);

    const newCb = async (...args: Events[K]) => {
      await fn(...args);
      this.off(ev, newCb);
    };

    this.listener.get(ev)!.push(newCb);

    return () => {
      this.off(ev, fn);
    };
  }

  off<K extends keyof Events>(ev: K, fn?: Listener<Events[K]>) {
    if (!this.listener.has(ev)) return;
    if (!fn) this.listener.delete(ev);
    else {
      const fns = this.listener.get(ev)!;
      fns.splice(
        fns.findIndex((_) => fn === _),
        1
      );
    }
  }

  async emit<K extends keyof Events>(ev: K, ...args: Events[K]) {
    if (!this.listener.has(ev)) return;
    for (const fn of this.listener.get(ev) || []) {
      fn(...args);
      // await wait(0);
    }
  }

  getListeners<K extends keyof Events>(ev: K) {
    return this.listener.get(ev) || [];
  }
}

// new Emitter<{
//   refresh: [string];
//   save: [number];
// }>().on("refresh", null, (...a) => {});

// new Emitter<{
//   refresh: [string];
//   save: [number];
// }>().emit("refresh", null, 1, 2);
