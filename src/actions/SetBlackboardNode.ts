import { SyncActionNode } from "../ActionNode.js";
import { convertFromString } from "../Parser.js";
import { TreeNode, type NodeConfig } from "../TreeNode.js";
import {
  NodeStatus,
  PortList,
  createBidiPort,
  createInputPort,
  type NodeUserStatus,
} from "../basic.js";

export class SetBlackboardNode extends SyncActionNode {
  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "SetBlackboard";
  }

  static providedPorts(): PortList {
    return new PortList([
      createInputPort("value", "Value to be written in the outputKey"),
      createBidiPort("outputKey", "Name of the blackboard entry where the value should be written"),
    ]);
  }

  override tick(): NodeUserStatus {
    const outputKey = this.getInputOrThrow("outputKey");

    const valueStr = this.config.input.get("value");

    const strippedKey = TreeNode.stripBlackboardPointer(valueStr);

    let value: unknown;

    if (strippedKey) {
      const srcEntry = this.config.blackboard.getEntry(strippedKey);

      if (!srcEntry) throw new Error("Can't find the port referred by [value]");

      value = srcEntry.value;
    } else {
      value = convertFromString(this.config.enums, valueStr);
    }

    if (value === undefined) return NodeStatus.FAILURE;

    // set() rather than a direct entry write: it creates the entry and bumps
    // sequence_id / stamp, which WaitValueUpdate and SkipUnlessUpdated read
    this.config.blackboard.set(outputKey, value);

    return NodeStatus.SUCCESS;
  }
}
