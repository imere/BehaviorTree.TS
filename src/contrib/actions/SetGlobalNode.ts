import { SyncActionNode } from "../../ActionNode";
import type { NodeConfig } from "../../TreeNode";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createBidiPort,
  createInputPort,
  type NodeUserStatus,
} from "../../basic";
import { parseScript, type ScriptFunction } from "../../scripting/parser";

@ImplementPorts
export class SetGlobalNode extends SyncActionNode {
  static providedPorts(): PortList {
    return new PortList([createInputPort("code"), createBidiPort("output")]);
  }

  private _script = "";

  private _executor: ScriptFunction | undefined;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "SetGlobal";
  }

  protected override tick(): NodeUserStatus {
    this.loadExecutor();

    const value = this.getInput("output");
    if (value === undefined) {
      const ret = this._executor!([this.config.blackboard, this.config.enums]);
      this.setOutput("output", ret);
    }

    return NodeStatus.SUCCESS;
  }

  private loadExecutor(): void {
    const script = this.getInput("code") || "";
    if (script === this._script) return;
    this._script = script;
    this._executor = parseScript(script);
  }
}
