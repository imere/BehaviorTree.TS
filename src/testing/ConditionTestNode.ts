import { NodeStatus, type NodeUserStatus } from "../basic";
import { ConditionNode } from "../ConditionNode";
import { NodeConfig } from "../TreeNode";

export class ConditionTestNode extends ConditionNode {
  constructor(name: string, config = new NodeConfig()) {
    super(name, config);
  }

  private expectedResult = NodeStatus.SUCCESS;

  setExpectedResult(res: NodeStatus) {
    this.expectedResult = res;
  }

  private _tickCount = 0;

  protected override tick(): NodeUserStatus {
    this._tickCount++;
    return this.expectedResult as NodeUserStatus;
  }

  tickCount() {
    return this._tickCount;
  }

  resetTickCount() {
    this._tickCount = 0;
  }
}
