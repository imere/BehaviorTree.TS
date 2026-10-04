import { ControlNode } from "../ControlNode.js";
import { NodeConfig } from "../TreeNode.js";
import { NodeStatus, PortList, createInputPort, type NodeUserStatus } from "../basic.js";

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
    this.__failureThreshold = 1;
  }

  static providedPorts(): PortList {
    return new PortList([
      createInputPort(
        "max_failures",
        "If the number of children returning FAILURE exceeds this value,  ParallelAll returns FAILURE",
        1
      ),
    ]);
  }

  private readonly _completed = new Set<number>();

  private _failureCount = 0;

  protected override tick(): NodeUserStatus {
    const maxFailures = this.getInput("max_failures", Number);

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

      if (this._completed.has(i)) continue;

      const status = child.executeTick();

      switch (status) {
        case NodeStatus.SUCCESS: {
          this._completed.add(i);
          break;
        }
        case NodeStatus.FAILURE: {
          this._completed.add(i);
          this._failureCount++;
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

    if (skippedCount + this._completed.size >= this.childrenCount()) {
      this.haltChildren();
      this._completed.clear();
      const status =
        this._failureCount >= this.failureThreshold ? NodeStatus.FAILURE : NodeStatus.SUCCESS;
      this._failureCount = 0;
      return status;
    }

    // Some children haven't finished, yet.
    return NodeStatus.RUNNING;
  }

  override halt(): void {
    this._completed.clear();
    this._failureCount = 0;
    super.halt();
  }

  private __failureThreshold = 1;

  get failureThreshold() {
    return this.__failureThreshold;
  }

  setFailureThreshold(threshold: number): void {
    if (threshold < 0) {
      this.__failureThreshold = Math.max(this.children.length + threshold + 1, 0);
    } else {
      this.__failureThreshold = threshold;
    }
  }
}
