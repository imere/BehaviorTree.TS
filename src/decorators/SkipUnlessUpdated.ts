import { DecoratorNode } from "../DecoratorNode";
import { NodeConfig, TreeNode } from "../TreeNode";
import { NodeStatus, NodeUserStatus, PortList, createInputPort } from "../basic";

/**
 * @brief The SkipUnlessUpdated checks the Timestamp in an entry
 * to determine if the value was updated since the last time (true,
 * the first time).
 *
 * If it is, the child will be executed, otherwise SKIPPED is returned.
 */
export class SkipUnlessUpdated extends DecoratorNode {
  static providedPorts(): PortList {
    return new PortList([
      createInputPort("entry", "Skip this branch unless the blackboard value was updated"),
    ]);
  }

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "SkipUnlessUpdated";

    const entryStr = config.input.get("entry");
    const strippedKey = TreeNode.stripBlackboardPointer(entryStr);
    if (strippedKey !== undefined) {
      this.entryKey = strippedKey;
    } else {
      this.entryKey = entryStr;
    }
  }

  private sequence_id = -1;

  private entryKey: string | undefined;

  private stillExecutingChild = false;

  protected override tick(): NodeUserStatus {
    // continue executing an asynchronous child
    if (this.stillExecutingChild) {
      const status = this.child!.executeTick();
      this.stillExecutingChild = status === NodeStatus.RUNNING;
      return status as NodeUserStatus;
    }

    const entry = this.config.blackboard.getEntry(this.entryKey!)!;
    if (entry.sequence_id === this.sequence_id) return NodeStatus.SKIPPED;
    this.sequence_id = entry.sequence_id;

    const status = this.child!.executeTick();
    this.stillExecutingChild = status === NodeStatus.RUNNING;
    return status as NodeUserStatus;
  }

  override halt(): void {
    this.stillExecutingChild = false;
  }
}
