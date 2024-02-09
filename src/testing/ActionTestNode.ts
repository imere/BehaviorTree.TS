import { StatefulActionNode, SyncActionNode } from "../ActionNode";
import { NodeConfig } from "../TreeNode";
import { ImplementPorts, NodeStatus, PortList, type NodeUserStatus } from "../basic";

export class SyncActionTest extends SyncActionNode {
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

@ImplementPorts
export class AsyncActionTest extends StatefulActionNode {
  static providedPorts() {
    return new PortList();
  }

  constructor(name: string, config: NodeConfig, private deadlineMs = 0) {
    super(name, config);
  }

  private expectedResult = NodeStatus.SUCCESS;

  setExpectedResult(res: NodeUserStatus) {
    this.expectedResult = res;
  }

  private initialTime = 0;

  private timer: any;

  override onStart(): NodeUserStatus {
    this.initialTime = Date.now();
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      this.setStatus(this.expectedResult as NodeUserStatus);
      this.timer = undefined;
      this._tickCount++;
    }, this.deadlineMs);
    return NodeStatus.RUNNING;
  }

  override onRunning(): NodeUserStatus {
    if (!this.isHaltRequested() && Date.now() < this.initialTime + this.deadlineMs) {
      return NodeStatus.RUNNING;
    }
    clearTimeout(this.timer);
    this._tickCount++;
    switch (this.expectedResult) {
      case NodeStatus.SUCCESS: {
        this.successCount++;
        break;
      }
      case NodeStatus.FAILURE: {
        this.failureCount++;
        break;
      }
    }
    return this.expectedResult as NodeUserStatus;
  }

  override onHalted(): void {
    clearTimeout(this.timer);
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
    this.deadlineMs = ms;
  }
}

// @ImplementPorts
// export class AsyncActionTest extends ThreadedAction {
//   static providedPorts() {
//     return new PortList();
//   }

//   constructor(name: string, config: NodeConfig, private deadlineMs = 0) {
//     super(name, config);
//   }

//   private expectedResult: NodeUserStatus = NodeStatus.SUCCESS;

//   setExpectedResult(res: NodeUserStatus) {
//     this.expectedResult = res;
//   }

//   private initialTime = 0;
//   private timer: any;

//   protected override tick(): NodeUserStatus {
//     if (!this.timer) {
//       this.initialTime = Date.now();
//       this.timer = setTimeout(async () => {
//         if (!this.isHaltRequested()) this.setStatus(this.expectedResult as NodeUserStatus);
//         this._tickCount++;
//         this.timer = undefined;
//       }, this.deadlineMs);
//     }

//     if (!this.isHaltRequested() && Date.now() < this.initialTime + this.deadlineMs) {
//       return NodeStatus.RUNNING;
//     }

//     clearTimeout(this.timer);
//     this.timer = undefined;

//     // check if we exited the while() loop because of the flag stop_loop_
//     if (this.isHaltRequested()) return NodeStatus.IDLE as NodeUserStatus;

//     if (this.expectedResult === NodeStatus.SUCCESS) this.successCount++;
//     else if (this.expectedResult === NodeStatus.FAILURE) this.failureCount++;

//     return this.expectedResult;
//   }

//   protected override halt(): void {
//     clearTimeout(this.timer);
//     this.timer = undefined;
//     super.halt();
//   }

//   private _tickCount = 0;

//   tickCount() {
//     return this._tickCount;
//   }

//   resetTickCount() {
//     this._tickCount = 0;
//   }

//   successCount = 0;
//   failureCount = 0;

//   setTime(ms: number) {
//     this.deadlineMs = ms;
//   }
// }
