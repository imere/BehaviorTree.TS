import { StatefulActionNode } from "./ActionNode.js";
import { NodeStatus, PortList, type NodeUserStatus } from "./basic.js";
import { TreeFactory } from "./TreeFactory.js";

let starts = 0;

class RunForever extends StatefulActionNode {
  override onStart(): NodeUserStatus {
    starts++;
    return NodeStatus.RUNNING;
  }

  override onRunning(): NodeUserStatus {
    return NodeStatus.RUNNING;
  }

  override onHalted(): void {}
}

describe("BehaviorTree.CPPIssue686_HaltWhileRunning", () => {
  test("haltTree stops tickWhileRunning instead of restarting the tree", async () => {
    starts = 0;

    const factory = new TreeFactory();
    factory.registerNodeType(RunForever, "RunForever", new PortList());

    const xml = `
      <root BTTS_format="4">
        <BehaviorTree ID="MainTree">
          <RunForever/>
        </BehaviorTree>
      </root>
    `;
    const tree = factory.createTreeFromXML(xml);

    const result = tree.tickWhileRunning(10_000);

    while (starts === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    tree.haltTree();

    // haltTree must also interrupt the 10 second sleep
    const settled = await Promise.race([
      result.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
    ]);
    expect(settled).toBe(true);
    expect(await result).toBe(NodeStatus.IDLE);
    expect(starts).toBe(1);
  });
});
