import { SyncActionNode } from "../ActionNode";
import { type NodeConfig } from "../TreeNode";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  type NodeUserStatus,
} from "../basic";
import { createRuntimeExecutor } from "../scripting/parser";

@ImplementPorts
export class ScriptNode extends SyncActionNode {
  private _script = "";

  protected _executor: (() => unknown) | undefined;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "ScriptNode";
  }

  static providedPorts(): PortList {
    return new PortList([createInputPort("code", "Piece of code that can be parsed")]);
  }

  protected override tick(): NodeUserStatus {
    this.loadExecutor();
    if (this._executor) {
      this._executor();
    }
    return NodeStatus.SUCCESS;
  }

  protected loadExecutor(): void {
    const script = this.getInputOrThrow("code");
    if (script === this._script) return;
    this._script = script;
    this._executor = createRuntimeExecutor([this.config.blackboard, this.config.enums], script);
  }
}
