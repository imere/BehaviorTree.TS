import { SyncActionNode } from "../ActionNode";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  type NodeUserStatus,
} from "../basic";

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
