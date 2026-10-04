import { SyncActionNode } from "../ActionNode.js";
import { AlwaysFailureNode } from "../actions/AlwaysFailureNode.js";
import { TreeFactory } from "../TreeFactory.js";
import { NodeStatus, PortList, type NodeUserStatus } from "../basic.js";

function build(inner: string) {
  const factory = new TreeFactory();
  const xml = `
    <root BTTS_format="4" mainTreeToExecute="MainTree">
      <BehaviorTree ID="MainTree">
        ${inner}
      </BehaviorTree>
    </root>
  `;
  return factory.createTreeFromXML(xml);
}

describe("ScriptCondition", () => {
  test("a truthy script yields SUCCESS", async () => {
    const tree = build(`<ScriptCondition code="1 == 1"/>`);
    expect(await tree.tickExactlyOnce()).toBe(NodeStatus.SUCCESS);
  });

  test("a falsy script yields FAILURE", async () => {
    const tree = build(`<ScriptCondition code="1 == 2"/>`);
    expect(await tree.tickExactlyOnce()).toBe(NodeStatus.FAILURE);
  });

  // TODO: {answer} in a ScriptCondition does not resolve to the blackboard
  // value. Runtime's context proxy is a bare Reflect.get, so blackboard
  // pointers are only substituted where a port has been remapped, not inside
  // arbitrary script text. This needs the script/blackboard rework.
  test.skip("the script can read the blackboard", async () => {
    const tree = build(`<ScriptCondition code="return {answer} == 42"/>`);
    tree.rootBlackboard!.set("answer", 42);
    expect(await tree.tickExactlyOnce()).toBe(NodeStatus.SUCCESS);
  });
});

describe("RepeatNode", () => {
  test("repeats a succeeding child up to num_cycles", async () => {
    let ticks = 0;
    const factory = new TreeFactory();
    factory.registerNodeType(
      class extends SyncActionNode {
        static providedPorts() {
          return new PortList([]);
        }
        protected override tick(): NodeUserStatus {
          ticks++;
          return NodeStatus.SUCCESS;
        }
      },
      "Counter"
    );
    const xml = `
      <root BTTS_format="4" mainTreeToExecute="MainTree">
        <BehaviorTree ID="MainTree">
          <Repeat num_cycles="3">
            <Action ID="Counter"/>
          </Repeat>
        </BehaviorTree>
      </root>
    `;
    const tree = factory.createTreeFromXML(xml);
    expect(await tree.tickExactlyOnce()).toBe(NodeStatus.SUCCESS);
    expect(ticks).toBe(3);
  });

  test("a failing child aborts the loop", async () => {
    const xml = `
      <root BTTS_format="4" mainTreeToExecute="MainTree">
        <BehaviorTree ID="MainTree">
          <Repeat num_cycles="3">
            <Action ID="AlwaysFailure"/>
          </Repeat>
        </BehaviorTree>
      </root>
    `;
    const tree = new TreeFactory().createTreeFromXML(xml);
    expect(await tree.tickExactlyOnce()).toBe(NodeStatus.FAILURE);
  });
});
