import { DecoratorNode } from "../DecoratorNode";
import { NodeConfig } from "../TreeNode";
import { NodeStatus, NodeUserStatus, PortList, createInputPort, isStatusCompleted } from "../basic";

/**
 * @brief The TimeoutNode will halt() a running child if
 * the latter has been RUNNING longer than a given time.
 * The timeout is in milliseconds and it is passed using the port "ms".
 *
 * If timeout is reached, the node returns FAILURE.
 *
 * Example:
 *
 * <Timeout msec="5000">
 *    <KeepYourBreath/>
 * </Timeout>
 */
export class TimeoutNode extends DecoratorNode {
  constructor(name: string, config: NodeConfig, private ms: number = 0) {
    super(name, config);
    if (!ms) this.readParameterFromPorts = true;
    this.registrationId = "Timeout";
  }

  private childHalted = false;

  private timer: any;

  private readParameterFromPorts = false;

  private timeoutStarted = false;

  static providedPorts(): PortList {
    return new PortList([
      createInputPort(
        "ms",
        "After a certain amount of time, halt() the child if it is still running."
      ),
    ]);
  }

  protected override tick(): NodeUserStatus {
    if (this.readParameterFromPorts) {
      this.ms = this.getInputOrThrow("ms", Number);
    }

    if (!this.timeoutStarted) {
      this.timeoutStarted = true;

      this.setStatus(NodeStatus.RUNNING);

      this.childHalted = false;

      if (this.ms > 0) {
        this.timer = setTimeout(() => {
          if (this.child!.status === NodeStatus.RUNNING) {
            this.childHalted = true;
            this.haltChild();
            this.emitWakeUpSignal();
          }
        }, this.ms);
      }
    }

    if (this.childHalted) {
      this.timeoutStarted = false;
      return NodeStatus.FAILURE;
    } else {
      const childStatus = this.child!.executeTick() as NodeUserStatus;
      if (isStatusCompleted(childStatus)) {
        this.timeoutStarted = false;
        clearTimeout(this.timer);
        this.resetChild();
      }
      return childStatus;
    }
  }

  override halt(): void {
    this.timeoutStarted = false;
    clearTimeout(this.timer);
    super.halt();
  }
}
