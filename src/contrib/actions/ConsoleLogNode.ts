import { SyncActionNode } from "../../ActionNode";
import type { NodeConfig } from "../../TreeNode";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  type NodeUserStatus,
} from "../../basic";

@ImplementPorts
export class ConsoleLogNode extends SyncActionNode {
  static providedPorts() {
    return new PortList([createInputPort("key"), createInputPort("param")]);
  }

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "ConsoleLog";
  }

  protected override tick(): NodeUserStatus {
    console.log(`${this.registrationId}:`, this.getInput("key"), this.getInput("param"));
    return NodeStatus.SUCCESS;
  }
}
