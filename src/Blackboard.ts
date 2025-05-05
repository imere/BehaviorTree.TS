import { PortDirection, PortInfo, Timestamp } from "./basic";
import { now } from "./utils/date-time";

export function isPrivateKey(key: PropertyKey): key is `_${string}` {
  return Boolean(key) && String(key).startsWith("_");
}

export class Entry {
  public value?: any;

  sequence_id = 0;
  stamp = now();

  constructor(public info: PortInfo) {}
}

export class StampedValue<T = unknown> {
  constructor(
    public value: T,
    public stamp: Timestamp = new Timestamp()
  ) {}
}

const ROOT_KEY_PREFIX = "_B_";
const ROOT_KEY_REGEXP = RegExp(`^${ROOT_KEY_PREFIX}\\S+`);

export class Blackboard {
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

  keys(): IterableIterator<PropertyKey> {
    return this._storage.keys();
  }

  clear(): void {
    this._storage.clear();
  }

  set(key: PropertyKey, value: unknown): void {
    if (!this._storage.has(key)) {
      const entry = this.createEntry(key, new PortInfo(PortDirection.INOUT));
      entry.value = value;
      entry.sequence_id++;
      entry.stamp = now();
    } else {
      const entry = this._storage.get(key)!;
      entry.value = value;
      entry.sequence_id++;
      entry.stamp = now();
    }
  }

  get<R = any>(key: PropertyKey): R | undefined {
    return this.getEntry(key)?.value;
  }

  unset(key: PropertyKey): void {
    this._storage.delete(key);
  }

  enableAutoRemapping(remapping: boolean): void {
    this.autoRemapping = remapping;
  }

  portInfo(key: PropertyKey): PortInfo | undefined {
    if (this._storage.has(key)) return this._storage.get(key)!.info;
  }

  entryInfo(key: PropertyKey): PortInfo | undefined {
    return this.getEntry(key)?.info;
  }

  addSubtreeRemapping(internal: string, external: string): void {
    this.internalToExternal.set(internal, external);
  }

  cloneInto(dst: Blackboard): void {
    // keys that are not updated must be removed.
    const keys_to_remove = new Set<PropertyKey>();
    const dst_storage = dst._storage;
    for (const key of dst_storage.keys()) {
      keys_to_remove.add(key);
    }

    // update or create entries in dst_storage
    for (const [src_key, src_entry] of this._storage) {
      keys_to_remove.delete(src_key);

      if (dst_storage.has(src_key)) {
        const dst_entry = dst_storage.get(src_key)!;
        // dst_entry.string_converter = src_entry.string_converter;
        dst_entry.value = src_entry.value;
        dst_entry.info = src_entry.info;
        dst_entry.sequence_id++;
        dst_entry.stamp = now();
      } else {
        const new_entry = new Entry(src_entry.info);
        new_entry.value = src_entry.value;
        // new_entry.string_converter = src_entry.string_converter;
        dst_storage.set(src_key, new_entry);
      }
    }

    for (const key of keys_to_remove) {
      dst_storage.delete(key);
    }
  }

  createEntry(key: PropertyKey, info: PortInfo): Entry {
    key = String(key);

    if (ROOT_KEY_REGEXP.test(key)) {
      if (key.slice(ROOT_KEY_PREFIX.length).includes("@")) {
        throw new Error("Character '@' used multiple times in the key");
      }
      return this.rootBlackboard.createEntryImpl(key.slice(ROOT_KEY_PREFIX.length), info);
    } else {
      return this.createEntryImpl(key, info);
    }
  }

  /**
   * This function might be called recursively, when we do remapping, because we move
   * to the top scope to find already existing entries
   */
  private createEntryImpl(key: PropertyKey, info: PortInfo): Entry {
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
    key = String(key);

    if (ROOT_KEY_REGEXP.test(key)) {
      if (this.parent) return this.parent.getEntry(key);
      else return this.getEntry(key.slice(ROOT_KEY_PREFIX.length));
    }

    if (this._storage.has(key)) return this._storage.get(key)!;
    // not found. Try autoremapping
    if (this.parent) {
      if (this.internalToExternal.has(key)) {
        const newKey = this.internalToExternal.get(key)!;
        return this.parent.getEntry(newKey);
      }

      if (this.autoRemapping && !isPrivateKey(key)) {
        return this.parent.getEntry(key);
      }
    }
  }

  getStamped<T = any>(key: PropertyKey): StampedValue<T> | undefined {
    const entry = this.getEntry(key);
    if (entry) {
      return new StampedValue<T>(entry!.value, new Timestamp(entry.stamp, entry.sequence_id));
    }
  }

  get rootBlackboard() {
    let parent = this as Blackboard;
    while (parent && parent.parent) parent = parent.parent;
    return parent;
  }
}
