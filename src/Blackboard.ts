import { PortDirection, PortInfo } from "./basic";

export function isPrivateKey(key: PropertyKey): key is `_${string}` {
  return Boolean(key) && String(key).startsWith("_");
}

export class Entry {
  constructor(public portInfo: PortInfo, public value?: any) {}
}

export class Blackboard extends Map<PropertyKey, Entry> {
  private autoRemapping = false;

  private internalToExternal: Map<PropertyKey, string>;

  private constructor(private readonly parent?: Blackboard) {
    super();
    this.internalToExternal = new Map();
  }

  static create(parent?: Blackboard): Blackboard {
    return new Blackboard(parent);
  }

  override set(key: PropertyKey, value: unknown): this {
    if (!super.has(key)) {
      const entry = this.createEntry(key, new PortInfo(PortDirection.INOUT));
      entry.value = value;
      super.set(key, entry);
    } else {
      super.get(key)!.value = value;
    }

    return this;
  }

  override get<R = any>(key: PropertyKey): R | undefined {
    return this.getEntry(key)?.value;
  }

  override keys(): IterableIterator<PropertyKey> {
    return super.keys();
  }

  enableAutoRemapping(remapping: boolean): void {
    this.autoRemapping = remapping;
  }

  portInfo(key: PropertyKey): PortInfo | undefined {
    if (super.has(key)) return super.get(key)!.portInfo;
  }

  addSubtreeRemapping(internal: string, external: string): void {
    this.internalToExternal.set(internal, external);
  }

  /**
   * This function might be called recursively, when we do remapping, because we move
   * to the top scope to find already existing entries
   */
  createEntry(key: PropertyKey, info: PortInfo): Entry {
    if (super.has(key)) return super.get(key)!;

    let entry: Entry = new Entry(info);

    // manual remapping first
    if (this.internalToExternal.has(key)) {
      const remappedKey = this.internalToExternal.get(key)!;
      if (this.parent) entry = this.parent.createEntry(remappedKey, info);
    } else if (this.autoRemapping && !isPrivateKey(key)) {
      if (this.parent) entry = this.parent.createEntry(key, info);
    } else {
      // not remapped, not found. Create locally.
      entry = new Entry(info);
      entry.value = info.defaultValue;
    }
    super.set(key, entry);
    return entry;
  }

  getEntry(key: PropertyKey): Entry | undefined {
    if (super.has(key)) return super.get(key)!;
    // not found. Try autoremapping
    if (this.parent) {
      if (this.internalToExternal.has(key)) {
        const newKey = this.internalToExternal.get(key)!;
        const entry = this.parent.getEntry(newKey);
        if (entry) super.set(key, entry);
        return entry;
      }

      if (this.autoRemapping && !isPrivateKey(key)) {
        const entry = this.parent.getEntry(key);
        if (entry) super.set(key, entry);
        return entry;
      }
    }
  }
}
