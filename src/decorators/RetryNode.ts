import { DecoratorNode } from "../DecoratorNode.js";
import { NodeConfig } from "../TreeNode.js";
import { NodeStatus, PortList, createInputPort, type NodeUserStatus } from "../basic.js";

const NUM_ATTEMPTS = "num_attempts";

/**
 * If the child returns SUCCESS, this node returns SUCCESS.
 *
 * If the child returns FAILURE, this node will try again up to N times
 * (N is read from port "num_attempts").
 *
 * Example:
 *
 * <RetryUntilSuccessful num_attempts="3">
 *     <OpenDoor/>
 * </RetryUntilSuccessful>
 */
export class RetryNode extends DecoratorNode {
  private maxAttempts: number;

  private tryCount = 0;

  private readParameterFromPorts: boolean;

  constructor(name: string, config: NodeConfig, nTries = 0) {
    super(name, config);
    this.registrationId = "RetryUntilSuccessful";
    this.maxAttempts = nTries;
    this.readParameterFromPorts = nTries === 0;
  }

  static providedPorts(): PortList {
    return new PortList([
      createInputPort(
        NUM_ATTEMPTS,
        "Execute again a failing child up to N times. Use -1 to create an infinite loop."
      ),
    ]);
  }

  override halt(): void {
    this.tryCount = 0;
    super.halt();
  }

  protected override tick(): NodeUserStatus {
    if (this.readParameterFromPorts) {
      const attempts = this.getInput(NUM_ATTEMPTS, Number);
      if (attempts === undefined) {
        throw new Error(`Missing parameter [${NUM_ATTEMPTS}] in RetryNode`);
      }
      this.maxAttempts = attempts;
    }

    let doLoop = this.tryCount < this.maxAttempts || this.maxAttempts === -1;
    this.setStatus(NodeStatus.RUNNING);

    while (doLoop) {
      const prevStatus = this.child!.status;

      const childStatus = this.child!.executeTick();

      switch (childStatus) {
        case NodeStatus.SUCCESS: {
          this.tryCount = 0;
          this.resetChild();
          return NodeStatus.SUCCESS;
        }

        case NodeStatus.FAILURE: {
          this.tryCount++;
          // Refresh maxAttempts in case it changed in one of the child nodes
          if (this.readParameterFromPorts) {
            const attempts = this.getInput(NUM_ATTEMPTS, Number);
            if (attempts !== undefined) this.maxAttempts = attempts;
          }
          doLoop = this.tryCount < this.maxAttempts || this.maxAttempts === -1;

          this.resetChild();

          // Return the execution flow if the child is async,
          // to make this interruptible.
          if (this.requiresWakeUp() && prevStatus === NodeStatus.IDLE && doLoop) {
            this.emitWakeUpSignal();
            return NodeStatus.RUNNING;
          }
          break;
        }

        case NodeStatus.RUNNING: {
          return NodeStatus.RUNNING;
        }

        case NodeStatus.SKIPPED: {
          // to allow it to be skipped again, we must reset the node
          this.resetChild();
          // the child has been skipped. Skip this too
          return NodeStatus.SKIPPED;
        }

        case NodeStatus.IDLE: {
          throw new Error(`${this.name}: A children should not return IDLE`);
        }
      }
    }

    this.tryCount = 0;
    return NodeStatus.FAILURE;
  }
}
