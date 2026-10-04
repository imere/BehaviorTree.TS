import { SyncActionNode } from "../ActionNode.js";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  type NodeUserStatus,
} from "../basic.js";

@ImplementPorts
export class SaySomething extends SyncActionNode {
  static providedPorts() {
    return new PortList([createInputPort("message")]);
  }

  protected override tick(): NodeUserStatus {
    this.getInputOrThrow("message");
    return NodeStatus.SUCCESS;
  }
}
