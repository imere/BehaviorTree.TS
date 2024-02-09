import { StatefulActionNode } from "../ActionNode";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  type NodeUserStatus,
} from "../basic";

class Pose2D {
  constructor(public x: number, public y: number, public theta: number) {}

  toJSON(): string {
    const { x, y, theta } = this;
    return JSON.stringify({ x, y, theta });
  }

  toString(): string {
    const { x, y, theta } = this;
    return `${x};${y};${theta}`;
  }

  static from(value: string): Pose2D;
  static from(value: unknown): Pose2D {
    if (value instanceof Pose2D) {
      return new Pose2D(value.x, value.y, value.theta);
    }
    if (typeof value === "string") {
      const args: unknown[] = value.split(";");
      if (args.length !== 3) throw new Error("invalid input)");
      return new Pose2D(...(args.map(Number) as [number, number, number]));
    }
    throw new Error("invalid input)");
  }
}

@ImplementPorts
export class MoveBaseAction extends StatefulActionNode {
  static providedPorts() {
    return new PortList([createInputPort("goal")]);
  }

  private _goal!: Pose2D;

  private completionTime = 0;

  override onStart(): NodeUserStatus {
    this._goal = this.getInputOrThrow("goal", Pose2D.from);
    this.completionTime = Date.now() + 220;
    return NodeStatus.RUNNING;
  }

  override onRunning(): NodeUserStatus {
    if (Date.now() >= this.completionTime) return NodeStatus.SUCCESS;
    return NodeStatus.RUNNING;
  }

  override onHalted(): void {
    // noop
  }
}
