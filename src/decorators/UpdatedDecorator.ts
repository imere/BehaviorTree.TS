import { DecoratorNode } from "../DecoratorNode.js";
import { NodeConfig, TreeNode } from "../TreeNode.js";
import { NodeStatus, PortList, createInputPort, type NodeUserStatus } from "../basic.js";

/**
 * @brief The EntryUpdatedDecorator checks the Timestamp in an entry
 * to determine if the value was updated since the last time (true,
 * the first time).
 *
 * If it is, the child will be executed, otherwise [if_not_updated] value is
 * returned. A missing entry counts as not updated.
 */
export class EntryUpdatedDecorator extends DecoratorNode {
  private sequenceId = 0;

  private readonly entryKey: string;

  private stillExecutingChild = false;

  constructor(
    name: string,
    config: NodeConfig,
    private readonly ifNotUpdated: NodeUserStatus
  ) {
    super(name, config);

    const entryStr = config.input.get("entry");
    if (entryStr === undefined || entryStr === "") {
      throw new Error(`Missing port 'entry' in ${name}`);
    }
    // the port may be written as "{key}" or as a bare key
    this.entryKey = TreeNode.stripBlackboardPointer(entryStr) ?? entryStr;
  }

  static providedPorts(): PortList {
    return new PortList([createInputPort("entry", "Entry to check")]);
  }

  protected override tick(): NodeUserStatus {
    // continue executing an asynchronous child
    if (this.stillExecutingChild) {
      const status = this.child!.executeTick();
      this.stillExecutingChild = status === NodeStatus.RUNNING;
      return status as NodeUserStatus;
    }

    const entry = this.config.blackboard.getEntry(this.entryKey);
    if (!entry) return this.ifNotUpdated;

    const currentId = entry.sequence_id;
    const previousId = this.sequenceId;
    this.sequenceId = currentId;

    if (previousId === currentId) return this.ifNotUpdated;

    const status = this.child!.executeTick();
    this.stillExecutingChild = status === NodeStatus.RUNNING;
    return status as NodeUserStatus;
  }

  override halt(): void {
    this.stillExecutingChild = false;
    super.halt();
  }
}

/**
 * The SkipUnlessUpdated checks the Timestamp in an entry
 * to determine if the value was updated since the last time (true,
 * the first time).
 *
 * If it is, the child will be executed, otherwise SKIPPED is returned.
 */
export class SkipUnlessUpdated extends EntryUpdatedDecorator {
  constructor(name: string, config: NodeConfig) {
    super(name, config, NodeStatus.SKIPPED);
    this.registrationId = "SkipUnlessUpdated";
  }
}

/**
 * The WaitValueUpdate checks the Timestamp in an entry
 * to determine if the value was updated since the last time (true,
 * the first time).
 *
 * If it is, the child will be executed, otherwise RUNNING is returned.
 */
export class WaitValueUpdate extends EntryUpdatedDecorator {
  constructor(name: string, config: NodeConfig) {
    super(name, config, NodeStatus.RUNNING);
    this.registrationId = "WaitValueUpdate";
  }
}
