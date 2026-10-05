import { NodeStatus, type NodeUserStatus } from "../basic.js";
import { ConditionNode } from "../ConditionNode.js";
import { NodeConfig } from "../TreeNode.js";

export class ConditionTestNode extends ConditionNode {
  constructor(name: string, config = new NodeConfig()) {
    super(name, config);
  }

  private _expectedResult = NodeStatus.SUCCESS;

  setExpectedResult(res: NodeStatus) {
    this._expectedResult = res;
  }

  private _tickCount = 0;

  protected override tick(): NodeUserStatus {
    this._tickCount++;
    return this._expectedResult as NodeUserStatus;
  }

  tickCount() {
    return this._tickCount;
  }

  resetTickCount() {
    this._tickCount = 0;
  }
}
