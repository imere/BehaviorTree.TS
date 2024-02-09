import { DecoratorNode } from "../../DecoratorNode";
import { NodeConfig } from "../../TreeNode";
import {
  NodeStatus,
  PortList,
  createInputPort,
  isStatusCompleted,
  type NodeUserStatus,
} from "../../basic";

export class ThrottleNode extends DecoratorNode {
  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "Throttle";
  }

  private timer: any;

  static providedPorts(): PortList {
    return new PortList([createInputPort("ms")]);
  }

  protected override tick(): NodeUserStatus {
    if (this.timer === undefined) {
      const ms = this.getInputOrThrow("ms", Number);
      this.timer = setTimeout(() => {
        this.timer = undefined;
      }, ms);

      const childStatus = this.child!.executeTick() as NodeUserStatus;
      if (isStatusCompleted(childStatus)) {
        this.resetChild();
      }
      return childStatus;
    }

    return NodeStatus.SUCCESS;
  }

  override halt(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    super.halt();
  }
}
