import { StatefulActionNode, SyncActionNode } from "../ActionNode.js";
import { NodeConfig } from "../TreeNode.js";
import { ImplementPorts, NodeStatus, PortList, type NodeUserStatus } from "../basic.js";

export class SyncActionTest extends SyncActionNode {
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

@ImplementPorts
export class AsyncActionTest extends StatefulActionNode {
  static providedPorts() {
    return new PortList();
  }

  constructor(
    name: string,
    config: NodeConfig,
    private _deadlineMs = 0
  ) {
    super(name, config);
  }

  private _expectedResult = NodeStatus.SUCCESS;

  setExpectedResult(res: NodeUserStatus) {
    this._expectedResult = res;
  }

  private _initialTime = 0;

  private _timer: ReturnType<typeof setTimeout> | undefined;

  override onStart(): NodeUserStatus {
    this._initialTime = Date.now();
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this.setStatus(this._expectedResult as NodeUserStatus);
      this._timer = undefined;
      this._tickCount++;
    }, this._deadlineMs);
    return NodeStatus.RUNNING;
  }

  override onRunning(): NodeUserStatus {
    if (!this.isHaltRequested() && Date.now() < this._initialTime + this._deadlineMs) {
      return NodeStatus.RUNNING;
    }
    clearTimeout(this._timer);
    this._tickCount++;
    switch (this._expectedResult) {
      case NodeStatus.SUCCESS: {
        this.successCount++;
        break;
      }
      case NodeStatus.FAILURE: {
        this.failureCount++;
        break;
      }
    }
    return this._expectedResult as NodeUserStatus;
  }

  override onHalted(): void {
    clearTimeout(this._timer);
  }

  private _tickCount = 0;

  tickCount() {
    return this._tickCount;
  }

  resetTickCount() {
    this._tickCount = 0;
  }

  successCount = 0;
  failureCount = 0;

  setTime(ms: number) {
    this._deadlineMs = ms;
  }
}
