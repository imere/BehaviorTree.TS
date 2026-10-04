import { DecoratorNode } from "../DecoratorNode.js";
import { NodeConfig } from "../TreeNode.js";
import {
  NodeStatus,
  NodeUserStatus,
  PortList,
  createInputPort,
  isStatusCompleted,
} from "../basic.js";

export class RunOnceNode extends DecoratorNode {
  private _alreadyTicked = false;

  private _returnedStatus = NodeStatus.IDLE;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "RunOnce";
  }

  static providedPorts(): PortList {
    return new PortList([
      createInputPort(
        "then_skip",
        "If true, skip after the first execution, otherwise return the same NodeStatus returned once bu the child.",
        "true"
      ),
    ]);
  }

  protected override tick(): NodeUserStatus {
    let skip = true;
    const value = this.getInput("then_skip", (_) => JSON.parse(_));
    if (value !== undefined) skip = value;

    if (this._alreadyTicked) {
      return skip ? NodeStatus.SKIPPED : (this._returnedStatus as NodeUserStatus);
    }

    this.setStatus(NodeStatus.RUNNING);

    const status = this.child!.executeTick();

    if (isStatusCompleted(status)) {
      this._alreadyTicked = true;
      this._returnedStatus = status;
      this.resetChild();
    }

    return status as NodeUserStatus;
  }
}
