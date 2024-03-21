import { LeafNode } from "./LeafNode";
import type { NodeConfig } from "./TreeNode";
import { NodeStatus, NodeType, type NodeUserStatus } from "./basic";

/**
 * @brief The ActionNodeBase is the base class to use to create any kind of action.
 * A particular derived class is free to override executeTick() as needed.
 *
 */
export abstract class ActionNodeBase extends LeafNode {
  override type: NodeType = NodeType.Action;

  constructor(
    name: string,
    override readonly config: NodeConfig
  ) {
    super(name, config);
  }
}

/**
 * @brief The SyncActionNode is an ActionNode that
 * explicitly prevents the status RUNNING and doesn't require
 * an implementation of halt().
 */
export abstract class SyncActionNode extends ActionNodeBase {
  override executeTick(): Exclude<NodeStatus, NodeStatus.RUNNING> {
    const status = super.executeTick();
    if (status === NodeStatus.RUNNING) {
      throw new Error(`${SyncActionNode.name} MUST never return RUNNING`);
    }
    return status;
  }

  override halt() {
    this.resetStatus();
  }
}

/**
 * @brief The SimpleActionNode provides an easy to use SyncActionNode.
 * The user should simply provide a callback with this signature
 *
 *    BT::NodeStatus functionName(TreeNode&)
 *
 * This avoids the hassle of inheriting from a ActionNode.
 *
 * Using lambdas or std::bind it is easy to pass a pointer to a method.
 * SimpleActionNode is executed synchronously and does not support halting.
 * NodeParameters aren't supported.
 */
export class SimpleActionNode extends SyncActionNode {
  constructor(
    name: string,
    config: NodeConfig,
    protected functor: <T extends SimpleActionNode = SimpleActionNode>(node: T) => NodeUserStatus
  ) {
    super(name, config);
  }

  protected override tick(): NodeUserStatus {
    let oldStatus = this.status;

    if (oldStatus === NodeStatus.IDLE) {
      this.setStatus((oldStatus = NodeStatus.RUNNING));
    }

    const status = this.functor(this);

    if (status !== oldStatus) this.setStatus(status);

    return status;
  }
}

/**
 * @brief The StatefulActionNode is the preferred way to implement asynchronous Actions.
 * It is actually easier to use correctly, when compared with ThreadedAction
 *
 * It is particularly useful when your code contains a request-reply pattern,
 * i.e. when the actions sends an asynchronous request, then checks periodically
 * if the reply has been received and, eventually, analyze the reply to determine
 * if the result is SUCCESS or FAILURE.
 *
 * -) an action that was in IDLE state will call onStart()
 *
 * -) A RUNNING action will call onRunning()
 *
 * -) if halted, method onHalted() is invoked
 */
export abstract class StatefulActionNode extends ActionNodeBase {
  abstract onStart(): NodeUserStatus;

  abstract onRunning(): NodeUserStatus;

  abstract onHalted(): void;

  private _haltRequested = false;

  isHaltRequested(): boolean {
    return this._haltRequested;
  }

  protected override tick(): NodeUserStatus {
    const oldStatus = this.status;

    if (oldStatus === NodeStatus.IDLE) {
      return this.onStart();
    } else if (oldStatus === NodeStatus.RUNNING) {
      return this.onRunning();
    }
    return oldStatus;
  }

  protected override halt(): void {
    this._haltRequested = true;
    if (this.status === NodeStatus.RUNNING) this.onHalted();
  }
}

export class SimpleAsyncActionNode extends StatefulActionNode {
  constructor(
    name: string,
    config: NodeConfig,
    protected functor: <T extends SimpleAsyncActionNode = SimpleAsyncActionNode>(
      node: T
    ) => Promise<NodeUserStatus>
  ) {
    super(name, config);
  }

  private error = "";

  private waiting = false;

  private halted = false;

  override onStart(): NodeUserStatus {
    this.halted = false;
    this.waiting = true;
    this.functor(this)
      .catch((ex) => {
        this.error = ex?.message || JSON.stringify(ex);
      })
      .finally(() => (this.waiting = false));
    return NodeStatus.RUNNING;
  }

  override onRunning(): NodeUserStatus {
    if (this.error) throw new Error(`SimpleAsyncAction: ${this.error}`);
    if (this.halted) return NodeStatus.FAILURE;
    if (this.waiting) return NodeStatus.RUNNING;
    return NodeStatus.SUCCESS;
  }

  override onHalted(): void {
    this.halted = true;
  }
}

/**
 * @deprecated
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
abstract class ThreadedAction extends ActionNodeBase {
  private _haltRequested = false;

  isHaltRequested() {
    return this._haltRequested;
  }

  private ex: Error | undefined;

  private handle: any;

  override executeTick(): NodeStatus {
    if (this.status === NodeStatus.IDLE) {
      this.setStatus(NodeStatus.RUNNING);
      this._haltRequested = false;
      this.handle = setTimeout(() => {
        try {
          const status = this.tick();
          if (!this.isHaltRequested()) this.setStatus(status);
        } catch (cause) {
          this.ex = new Error(
            `Uncaught exception from tick(): [${this.registrationId}/${this.name}]`,
            { cause }
          );
          this.resetStatus();
        }
        this.emitWakeUpSignal();
      }, 0);
    }

    if (this.ex) {
      const { ex } = this;
      this.ex = undefined;
      throw ex;
    }

    return this.status;
  }

  protected override halt(): void {
    this._haltRequested = true;
    clearTimeout(this.handle);
    this.handle = undefined;
    this.resetStatus();
  }
}
