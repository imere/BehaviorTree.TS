import { ControlNode } from "../ControlNode.js";
import { NodeConfig } from "../TreeNode.js";
import { NodeStatus, PortList, createInputPort, type NodeUserStatus } from "../basic.js";

const THRESHOLD_SUCCESS = "success_count";
const THRESHOLD_FAILURE = "failure_count";

/**
 * @brief The ParallelNode execute all its children
 * __concurrently__, but not in separate threads!
 *
 * Even if this may look similar to ReactiveSequence,
 * this Control Node is the __only__ one that can have
 * multiple children RUNNING at the same time.
 *
 * The Node is completed either when the THRESHOLD_SUCCESS
 * or THRESHOLD_FAILURE number is reached (both configured using ports).
 *
 * If any of the thresholds is reached, and other children are still running,
 * they will be halted.
 *
 * Note that threshold indexes work as in Python:
 * https://www.i2tutorials.com/what-are-negative-indexes-and-why-are-they-used/
 *
 * Therefore -1 is equivalent to the number of children.
 */
export class ParallelNode extends ControlNode {
  private _completedList = new Set<number>();

  private _successCount = 0;

  private _failureCount = 0;

  private _readParameterFromPorts = true;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "Parallel";
    // A node the factory built for an XML document carries a manifest, and its
    // thresholds are the ports. A node assembled in code has no manifest and
    // only the setters, which is what upstream's name-only constructor means.
    this._readParameterFromPorts = config.manifest !== undefined;
  }

  static providedPorts(): PortList {
    return new PortList([
      createInputPort(
        THRESHOLD_SUCCESS,
        "number of children that need to succeed to trigger a SUCCESS",
        -1
      ),
      createInputPort(
        THRESHOLD_FAILURE,
        "number of children that need to fail to trigger a FAILURE",
        1
      ),
    ]);
  }

  private _successThresholdValue = -1;

  private _failureThresholdValue = 1;

  successThreshold(): number {
    return resolveThreshold(this._successThresholdValue, this.childrenCount());
  }

  failureThreshold(): number {
    return resolveThreshold(this._failureThresholdValue, this.childrenCount());
  }

  setSuccessThreshold(threshold: number): void {
    this._successThresholdValue = threshold;
    this._readParameterFromPorts = false;
  }

  setFailureThreshold(threshold: number): void {
    this._failureThresholdValue = threshold;
    this._readParameterFromPorts = false;
  }

  protected override tick(): NodeUserStatus {
    if (this._readParameterFromPorts) {
      const success = this.getInput(THRESHOLD_SUCCESS, Number);
      if (success === undefined) {
        throw new Error(`Missing parameter [${THRESHOLD_SUCCESS}] in ParallelNode`);
      }
      this._successThresholdValue = success;

      const failure = this.getInput(THRESHOLD_FAILURE, Number);
      if (failure === undefined) {
        throw new Error(`Missing parameter [${THRESHOLD_FAILURE}] in ParallelNode`);
      }
      this._failureThresholdValue = failure;
    }

    const childrenCount = this.childrenCount();

    if (childrenCount < this.successThreshold()) {
      throw new Error("Number of children is less than threshold. Can never succeed.");
    }
    if (childrenCount < this.failureThreshold()) {
      throw new Error("Number of children is less than threshold. Can never fail.");
    }

    this.setStatus(NodeStatus.RUNNING);

    let skippedCount = 0;

    // Routing the tree according to the sequence node's logic:
    for (let i = 0; i < childrenCount; i++) {
      if (!this._completedList.has(i)) {
        const childStatus = this.children[i].executeTick();

        switch (childStatus) {
          case NodeStatus.SKIPPED: {
            skippedCount++;
            break;
          }

          case NodeStatus.SUCCESS: {
            this._completedList.add(i);
            this._successCount++;
            break;
          }

          case NodeStatus.FAILURE: {
            this._completedList.add(i);
            this._failureCount++;
            break;
          }

          case NodeStatus.RUNNING: {
            // Still working. Check the next
            break;
          }

          case NodeStatus.IDLE: {
            throw new Error(`${this.name}: A children should not return IDLE`);
          }
        }
      }

      const requiredSuccessCount = this.successThreshold();

      if (
        this._successCount >= requiredSuccessCount ||
        (this._successThresholdValue < 0 &&
          this._successCount + skippedCount >= requiredSuccessCount)
      ) {
        this.clear();
        this.resetChildren();
        return NodeStatus.SUCCESS;
      }

      // It fails if it is not possible to succeed anymore or if
      // number of failures are equal to the failure threshold
      if (
        childrenCount - this._failureCount < requiredSuccessCount ||
        this._failureCount === this.failureThreshold()
      ) {
        this.clear();
        this.resetChildren();
        return NodeStatus.FAILURE;
      }
    }
    // Skip if ALL the nodes have been skipped
    return skippedCount === childrenCount ? NodeStatus.SKIPPED : NodeStatus.RUNNING;
  }

  private clear(): void {
    this._completedList.clear();
    this._successCount = 0;
    this._failureCount = 0;
  }

  override halt(): void {
    this.clear();
    super.halt();
  }
}

/** A negative threshold counts back from the number of children, as in Python. */
function resolveThreshold(threshold: number, childrenCount: number): number {
  return threshold < 0 ? Math.max(childrenCount + threshold + 1, 0) : threshold;
}
