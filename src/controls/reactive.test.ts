import { TreeFactory } from "../TreeFactory";
import { type PreTickCallback } from "../TreeNode";
import { AlwaysFailureNode } from "../actions/AlwaysFailureNode";
import { NodeStatus, isStatusCompleted } from "../basic";
import { registerTestTick } from "../testing/helper";

describe("Reactive", () => {
  test("RunningChildren", async () => {
    const xml = `
      <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
          <ReactiveSequence>
            <Sequence name="first">
              <TestA/>
              <TestB/>
              <TestC/>
            </Sequence>
            <AsyncSequence name="second">
              <TestD/>
              <TestE/>
              <TestF/>
            </AsyncSequence>
          </ReactiveSequence>
        </BehaviorTree>
      </root>
    `;

    const factory = new TreeFactory();
    const counters = Array.from<number>({ length: 6 });
    registerTestTick(factory, "Test", counters);

    const tree = factory.createTreeFromXML(xml);

    let status = NodeStatus.IDLE;

    let count = 0;
    while (!isStatusCompleted(status) && count < 100) {
      count++;
      status = await tree.tickExactlyOnce();
    }

    expect(count).not.toBe(100);

    expect(status).toBe(NodeStatus.SUCCESS);

    expect(counters).toEqual([3, 3, 3, 1, 1, 1]);
  });

  test("PreTickHooks", async () => {
    const xml = `
      <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
          <ReactiveSequence>
            <AlwaysFailure name="failureA"/>
            <AlwaysFailure name="failureB"/>
            <Sleep ms="100"/>
          </ReactiveSequence>
        </BehaviorTree>
      </root>
    `;

    const factory = new TreeFactory();
    const tree = factory.createTreeFromXML(xml);

    const callback: PreTickCallback = () => NodeStatus.SUCCESS;

    tree.applyVisitor((node) => {
      if (node instanceof AlwaysFailureNode) {
        node.setPreTickFunction(callback);
      }
    });

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
  });

  test("TwoAsyncNodesInReactiveSequence", async () => {
    const xml = `
      <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
          <ReactiveSequence>
            <AsyncSequence name="first">
              <TestA/>
              <TestB/>
              <TestC/>
            </AsyncSequence>
            <AsyncSequence name="second">
              <TestD/>
              <TestE/>
              <TestF/>
            </AsyncSequence>
          </ReactiveSequence>
        </BehaviorTree>
      </root>
    `;

    const factory = new TreeFactory();
    const counters = Array.from<number>({ length: 6 });
    registerTestTick(factory, "Test", counters);

    expect(() => factory.createTreeFromXML(xml)).toThrow();
  });
});
