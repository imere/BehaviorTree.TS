import { DecoratorNode } from "../DecoratorNode";
import { NodeConfig } from "../TreeNode";
import { NodeStatus, NodeUserStatus, PortList, createInputPort, isStatusCompleted } from "../basic";

export class RunOnceNode extends DecoratorNode {
  private alreadyTicked = false;

  private returnedStatus = NodeStatus.IDLE;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "RunOnce";
  }

  static providedPorts(): PortList {
    return new PortList([
      createInputPort(
        "thenSkip",
        "If true, skip after the first execution, otherwise return the same NodeStatus returned once bu the child.",
        "true"
      ),
    ]);
  }

  protected override tick(): NodeUserStatus {
    let skip = true;
    const value = this.getInput("thenSkip", (_) => JSON.parse(_));
    if (value !== undefined) skip = value;

    if (this.alreadyTicked) {
      return skip ? NodeStatus.SKIPPED : (this.returnedStatus as NodeUserStatus);
    }

    this.setStatus(NodeStatus.RUNNING);

    const status = this.child!.executeTick();

    if (isStatusCompleted(status)) {
      this.alreadyTicked = true;
      this.returnedStatus = status;
      this.resetChild();
    }

    return status as NodeUserStatus;
  }
}
