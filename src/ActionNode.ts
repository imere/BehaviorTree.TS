import { LeafNode } from "./LeafNode.js";
import type { NodeConfig } from "./TreeNode.js";
import { NodeStatus, NodeType, type NodeUserStatus } from "./basic.js";

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
 * Runs work outside the tick path.
 *
 * The entry point supplies one: `microtaskExecutor` is the default the factory
 * passes, and it works on every target this library runs on. A backend that can
 * genuinely take the work off the tick path — a Node worker_thread, a Web
 * Worker, or WASM threads where the document is cross-origin isolated — is
 * installed on the factory instead.
 */
export type OffTickExecutor = (work: () => void) => void;

/** Hands the work to the event loop and returns immediately. */
export const microtaskExecutor: OffTickExecutor = (work) => {
  void Promise.resolve().then(work);
};

/**
 * @brief The ThreadedAction runs tick() outside the tick path, so a blocking
 * action cannot stall the rest of the tree.
 *
 * When the work finishes it sets the status and wakes the tree up. If the node
 * was halted in the meantime the result is discarded, and an exception thrown by
 * tick() is re-raised on the caller's next executeTick().
 */
export abstract class ThreadedAction extends ActionNodeBase {
  private _haltRequested = false;

  private _error: Error | undefined;

  constructor(
    name: string,
    config: NodeConfig,
    private readonly _executor: OffTickExecutor
  ) {
    super(name, config);
  }

  isHaltRequested(): boolean {
    return this._haltRequested;
  }

  override executeTick(): NodeStatus {
    // the status alone says whether work is outstanding: RUNNING while it is,
    // and IDLE again after a halt or a failure
    if (this.status === NodeStatus.IDLE) {
      this.setStatus(NodeStatus.RUNNING);
      this._haltRequested = false;
      this._executor(() => this.runOffTick());
    }

    if (this._error) {
      const { _error } = this;
      this._error = undefined;
      throw _error;
    }

    return this.status;
  }

  private runOffTick(): void {
    try {
      const status = this.tick();
      if (!this.isHaltRequested()) this.setStatus(status);
    } catch (cause) {
      this._error = new Error(
        `Uncaught exception from tick(): [${this.registrationId}/${this.name}]`,
        { cause }
      );
      this.resetStatus();
    }
    this.emitWakeUpSignal();
  }

  protected override halt(): void {
    this._haltRequested = true;
    this.resetStatus();
  }
}

/**
 * @brief The CoroActionNode is a good candidate for asynchronous actions which
 * need to talk to an external service with an async request/reply interface.
 *
 * The body is a generator: each `yield` returns RUNNING and pauses the action
 * until the next executeTick(). That is the counterpart of the
 * setStatusRunningAndYield() of the C++ version, which a JavaScript method
 * cannot do because only a generator may yield.
 *
 * The pre- and post-conditions are checked once, around the whole coroutine,
 * as upstream does by running them inside it.
 */
export abstract class CoroActionNode extends ActionNodeBase {
  private _coroutine: Generator<void, NodeUserStatus, undefined> | undefined;

  protected abstract action(): Generator<void, NodeUserStatus, undefined>;

  /**
   * Unreachable: executeTick() drives the coroutine in action() directly, so
   * the base class' routing through tick() never happens.
   */
  protected override tick(): NodeUserStatus {
    throw new Error(`${this.name}: a CoroActionNode is driven by action(), not tick()`);
  }

  override executeTick(): NodeStatus {
    if (!this._coroutine) {
      const preCondition = this.checkPreConditions();
      if (preCondition !== undefined) {
        this.setStatus(preCondition);
        return this.status;
      }
      this._coroutine = this.action();
    }

    const step = this._coroutine.next();

    if (step.done) {
      this._coroutine = undefined;
      this.setStatus(step.value);
      this.checkPostConditions(step.value);
    } else {
      this.setStatus(NodeStatus.RUNNING);
    }

    return this.status;
  }

  protected override halt(): void {
    this._coroutine = undefined;
    this.resetStatus();
  }
}
