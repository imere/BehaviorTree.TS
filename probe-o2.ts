import { NodeStatus, PortList } from "./src/basic.js";
import { ConditionNode } from "./src/ConditionNode.js";
import { StatefulActionNode } from "./src/ActionNode.js";
import { NodeConfig } from "./src/TreeNode.js";
import { TreeFactory } from "./src/TreeFactory.js";
import { TreeObserver } from "./src/TreeObserver.js";

class SimpleCondition extends ConditionNode {
  static providedPorts(): PortList {
    return new PortList();
  }
  constructor(
    name: string,
    config: NodeConfig,
    private portName: string
  ) {
    super(name, config);
  }
  protected override tick() {
    return this.getInput<boolean>(this.portName) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}
class AsyncTestAction extends StatefulActionNode {
  static providedPorts(): PortList {
    return new PortList();
  }
  protected override onStart() {
    return NodeStatus.RUNNING;
  }
  protected override onRunning() {
    this.config.blackboard.set("is_warm", true);
    return NodeStatus.SUCCESS;
  }
}

const factory = new TreeFactory();
factory.registerNodeType(SimpleCondition, "IsWarm", "is_warm");
factory.registerNodeType(SimpleCondition, "IsHoldingJacket", "holding_jacket");
factory.registerNodeType(AsyncTestAction, "WearJacket", "is_warm");
const tree = factory.createTreeFromXML(`
  <root BTTS_format="4">
    <BehaviorTree ID="EnsureWarm">
      <ReactiveFallback>
        <IsWarm name="warm"/>
        <ReactiveSequence>
          <IsHoldingJacket name="jacket" />
          <WearJacket name="wear" />
        </ReactiveSequence>
      </ReactiveFallback>
    </BehaviorTree>
  </root>`);
const obs = new TreeObserver(tree);
console.log("paths:", [...obs.pathsToUid().keys()]);
