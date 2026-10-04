import { StatefulActionNode } from "../ActionNode.js";
import type { NodeConfig } from "../TreeNode.js";
import { NodeStatus, PortList, type NodeUserStatus } from "../basic.js";
import {
  createRuntimeExecutor,
  supportScriptExpression,
  type Environment,
  type ScriptFunction,
} from "../scripting/parser.js";

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
  complete_func?: () => NodeUserStatus;

  /**
   * Optional script to compute the completion status dynamically. Evaluated
   * when the TestNode completes, after any async_delay has elapsed, using the
   * current blackboard state. Takes precedence over [return_status].
   */
  return_status_script?: string;
}

export class TestNodeConfig implements ITestNodeConfig {
  return_status: Exclude<keyof typeof NodeStatus, "IDLE"> = "SUCCESS";

  success_script?: string;

  failure_script?: string;

  post_script?: string;

  async_delay = 0;

  return_status_script?: string;

  complete_func = () => NodeStatus[this.return_status] as NodeUserStatus;
}

export class TestNode extends StatefulActionNode {
  static providedPorts(): PortList {
    return new PortList();
  }

  constructor(
    name: string,
    config: NodeConfig,
    private _testConfig = new TestNodeConfig()
  ) {
    super(name, config);
    this.registrationId = "TestNode";

    // @ts-expect-error This comparison appears to be unintentional because the types 'string' and 'NodeStatus' have no overlap
    if (this._testConfig.return_status === NodeStatus.IDLE) {
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

    this._successExecutor = parseScript(this._testConfig.success_script);
    this._failureExecutor = parseScript(this._testConfig.failure_script);
    this._postExecutor = parseScript(this._testConfig.post_script);

    // return_status_script may reference NodeStatus names, so it gets its own
    // environment with those names injected.
    if (this._testConfig.return_status_script) {
      let execute: () => unknown;
      const statusEnums = new Map(this.config.enums);
      for (const key of Object.keys(NodeStatus) as (keyof typeof NodeStatus)[]) {
        statusEnums.set(key, NodeStatus[key]);
      }
      const env: Environment = [this.config.blackboard, statusEnums];
      const script = supportScriptExpression(this._testConfig.return_status_script);
      this._returnStatusExecutor = () => {
        if (!execute) execute = createRuntimeExecutor(env, script);
        return execute();
      };
    }
  }

  private _timer: any;

  private _completed = false;

  private _successExecutor?: ScriptFunction;

  private _failureExecutor?: ScriptFunction;

  private _postExecutor?: ScriptFunction;

  private _returnStatusExecutor?: () => unknown;

  override onStart(): NodeUserStatus {
    if (this._testConfig.async_delay <= 0) return this._onCompleted();

    // convert this in an asynchronous operation. Use another thread to count
    // a certain amount of time.
    this._completed = false;

    this._timer = setTimeout(() => {
      if (this._timer === undefined) {
        this._completed = false;
      } else {
        this._completed = true;
        this.emitWakeUpSignal();
      }
    }, this._testConfig.async_delay);

    return NodeStatus.RUNNING;
  }

  override onRunning(): NodeUserStatus {
    if (this._completed) return this._onCompleted();
    return NodeStatus.RUNNING;
  }

  override onHalted(): void {
    clearTimeout(this._timer);
    this._timer = undefined;
  }

  private _onCompleted(): NodeUserStatus {
    let status: NodeUserStatus;
    if (this._returnStatusExecutor) {
      status = this._resolveScriptStatus(this._returnStatusExecutor());
    } else {
      status = this._testConfig.complete_func();
    }

    // The success/failure/post scripts see only the node's own enums, so a
    // blackboard entry that happens to be named like a status is not shadowed.
    const env: Environment = [this.config.blackboard, this.config.enums];

    if (status === NodeStatus.SUCCESS && this._successExecutor) {
      this._successExecutor(env);
    } else if (status === NodeStatus.FAILURE && this._failureExecutor) {
      this._failureExecutor(env);
    }

    this._postExecutor?.(env);

    return status;
  }

  private _resolveScriptStatus(result: unknown): NodeUserStatus {
    let status: NodeStatus;
    if (typeof result === "string") {
      status = NodeStatus[result as keyof typeof NodeStatus];
      if (status === undefined) {
        throw new Error(`TestNode return_status_script resolved to unknown status [${result}]`);
      }
    } else if (typeof result === "number") {
      status = result as NodeStatus;
    } else {
      throw new Error("TestNode return_status_script must evaluate to a NodeStatus value");
    }

    if (status === NodeStatus.IDLE) {
      throw new Error("TestNode can not return IDLE");
    }
    return status as NodeUserStatus;
  }
}
