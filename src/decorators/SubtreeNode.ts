import { DecoratorNode } from "../DecoratorNode";
import { type NodeConfig } from "../TreeNode";
import {
  NodeStatus,
  NodeType,
  PortDirection,
  PortList,
  createPortInfo,
  isStatusCompleted,
  type NodeUserStatus,
} from "../basic";

/**
 * @brief The SubTreeNode is a way to wrap an entire Subtree,
 * creating a separated BlackBoard.
 * If you want to have data flow through ports, you need to explicitly
 * remap the ports.
 *
 * NOTE: _autoremap will exclude all the ports which name start with underscore `_`
 *
 * Consider this example:
```xml
<root main_tree_to_execute = "MainTree" >
    <BehaviorTree ID="MainTree">
        <Sequence>
        <Script code="myParam='Hello'" />
        <SubTree ID="Talk" param="{myParam}" />
        <SubTree ID="Talk" param="World" />
        <Script code="param='Auto remapped'" />
        <SubTree ID="Talk" _autoremap="1"  />
        </Sequence>
    </BehaviorTree>
    <BehaviorTree ID="Talk">
        <SaySomething message="{param}" />
    </BehaviorTree>
</root>
```
 * You may notice three different approaches to remapping:
 *
 * 1) Subtree: "{param}"  -> Parent: "{myParam}" -> Value: "Hello"
 *    Classical remapping from one port to another, but you need to use the syntax
 *    {myParam} to say that you are remapping the another port.
 *
 * 2) Subtree: "{param}" -> Value: "World"
 *    syntax without {}, in this case param directly point to the __string__ "World".
 *
 * 3) Subtree: "{param}" -> Parent: "{parent}"
 *    Setting to true (or 1) the attribute "_autoremap", we are automatically remapping
 *    each port. Useful to avoid boilerplate.
 */
export class SubtreeNode extends DecoratorNode {
  override type: NodeType = NodeType.Subtree;

  constructor(name: string, config: NodeConfig) {
    super(name, config);
    this.registrationId = "Subtree";
  }

  static providedPorts(): PortList {
    return new PortList([
      [
        "_autoremap",
        createPortInfo(
          PortDirection.INPUT,
          "If true, all the ports with the same name will be remapped",
          false
        ),
      ],
    ]);
  }

  private id = "";

  get subtreeId(): string {
    return this.id;
  }

  setSubtreeId(id: string) {
    this.id = id;
  }

  protected override tick(): NodeUserStatus {
    const oldStatus = this.status;
    if (oldStatus === NodeStatus.IDLE) this.setStatus(NodeStatus.RUNNING);

    const childStatus = this.child!.executeTick();

    if (isStatusCompleted(childStatus)) this.resetChild();

    return childStatus as NodeUserStatus;
  }
}
