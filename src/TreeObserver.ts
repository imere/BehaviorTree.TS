import { ControlNode } from "./ControlNode.js";
import { DecoratorNode } from "./DecoratorNode.js";
import { NodeStatus, NodeType } from "./basic.js";
import { applyRecursiveVisitor } from "./Tree.js";
import type { Tree } from "./TreeFactory.js";
import type { TreeNode } from "./TreeNode.js";
import { now } from "./utils/date-time.js";

/** Milliseconds, either since the subscription or since the epoch. */
export type Duration = number;

export enum TimestampType {
  absolute,
  relative,
}

/**
 * Subscribes to the status change of every node of a tree, so that a derived
 * logger can be handed each transition as it happens.
 */
export abstract class StatusChangeLogger {
  private _isEnabled = true;

  private _type = TimestampType.absolute;

  private _showTransitionToIdle = true;

  private _firstTimestamp = 0;

  private _unsubscribers: (() => void)[] = [];

  protected constructor(rootNode?: TreeNode) {
    if (rootNode) this.subscribeToTreeChanges(rootNode);
  }

  subscribeToTreeChanges(rootNode: TreeNode): void {
    this._firstTimestamp = now();

    applyRecursiveVisitor(rootNode, (node) => {
      this._unsubscribers.push(
        node.on("status-change", (status, prevStatus) => {
          this.handleStatusChange(node, prevStatus, status);
        })
      );
    });
  }

  /** Stop receiving callbacks and drop the subscriptions. */
  unsubscribeFromTreeChanges(): void {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this._unsubscribers = [];
  }

  setEnabled(enabled: boolean): void {
    this._isEnabled = enabled;
  }

  setTimestampType(type: TimestampType): void {
    this._type = type;
  }

  enabled(): boolean {
    return this._isEnabled;
  }

  showsTransitionToIdle(): boolean {
    return this._showTransitionToIdle;
  }

  enableTransitionToIdle(enable: boolean): void {
    this._showTransitionToIdle = enable;
  }

  protected abstract callback(
    timestamp: Duration,
    node: TreeNode,
    prevStatus: NodeStatus,
    status: NodeStatus
  ): void;

  abstract flush(): void;

  private handleStatusChange(node: TreeNode, prev: NodeStatus, status: NodeStatus): void {
    if (!this._isEnabled) return;
    if (status === NodeStatus.IDLE && !this._showTransitionToIdle) return;

    const timestamp = this._type === TimestampType.absolute ? now() : now() - this._firstTimestamp;
    this.callback(timestamp, node, prev, status);
  }
}

export interface NodeStatistics {
  /** Last __valid__ result, either SUCCESS or FAILURE. */
  lastResult: NodeStatus;
  /** Last status. Can be any status, including IDLE or SKIPPED. */
  currentStatus: NodeStatus;
  /** Count status transitions, excluding transitions to IDLE. */
  transitionsCount: number;
  /** Count the transitions to SUCCESS. */
  successCount: number;
  /** Count the transitions to FAILURE. */
  failureCount: number;
  /** Count the transitions to SKIPPED. */
  skipCount: number;
  lastTimestamp: Duration;
}

/**
 * Counts how often each node of a tree succeeded, failed and was skipped.
 *
 * Statistics are keyed by the node path, so `getStatistics("door_open")` finds
 * the node whose [name] attribute is `door_open`.
 */
export class TreeObserver extends StatusChangeLogger {
  private _statisticsByUid = new Map<number, NodeStatistics>();

  private _pathToUid = new Map<string, number>();

  private _uidToPath = new Map<number, string>();

  constructor(tree: Tree) {
    const recursiveStep = (node: TreeNode): void => {
      if (node instanceof ControlNode) {
        for (const child of node.children) recursiveStep(child);
      } else if (node instanceof DecoratorNode) {
        if (node.type !== NodeType.SubTree) recursiveStep(node.child!);
      }

      if (this._pathToUid.has(node.fullPath)) {
        throw new Error("TreeObserver not built correctly. Report issue");
      }
      this._pathToUid.set(node.fullPath, node.uid);
    };

    super(tree.rootNode);

    for (const subtree of tree.subtrees) recursiveStep(subtree.nodes[0]);

    for (const [path, uid] of this._pathToUid) {
      this._statisticsByUid.set(uid, {
        lastResult: NodeStatus.IDLE,
        currentStatus: NodeStatus.IDLE,
        transitionsCount: 0,
        successCount: 0,
        failureCount: 0,
        skipCount: 0,
        lastTimestamp: 0,
      });
      this._uidToPath.set(uid, path);
    }
  }

  override flush(): void {}

  resetStatistics(): void {
    for (const statistics of this._statisticsByUid.values()) {
      statistics.lastResult = NodeStatus.IDLE;
      statistics.currentStatus = NodeStatus.IDLE;
      statistics.transitionsCount = 0;
      statistics.successCount = 0;
      statistics.failureCount = 0;
      statistics.skipCount = 0;
      statistics.lastTimestamp = 0;
    }
  }

  /** The statistics of the node at `path`, i.e. its [name] or its ID. */
  getStatisticsByPath(path: string): NodeStatistics {
    const uid = this._pathToUid.get(path);
    if (uid === undefined) {
      throw new Error("TreeObserver.getStatistics: Invalid pattern");
    }
    return this.getStatistics(uid);
  }

  getStatistics(uid: number): NodeStatistics {
    const statistics = this._statisticsByUid.get(uid);
    if (statistics === undefined) {
      throw new Error("TreeObserver.getStatistics: Invalid UID");
    }
    return statistics;
  }

  statistics(): ReadonlyMap<number, NodeStatistics> {
    return this._statisticsByUid;
  }

  pathsToUid(): ReadonlyMap<string, number> {
    return this._pathToUid;
  }

  uidToPath(): ReadonlyMap<number, string> {
    return this._uidToPath;
  }

  protected override callback(
    timestamp: Duration,
    node: TreeNode,
    _prevStatus: NodeStatus,
    status: NodeStatus
  ): void {
    let statistics = this._statisticsByUid.get(node.uid);
    if (!statistics) {
      // upstream indexes _statistics[uid], which creates a default entry
      statistics = {
        lastResult: NodeStatus.IDLE,
        currentStatus: NodeStatus.IDLE,
        transitionsCount: 0,
        successCount: 0,
        failureCount: 0,
        skipCount: 0,
        lastTimestamp: 0,
      };
      this._statisticsByUid.set(node.uid, statistics);
    }

    statistics.currentStatus = status;
    statistics.lastTimestamp = timestamp;

    if (status === NodeStatus.IDLE) return;

    statistics.transitionsCount++;

    if (status === NodeStatus.SUCCESS) {
      statistics.lastResult = status;
      statistics.successCount++;
    } else if (status === NodeStatus.FAILURE) {
      statistics.lastResult = status;
      statistics.failureCount++;
    } else if (status === NodeStatus.SKIPPED) {
      statistics.skipCount++;
    }
  }
}
