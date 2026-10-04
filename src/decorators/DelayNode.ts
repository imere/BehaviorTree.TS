import { DecoratorNode } from "../DecoratorNode.js";
import { NodeConfig } from "../TreeNode.js";
import {
  NodeStatus,
  NodeUserStatus,
  PortList,
  createInputPort,
  isStatusCompleted,
} from "../basic.js";

/**
 * @brief The delay node will introduce a delay and then tick the
 * child returning the status of the child as it is upon completion
 * The delay is in milliseconds and it is passed using the port "delay_msec".
 *
 * During the delay the node changes status to RUNNING
 *
 * Example:
 *
 * <Delay delay_msec="5000">
 *    <KeepYourBreath/>
 * </Delay>
 */
export class DelayNode extends DecoratorNode {
  constructor(
    name: string,
    config: NodeConfig,
    private _delay_msec: number = 0
  ) {
    super(name, config);
    if (!this._delay_msec) this.readParameterFromPorts = true;
    this.registrationId = "Delay";
  }

  private timer: any;

  private readParameterFromPorts = false;

  private delayStarted = false;

  private delayAborted = false;

  private delayComplete = false;

  static providedPorts(): PortList {
    return new PortList([createInputPort("delay_msec", "Tick the child after a few milliseconds")]);
  }

  protected override tick(): NodeUserStatus {
    if (this.readParameterFromPorts) {
      this._delay_msec = this.getInputOrThrow("delay_msec", Number);
    }

    if (!this.delayStarted) {
      this.delayComplete = this.delayAborted = false;
      this.delayStarted = true;

      this.setStatus(NodeStatus.RUNNING);

      this.timer = setTimeout(() => {
        this.delayComplete = true;
      }, this._delay_msec);
    }

    if (this.delayAborted) {
      this.delayAborted = this.delayStarted = false;
      return NodeStatus.FAILURE;
    } else if (this.delayComplete) {
      const childStatus = this.child!.executeTick() as NodeUserStatus;
      if (isStatusCompleted(childStatus)) {
        this.delayStarted = this.delayAborted = false;
        this.resetChild();
      }
      return childStatus;
    } else {
      return NodeStatus.RUNNING;
    }
  }

  override halt(): void {
    this.delayStarted = false;
    clearTimeout(this.timer);
    super.halt();
  }
}
