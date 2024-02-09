import { SyncActionNode } from "../../ActionNode";
import type { NodeConfig } from "../../TreeNode";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  createOutputPort,
  type NodeUserStatus,
} from "../../basic";

@ImplementPorts
export class PickNode extends SyncActionNode {
  static providedPorts(): PortList {
    return new PortList([
      createInputPort("input"),
      createInputPort("key"),
      createOutputPort("output"),
    ]);
  }

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "Pick";
  }

  override tick(): NodeUserStatus {
    const input = this.getInputOrThrow("input");
    const key = this.getInputOrThrow("key");
    this.setOutput("output", input[key]);
    return NodeStatus.SUCCESS;
  }
}
