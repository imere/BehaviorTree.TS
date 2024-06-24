import { SyncActionNode } from "./ActionNode";
import { TreeFactory } from "./TreeFactory";
import { NodeStatus, PortList, type NodeUserStatus } from "./basic";

class FastAction extends SyncActionNode {
  protected override tick(): NodeUserStatus {
    return NodeStatus.SUCCESS;
  }
}

describe("WakeUp", () => {
  test("BasicTest", async () => {
    const xml = `
<root BTTS_format="4">
  <BehaviorTree ID="MainTree">
      <FastAction/>
  </BehaviorTree>
</root>
`;

    const factory = new TreeFactory();
    factory.registerNodeType(FastAction, "FastAction", new PortList());
    factory.registerTreeFromXML(xml);

    const tree = factory.createTree("MainTree");

    const t1 = Date.now();
    await tree.tickOnce();
    await tree.sleep(200);
    const t2 = Date.now();

    const dt = t2 - t1;
    expect(dt).toBeGreaterThanOrEqual(200);
  });
});
