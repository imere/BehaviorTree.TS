import { StatefulActionNode } from "../ActionNode";
import type { NodeConfig } from "../TreeNode";
import { NodeStatus, PortList, type NodeUserStatus } from "../basic";
import { createRuntimeExecutor, type Environment, type ScriptFunction } from "../scripting/parser";

export interface ITestNodeConfig {
  return_status: Exclude<keyof typeof NodeStatus, "IDLE">;
  /**
   * script to execute when complete_func() returns SUCCESS
   */
  success_script?: string;

  /**
   * script to execute when complete_func() returns FAILURE
   */
  failure_script?: string;

  /**
   * script to execute when actions is completed
   */
  post_script?: string;

  /**
   * if async_delay > 0, this action become asynchronous and wait this amount of time
   */
  async_delay: number;

  /**
   * Function invoked when the action is completed. By default just return [return_status]
   * Override it to intorduce more comple cases
   */
  complete_func: () => NodeUserStatus;
}

export class TestNodeConfig implements ITestNodeConfig {
  return_status = "SUCCESS" as const;

  success_script?: string;

  failure_script?: string;

  post_script?: string;

  async_delay = 0;

  complete_func = () => NodeStatus[this.return_status] as NodeUserStatus;
}

export class TestNode extends StatefulActionNode {
  static providedPorts(): PortList {
    return new PortList();
  }

  constructor(
    name: string,
    config: NodeConfig,
    private testConfig = new TestNodeConfig()
  ) {
    super(name, config);
    this.registrationId = "TestNode";

    // @ts-expect-error This comparison appears to be unintentional because the types 'string' and 'NodeStatus' have no overlap
    if (testConfig.return_status === NodeStatus.IDLE) {
      throw new Error("TestNode can not return IDLE");
    }

    const parseScript = (script: string | undefined): ScriptFunction | undefined => {
      if (!script) return;
      let execute: () => unknown;
      return (env) => {
        if (!execute) execute = createRuntimeExecutor(env, script);
        return execute();
      };
    };

    this.successExecutor = parseScript(testConfig.success_script);
    this.successExecutor = parseScript(testConfig.failure_script);
    this.successExecutor = parseScript(testConfig.post_script);
  }

  private timer: any;

  private completed = false;

  private successExecutor?: ScriptFunction;

  private failureExecutor?: ScriptFunction;

  private postExecutor?: ScriptFunction;

  override onStart(): NodeUserStatus {
    if (this.testConfig.async_delay <= 0) return this.onCompleted();

    // convert this in an asynchronous operation. Use another thread to count
    // a certain amount of time.
    this.completed = false;

    this.timer = setTimeout(() => {
      if (this.timer === undefined) {
        this.completed = false;
      } else {
        this.completed = true;
        this.emitWakeUpSignal();
      }
    }, this.testConfig.async_delay);

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
    const env: Environment = [this.config.blackboard, this.config.enums];

    const status = this.testConfig.complete_func();
    if (status === NodeStatus.SUCCESS && this.successExecutor) {
      this.successExecutor(env);
    } else if (status === NodeStatus.FAILURE && this.failureExecutor) {
      this.failureExecutor(env);
    }

    this.postExecutor?.(env);

    return status as NodeUserStatus;
  }
}
