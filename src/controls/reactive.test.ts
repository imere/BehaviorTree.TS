import { TreeFactory } from "../TreeFactory.js";
import { TreeObserver } from "../TreeObserver.js";
import { type PreTickCallback } from "../TreeNode.js";
import { AlwaysFailureNode } from "../actions/AlwaysFailureNode.js";
import { NodeStatus, isStatusCompleted } from "../basic.js";
import { registerTestTick } from "../testing/helper.js";
import { vi } from "vitest";

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
            <Sleep msec="100"/>
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

  test("TestLogging", async () => {
    const reactive_xml_text = `
<root BTTS_format="4" >
  <BehaviorTree ID="Main">
    <ReactiveSequence>
      <TestA name="testA"/>
      <AlwaysSuccess name="success"/>
      <Sleep msec="100"/>
    </ReactiveSequence>
  </BehaviorTree>
</root>
`;

    const factory = new TreeFactory();
    const counters: number[] = [0];
    registerTestTick(factory, "Test", counters);

    const tree = factory.createTreeFromXML(reactive_xml_text);
    const observer = new TreeObserver(tree);

    // The tick loop waits on setTimeout, so the clock has to be advanced while
    // it runs; with the real clock the number of ticks a 100 ms sleep takes
    // depends on how loaded the machine is, which made this test flaky.
    vi.useFakeTimers();
    const finished = tree.tickWhileRunning();
    await vi.advanceTimersByTimeAsync(200);
    const status = await finished;
    vi.useRealTimers();

    expect(status).toBe(NodeStatus.SUCCESS);

    const num_ticks = counters[0];
    expect(num_ticks).toBeGreaterThanOrEqual(5);

    expect(observer.getStatisticsByPath("testA").successCount).toBe(num_ticks);
    expect(observer.getStatisticsByPath("success").successCount).toBe(num_ticks);
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

  test("TwoAsyncNodesInReactiveSequenceRegisteredViaControl", async () => {
    // the check keys off the registration, not the element name, so wrapping
    // the same node in <Control ID="ReactiveSequence"> must still be rejected
    const xml = `
      <root BTTS_format="4" >
        <BehaviorTree ID="MainTree">
          <Control ID="ReactiveSequence">
            <AsyncSequence name="first">
              <TestA/>
              <TestB/>
            </AsyncSequence>
            <AsyncSequence name="second">
              <TestC/>
              <TestD/>
            </AsyncSequence>
          </Control>
        </BehaviorTree>
      </root>
    `;

    const factory = new TreeFactory();
    const counters = Array.from<number>({ length: 4 });
    registerTestTick(factory, "Test", counters);

    expect(() => factory.createTreeFromXML(xml)).toThrow();
  });
});
