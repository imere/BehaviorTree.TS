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

function toNumber(value: unknown): number {
  return typeof value === "string" ? (JSON.parse(value) as number) : (value as number);
}

@ImplementPorts
export class ProportionNode extends SyncActionNode {
  static providedPorts() {
    return new PortList([
      createInputPort("x1", "x下限"),
      createInputPort("x2", "x上限"),
      createInputPort("y1", "y下限"),
      createInputPort("y2", "y上限"),
      createInputPort("x", "x实时"),
      createInputPort("y", "y实时"),
      createInputPort("target", "y期望"),
      createOutputPort("output", "x输出"),
    ]);
  }

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "Proportion";
  }

  private lastX: undefined | number;

  private lastY: undefined | number;

  protected override tick(): NodeUserStatus {
    const x1 = this.getInputOrThrow("x1", toNumber);
    const x2 = this.getInputOrThrow("x2", toNumber);

    const y1 = this.getInputOrThrow("y1", toNumber);
    const y2 = this.getInputOrThrow("y2", toNumber);

    const x = this.getInputOrThrow("x", toNumber);
    const y = this.getInputOrThrow("y", toNumber);

    const target = this.getInputOrThrow("target", toNumber);

    if (y === target) {
      this.setOutput("output", x);
      return NodeStatus.SUCCESS;
    }

    let k: number, value: number;

    k = (y2 - y1) / (x2 - x1);

    if (this.lastX === undefined || this.lastY === undefined) {
      [this.lastX, this.lastY] = [x, y];
      value = target / k;
    } else {
      const [num, div] = [y - this.lastY, x - this.lastX];
      if (!num || !div) {
        if (y < target) value = k > 0 ? y2 : y1;
        else value = k > 0 ? y1 : y2;
      } else {
        k = Math.sign(k) * Math.abs(num / div);
        value = target / k;
      }
    }

    this.setOutput("output", Math.max(x1, Math.min(value, x2)));

    return NodeStatus.SUCCESS;
  }
}
