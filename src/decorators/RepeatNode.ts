import { DecoratorNode } from "../DecoratorNode.js";
import { NodeConfig } from "../TreeNode.js";
import {
  NodeStatus,
  PortList,
  createInputPort,
  isStatusCompleted,
  type NodeUserStatus,
} from "../basic.js";

/**
 * Runs the child until it has returned SUCCESS `num_cycles` times.
 * A FAILURE from the child stops the loop and is returned as-is.
 * `num_cycles` of -1 loops forever.
 */
export class RepeatNode extends DecoratorNode {
  private numCycles: number;

  private repeatCount = 0;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "Repeat";
    this.numCycles = Number(this.getInput("num_cycles", String) ?? 1);
  }

  static providedPorts(): PortList {
    return new PortList([
      createInputPort(
        "num_cycles",
        "Repeat a successful child up to N times. -1 loops forever.",
        1
      ),
    ]);
  }

  protected override tick(): NodeUserStatus {
    while (true) {
      const status = this.child!.executeTick() as NodeUserStatus;

      if (!isStatusCompleted(status)) {
        return status;
      }

      this.resetChild();

      if (status === NodeStatus.FAILURE) {
        this.setStatus(NodeStatus.FAILURE);
        return NodeStatus.FAILURE;
      }

      this.repeatCount++;
      if (this.numCycles > 0 && this.repeatCount >= this.numCycles) {
        this.setStatus(NodeStatus.SUCCESS);
        return NodeStatus.SUCCESS;
      }
    }
  }

  override halt(): void {
    this.repeatCount = 0;
    super.halt();
  }
}
