import { ConditionNode } from "../ConditionNode.js";
import { createRuntimeExecutor, supportScriptExpression } from "../scripting/parser.js";
import { NodeStatus, PortList, createInputPort, type NodeUserStatus } from "../basic.js";
import { NodeConfig } from "../TreeNode.js";

/** Runs a script and maps a truthy result to SUCCESS, otherwise FAILURE. */
export class ScriptConditionNode extends ConditionNode {
  private script = "";

  private executor?: () => unknown;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "ScriptCondition";
    this.loadExecutor();
  }

  static providedPorts(): PortList {
    return new PortList([createInputPort("code", "Piece of code that must return false or true")]);
  }

  protected override tick(): NodeUserStatus {
    this.loadExecutor();

    return this.executor!() ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }

  private loadExecutor(): void {
    const script = this.getInputOrThrow("code");
    if (script === this.script) return;

    this.script = script;
    this.executor = createRuntimeExecutor(
      [this.config.blackboard, this.config.enums],
      supportScriptExpression(script)
    );
  }
}
