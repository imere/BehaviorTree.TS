import { SyncActionNode } from "../ActionNode";
import { convertFromString } from "../Parser";
import { TreeNode, type NodeConfig } from "../TreeNode";
import {
  NodeStatus,
  PortList,
  createBidiPort,
  createInputPort,
  type NodeUserStatus,
} from "../basic";

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

    if (strippedKey) {
      const inputKey = strippedKey;
      const srcEntry = this.config.blackboard.getEntry(inputKey);
      let dstEntry = this.config.blackboard.getEntry(outputKey);

      if (!srcEntry) throw new Error("Can't find the port referred by [value]");

      if (!dstEntry) {
        this.config.blackboard.createEntry(outputKey, srcEntry.portInfo);
        dstEntry = this.config.blackboard.getEntry(outputKey);
      }

      dstEntry!.value = srcEntry.value;
    } else {
      this.config.blackboard.set(outputKey, convertFromString(this.config.enums, valueStr));
    }

    return NodeStatus.SUCCESS;
  }
}
