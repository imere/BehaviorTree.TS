import { SyncActionNode } from "../ActionNode.js";
import { NodeConfig, TreeNode } from "../TreeNode.js";
import { NodeStatus, PortList, createInputPort, type NodeUserStatus } from "../basic.js";

/**
 * @brief The EntryUpdatedAction checks the Timestamp in an entry
 * to determine if the value was updated since the last time.
 *
 * SUCCESS if it was updated, since the last time it was checked,
 * FAILURE if it doesn't exist or was not updated.
 */
export class EntryUpdatedAction extends SyncActionNode {
  private sequenceId = 0;

  private readonly entryKey: string;

  constructor(name: string, config: NodeConfig) {
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
    const entry = this.config.blackboard.getEntry(this.entryKey);
    if (!entry) {
      return NodeStatus.FAILURE;
    }

    const currentId = entry.sequence_id;
    const previousId = this.sequenceId;
    this.sequenceId = currentId;

    return previousId !== currentId ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}
