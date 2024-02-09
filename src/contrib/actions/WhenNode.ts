import { SyncActionNode } from "../../ActionNode";
import {
  createInputPort,
  ImplementPorts,
  NodeStatus,
  PortList,
  type NodeUserStatus,
} from "../../basic";
import { createRuntimeExecutor, supportScriptExpression } from "../../scripting/parser";
import type { NodeConfig } from "../../TreeNode";

@ImplementPorts
export class WhenNode extends SyncActionNode {
  static providedPorts(): PortList {
    return new PortList([createInputPort("input"), createInputPort("code")]);
  }

  private _script = "";

  private _executor?: (arg: { _: unknown }) => unknown;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "When";
  }

  override tick(): NodeUserStatus {
    this.loadExecutor();
    return this._executor!({ _: this.getInput("input") }) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }

  private loadExecutor(): void {
    let script = this.getInputOrThrow("code");
    if (script === this._script) return;
    this._script = script;
    script = supportScriptExpression(script);
    this._executor = createRuntimeExecutor([this.config.blackboard, this.config.enums], script);
  }
}
