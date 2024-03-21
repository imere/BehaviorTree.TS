import { StatefulActionNode } from "../ActionNode";
import { NodeConfig } from "../TreeNode";
import { NodeStatus, PortList, type NodeUserStatus } from "../basic";
import { createRuntimeExecutor } from "../scripting/parser";

export interface ITestNodeConfig {
  returnStatus: "SUCCESS" | "FAILURE" | "RUNNING";
  postScript?: string;
  asyncDelay?: number;
}

export class TestNodeConfig implements ITestNodeConfig {
  /** status to return when the action is completed */
  returnStatus = "RUNNING" as ITestNodeConfig["returnStatus"];

  /** script to execute when actions is completed */
  postScript?: string;

  /** if async_delay > 0, this action become asynchronous and wait this amount of time */
  asyncDelay = 0;

  /** callback to execute at the beginning */
  preFunc?: () => void;

  /** callback to execute at the end */
  postFunc?: () => void;
}

export class TestNode extends StatefulActionNode {
  private timer: any;

  private completed = false;

  private executor?: () => void;

  constructor(
    name: string,
    config: NodeConfig,
    private testConfig = new TestNodeConfig()
  ) {
    super(name, config);
    this.registrationId = "TestNode";
  }

  static providedPorts(): PortList {
    return new PortList();
  }

  setConfig(config: TestNodeConfig): void {
    this.testConfig = config;
    if (config.postScript) {
      this.executor = createRuntimeExecutor(
        [this.config.blackboard, this.config.enums],
        config.postScript
      );
    }
  }

  override onStart(): NodeUserStatus {
    if (this.testConfig.preFunc) this.testConfig.preFunc();

    if (this.testConfig.asyncDelay <= 0) return this.onCompleted();

    this.completed = false;

    this.timer = setTimeout(() => {
      if (this.timer === undefined) {
        this.completed = false;
      } else {
        this.completed = true;
        this.emitWakeUpSignal();
      }
    }, this.testConfig.asyncDelay);

    return NodeStatus.RUNNING;
  }

  override onRunning(): NodeUserStatus {
    if (this.completed) return this.onCompleted();
    return NodeStatus.RUNNING;
  }

  override onHalted(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private onCompleted(): NodeUserStatus {
    if (this.executor) {
      this.executor();
    }

    this.testConfig.postFunc?.();

    return NodeStatus[this.testConfig.returnStatus];
  }
}
