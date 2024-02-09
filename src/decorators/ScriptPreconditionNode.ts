import { DecoratorNode } from "../DecoratorNode";
import type { NodeConfig } from "../TreeNode";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  isStatusCompleted,
  type NodeUserStatus,
} from "../basic";
import { createRuntimeExecutor, supportScriptExpression } from "../scripting/parser";

@ImplementPorts
export class PreconditionNode extends DecoratorNode {
  static providedPorts(): PortList {
    return new PortList([
      createInputPort("if"),
      createInputPort(
        "else",
        "Return status if condition is false",
        NodeStatus[NodeStatus.FAILURE]
      ),
    ]);
  }

  private _script = "";

  private _executor?: () => unknown;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
  }

  protected override tick(): NodeUserStatus {
    this.loadExecutor();

    const elseReturn = this.getInputOrThrow("else");

    if (this._executor!()) {
      const childStatus = this.child!.executeTick();
      if (isStatusCompleted(childStatus)) this.resetChild();
      return childStatus as NodeUserStatus;
    } else {
      return NodeStatus[elseReturn];
    }
  }

  private loadExecutor(): void {
    let script = this.getInputOrThrow("if");
    if (script === this._script) return;
    this._script = script;
    script = supportScriptExpression(script);
    this._executor = createRuntimeExecutor([this.config.blackboard, this.config.enums], script);
  }
}
