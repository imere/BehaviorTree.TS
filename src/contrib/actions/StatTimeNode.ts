import { SyncActionNode } from "../../ActionNode";
import type { NodeConfig } from "../../TreeNode";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  createOutputPort,
  type NodeUserStatus,
} from "../../basic";
import { supportScriptExpression, type Environment } from "../../scripting/parser";

@ImplementPorts
export class StatTimeNode extends SyncActionNode {
  static providedPorts() {
    return new PortList([
      createInputPort("param"),
      createInputPort("startIf"),
      createInputPort("resetIf"),
      createOutputPort("startAt"),
      createOutputPort("duration"),
    ]);
  }

  private startAt = 0;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "StatTime";
  }

  override tick(): NodeUserStatus {
    this.loadResetIfExecutor();

    const env: Environment = [this.config.blackboard, this.config.enums];
    const param = this.getInput("param");

    if (this._resetIfExecutor(env, param)) {
      this.startAt = 0;
      this.setOutput("startAt", 0);
      this.setOutput("duration", 0);
      return NodeStatus.SUCCESS;
    }

    this.loadStartIfExecutor();

    const now = Date.now();

    if (!this.startAt && this._startIfExecutor(env, param)) {
      this.startAt = now;
    }

    this.setOutput("startAt", this.startAt);
    this.setOutput("duration", now - this.startAt);

    return NodeStatus.SUCCESS;
  }

  private _startIfScript = "";

  private _startIfExecutor!: (env: Environment, input: unknown) => unknown;

  private loadStartIfExecutor(): void {
    let startIfScript = this.getInputOrThrow("startIf");
    if (startIfScript === this._startIfScript) return;
    this._startIfScript = startIfScript;
    startIfScript = supportScriptExpression(startIfScript);
    const executor = new Function(
      "[$B,$E]",
      "_",
      startIfScript
    ) as StatTimeNode["_startIfExecutor"];
    this._startIfExecutor = executor;
  }

  private _resetIfScript = "";

  private _resetIfExecutor!: (env: Environment, input: unknown) => unknown;

  private loadResetIfExecutor(): void {
    let resetIfScript = this.getInputOrThrow("resetIf");
    if (resetIfScript === this._resetIfScript) return;
    this._resetIfScript = resetIfScript;
    resetIfScript = supportScriptExpression(resetIfScript);
    const executor = new Function(
      "[$B,$E]",
      "_",
      resetIfScript
    ) as StatTimeNode["_resetIfExecutor"];
    this._resetIfExecutor = executor;
  }
}
