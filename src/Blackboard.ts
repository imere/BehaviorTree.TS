import { PortDirection, PortInfo } from "./basic";

export function isPrivateKey(key: PropertyKey): key is `_${string}` {
  return Boolean(key) && String(key).startsWith("_");
}

export class Entry {
  constructor(
    public portInfo: PortInfo,
    public value?: any
  ) {}
}

export class Blackboard implements Map<PropertyKey, Entry> {
  static create(parent?: Blackboard): Blackboard {
    return new Blackboard(parent);
  }

  private autoRemapping = false;

  private internalToExternal: Map<PropertyKey, string>;

  _storage = new Map<PropertyKey, Entry>();

  private constructor(private readonly parent?: Blackboard) {
    this.internalToExternal = new Map();
  }

  delete(key: PropertyKey): boolean {
    return this._storage.delete(key);
  }

  forEach(
    callbackfn: (value: Entry, key: PropertyKey, map: Map<PropertyKey, Entry>) => void,
    thisArg?: any
  ): void {
    return this._storage.forEach(callbackfn, thisArg);
  }

  has(key: PropertyKey): boolean {
    return this._storage.has(key);
  }

  get size(): number {
    return this._storage.size;
  }

  entries(): IterableIterator<[PropertyKey, Entry]> {
    return this._storage.entries();
  }

  values(): IterableIterator<Entry> {
    return this._storage.values();
  }

  [Symbol.iterator](): IterableIterator<[PropertyKey, Entry]> {
    return this._storage[Symbol.iterator]();
  }

  [Symbol.toStringTag]: string = "Blackboard";

  set(key: PropertyKey, value: unknown): this {
    if (!this._storage.has(key)) {
      const entry = this.createEntry(key, new PortInfo(PortDirection.INOUT));
      entry.value = value;
    } else {
      this._storage.get(key)!.value = value;
    }

    return this;
  }

  get<R = any>(key: PropertyKey): R | undefined {
    return this.getEntry(key)?.value;
  }

  keys(): IterableIterator<PropertyKey> {
    return this._storage.keys();
  }

  clear(): void {
    this._storage.clear();
  }

  enableAutoRemapping(remapping: boolean): void {
    this.autoRemapping = remapping;
  }

  portInfo(key: PropertyKey): PortInfo | undefined {
    if (this._storage.has(key)) return this._storage.get(key)!.portInfo;
  }

  addSubtreeRemapping(internal: string, external: string): void {
    this.internalToExternal.set(internal, external);
  }

  cloneInto(dst: Blackboard): void {
    dst.clear();

    for (const [key, entry] of this._storage) {
      const newEntry = new Entry(entry.portInfo);
      newEntry.value = entry.value;
      dst._storage.set(key, newEntry);
    }
  }

  /**
   * This function might be called recursively, when we do remapping, because we move
   * to the top scope to find already existing entries
   */
  createEntry(key: PropertyKey, info: PortInfo): Entry {
    if (this._storage.has(key)) return this._storage.get(key)!;

    // manual remapping first
    if (this.internalToExternal.has(key)) {
      const remappedKey = this.internalToExternal.get(key)!;
      if (this.parent) return this.parent.createEntry(remappedKey, info);
      throw new Error("Missing parent blackboard");
    }
    // autoremapping second (excluding private keys)
    if (this.autoRemapping && !isPrivateKey(key)) {
      if (this.parent) return this.parent.createEntry(key, info);
      throw new Error("Missing parent blackboard");
    }
    // not remapped, not found. Create locally.
    const entry = new Entry(info);
    entry.value = info.defaultValue;

    this._storage.set(key, entry);
    return entry;
  }

  getEntry(key: PropertyKey): Entry | undefined {
    if (this._storage.has(key)) return this._storage.get(key)!;
    // not found. Try autoremapping
    if (this.parent) {
      if (this.internalToExternal.has(key)) {
        const newKey = this.internalToExternal.get(key)!;
        const entry = this.parent.getEntry(newKey);
        if (entry) this._storage.set(key, entry);
        return entry;
      }

      if (this.autoRemapping && !isPrivateKey(key)) {
        const entry = this.parent.getEntry(key);
        if (entry) this._storage.set(key, entry);
        return entry;
      }
    }
  }
}
