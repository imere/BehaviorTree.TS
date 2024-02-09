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
import { createRuntimeExecutor, supportScriptExpression } from "../../scripting/parser";

@ImplementPorts
export class TransformNode extends SyncActionNode {
  static providedPorts(): PortList {
    return new PortList([
      createInputPort("input"),
      createInputPort("code"),
      createOutputPort("output"),
    ]);
  }

  private _script = "";

  private _executor: ((arg: { _: unknown }) => unknown) | undefined;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "Transform";
  }

  override tick(): NodeUserStatus {
    this.loadExecutor();
    if (this._executor) {
      this.setOutput("output", this._executor({ _: this.getInput("input") }));
    }
    return NodeStatus.SUCCESS;
  }

  private loadExecutor(): void {
    let script = this.getInput("code") || "";
    if (script === this._script) return;
    this._script = script;
    script = supportScriptExpression(script);
    this._executor = createRuntimeExecutor([this.config.blackboard, this.config.enums], script);
  }
}
