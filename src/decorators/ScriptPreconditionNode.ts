import { DecoratorNode } from "../DecoratorNode.js";
import type { NodeConfig } from "../TreeNode.js";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  isStatusCompleted,
  type NodeUserStatus,
} from "../basic.js";
import { createRuntimeExecutor, supportScriptExpression } from "../scripting/parser.js";

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

  private _childrenRunning = false;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
  }

  protected override tick(): NodeUserStatus {
    this.loadExecutor();

    const elseReturn = this.getInputOrThrow("else");

    const tickChildren = this._childrenRunning || (this._childrenRunning = !!this._executor!());

    if (!tickChildren) {
      return NodeStatus[elseReturn];
    }

    const childStatus = this.child!.executeTick();
    if (isStatusCompleted(childStatus)) {
      this.resetChild();
      this._childrenRunning = false;
    }
    return childStatus as NodeUserStatus;
  }

  private loadExecutor(): void {
    let script = this.getInputOrThrow("if");
    if (script === this._script) return;
    this._script = script;
    script = supportScriptExpression(script);
    this._executor = createRuntimeExecutor([this.config.blackboard, this.config.enums], script);
  }
}
