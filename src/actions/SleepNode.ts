import { StatefulActionNode } from "../ActionNode.js";
import { NodeConfig } from "../TreeNode.js";
import { NodeStatus, PortList, createInputPort, type NodeUserStatus } from "../basic.js";

export class SleepNode extends StatefulActionNode {
  private timer: any;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "Sleep";
  }

  static providedPorts(): PortList {
    return new PortList([createInputPort("msec")]);
  }

  override onStart(): NodeUserStatus {
    const ms = this.getInputOrThrow("msec", Number);

    if (ms <= 0) return NodeStatus.SUCCESS;

    this.setStatus(NodeStatus.RUNNING);

    this.timer = setTimeout(() => {
      if (this.timer === undefined) this.emitWakeUpSignal();
      this.timer = undefined;
    }, ms);

    return NodeStatus.RUNNING;
  }

  override onRunning(): NodeUserStatus {
    return this.timer === undefined ? NodeStatus.SUCCESS : NodeStatus.RUNNING;
  }

  override onHalted(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
