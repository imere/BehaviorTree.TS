import { ControlNode } from "../ControlNode";
import { NodeConfig } from "../TreeNode";
import { NodeStatus, PortList, createInputPort, type NodeUserStatus } from "../basic";

/**
 * @brief The ParallelAllNode execute all its children
 * __concurrently__, but not in separate threads!
 *
 * It differs in the way ParallelNode works because the latter may stop
 * and halt other children if a certain number of SUCCESS/FAILURES is reached,
 * whilst this one will always complete the execution of ALL its children.
 *
 * Note that threshold indexes work as in Python:
 * https://www.i2tutorials.com/what-are-negative-indexes-and-why-are-they-used/
 *
 * Therefore -1 is equivalent to the number of children.
 */
export class ParallelAllNode extends ControlNode {
  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this._failureThreshold = 1;
  }

  static providedPorts(): PortList {
    return new PortList([
      createInputPort(
        "maxFailures",
        "If the number of children returning FAILURE exceeds this value,  ParallelAll returns FAILURE",
        1
      ),
    ]);
  }

  private readonly completed = new Set<number>();

  private failureCount = 0;

  protected override tick(): NodeUserStatus {
    const maxFailures = this.getInput("maxFailures", Number);

    if (maxFailures === undefined || isNaN(maxFailures)) {
      throw new Error("Missing parameter [max_failures] in ParallelNode");
    }

    const count = this.childrenCount();

    this.setFailureThreshold(maxFailures);

    if (count < this.failureThreshold) {
      throw new Error(
        `Number of children is less than threshold(${this.failureThreshold}). Can never fail.`
      );
    }

    this.setStatus(NodeStatus.RUNNING);

    let skippedCount = 0;

    for (let i = 0; i < count; i++) {
      const child = this.children[i];

      if (this.completed.has(i)) continue;

      const status = child.executeTick();

      switch (status) {
        case NodeStatus.SUCCESS: {
          this.completed.add(i);
          break;
        }
        case NodeStatus.FAILURE: {
          this.completed.add(i);
          this.failureCount++;
          break;
        }
        case NodeStatus.RUNNING: {
          // Still working. Check the next
          break;
        }
        case NodeStatus.SKIPPED: {
          skippedCount++;
          break;
        }
        case NodeStatus.IDLE: {
          throw new Error(`ParallelAllNode(${this.name}): A children should not return IDLE`);
        }
      }
    }

    if (skippedCount === this.childrenCount()) return NodeStatus.SKIPPED;

    if (skippedCount + this.completed.size >= this.childrenCount()) {
      this.haltChildren();
      this.completed.clear();
      const status =
        this.failureCount >= this.failureThreshold ? NodeStatus.FAILURE : NodeStatus.SUCCESS;
      this.failureCount = 0;
      return status;
    }

    // Some children haven't finished, yet.
    return NodeStatus.RUNNING;
  }

  override halt(): void {
    this.completed.clear();
    this.failureCount = 0;
    super.halt();
  }

  private _failureThreshold = 1;

  get failureThreshold() {
    return this._failureThreshold;
  }

  setFailureThreshold(threshold: number): void {
    if (threshold < 0) {
      this._failureThreshold = Math.max(this.children.length + threshold + 1, 0);
    } else {
      this._failureThreshold = threshold;
    }
  }
}
