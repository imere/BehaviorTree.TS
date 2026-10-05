import { beforeEach, describe, expect, it } from "vitest";
import { NodeStatus, type NodeUserStatus } from "../basic.js";
import { TreeFactory } from "../TreeFactory.js";
import { registerTestTick } from "../testing/helper.js";

describe("TryCatchTest", () => {
  let factory: TreeFactory;
  let counters: number[];

  beforeEach(() => {
    factory = new TreeFactory();
    counters = [0, 0, 0, 0];
    registerTestTick(factory, "Test", counters);
  });

  const tree = (body: string) =>
    factory.createTreeFromXML(`
    <root BTTS_format="4">
       <BehaviorTree>
          <TryCatch>
${body}
          </TryCatch>
       </BehaviorTree>
    </root>`);

  it("AllTryChildrenSucceed", async () => {
    const t = tree(
      `            <TestA/>
            <TestB/>
            <TestC/>  <!-- catch -->`
    );

    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(1); // TestA executed
    expect(counters[1]).toBe(1); // TestB executed
    expect(counters[2]).toBe(0); // TestC (catch) NOT executed
  });

  it("FirstChildFails_CatchExecuted", async () => {
    const t = tree(
      `            <AlwaysFailure/>
            <TestA/>
            <TestB/>  <!-- catch -->`
    );

    expect(await t.tickWhileRunning()).toBe(NodeStatus.FAILURE);
    expect(counters[0]).toBe(0); // TestA NOT executed (after failed child)
    expect(counters[1]).toBe(1); // TestB (catch) executed
  });

  it("SecondChildFails_CatchExecuted", async () => {
    const t = tree(
      `            <TestA/>
            <AlwaysFailure/>
            <TestB/>  <!-- catch -->`
    );

    expect(await t.tickWhileRunning()).toBe(NodeStatus.FAILURE);
    expect(counters[0]).toBe(1); // TestA executed (before failure)
    expect(counters[1]).toBe(1); // TestB (catch) executed
  });

  it("CatchReturnsFailure_NodeStillReturnsFAILURE", async () => {
    const t = tree(
      `            <AlwaysFailure/>  <!-- try fails -->
            <AlwaysFailure/>  <!-- catch also fails -->`
    );

    expect(await t.tickWhileRunning()).toBe(NodeStatus.FAILURE);
  });

  it("CatchReturnsSuccess_NodeStillReturnsFAILURE", async () => {
    const t = tree(
      `            <AlwaysFailure/>  <!-- try fails -->
            <AlwaysSuccess/>  <!-- catch succeeds -->`
    );

    // Even if catch succeeds, TryCatch returns FAILURE
    expect(await t.tickWhileRunning()).toBe(NodeStatus.FAILURE);
  });

  it("TryChildRunning", async () => {
    let tickCount = 0;
    factory.registerSimpleCondition("RunningThenSuccess", (): NodeUserStatus => {
      tickCount++;
      return tickCount === 1 ? NodeStatus.RUNNING : NodeStatus.SUCCESS;
    });

    const t = tree(
      `            <RunningThenSuccess/>
            <TestA/>  <!-- catch -->`
    );

    expect(await t.tickOnce()).toBe(NodeStatus.RUNNING);

    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(0); // Catch NOT executed
  });

  it("CatchChildRunning", async () => {
    let catchTickCount = 0;
    factory.registerSimpleCondition("RunningThenFailure", (): NodeUserStatus => {
      catchTickCount++;
      return catchTickCount === 1 ? NodeStatus.RUNNING : NodeStatus.FAILURE;
    });

    const t = tree(
      `            <AlwaysFailure/>       <!-- try fails -->
            <RunningThenFailure/>  <!-- catch: RUNNING first, then FAILURE -->`
    );

    // First tick: try fails, catch starts and returns RUNNING
    expect(await t.tickOnce()).toBe(NodeStatus.RUNNING);

    // Second tick: catch returns FAILURE, TryCatch returns FAILURE
    expect(await t.tickWhileRunning()).toBe(NodeStatus.FAILURE);
  });

  it("MinimumTwoChildren_ParseTimeValidation", () => {
    const xml = `
    <root BTTS_format="4">
       <BehaviorTree>
          <TryCatch>
            <AlwaysSuccess/>
          </TryCatch>
       </BehaviorTree>
    </root>`;

    // Error should be caught at parse time, not tick time
    expect(() => factory.createTreeFromXML(xml)).toThrow();
  });

  it("ReExecuteAfterSuccess", async () => {
    const t = tree(
      `            <TestA/>
            <TestB/>  <!-- catch -->`
    );

    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(1);

    t.haltTree();
    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(2); // TestA executed again
    expect(counters[1]).toBe(0); // Catch still never executed
  });

  it("ReExecuteAfterFailure", async () => {
    let tryTickCount = 0;
    factory.registerSimpleAction("FailThenSucceed", (): NodeUserStatus => {
      tryTickCount++;
      return tryTickCount === 1 ? NodeStatus.FAILURE : NodeStatus.SUCCESS;
    });

    const t = tree(
      `            <FailThenSucceed/>
            <TestA/>  <!-- catch -->`
    );

    // First execution: try fails, catch runs
    expect(await t.tickWhileRunning()).toBe(NodeStatus.FAILURE);
    expect(counters[0]).toBe(1); // Catch executed

    // Second execution: try succeeds
    t.haltTree();
    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(1); // Catch not executed again
  });

  it("CatchOnHalt_Disabled", async () => {
    let catchCount = 0;
    factory.registerSimpleAction("CountCatch", (): NodeUserStatus => {
      catchCount++;
      return NodeStatus.SUCCESS;
    });

    let tryTicks = 0;
    factory.registerSimpleCondition("AlwaysRunning", (): NodeUserStatus => {
      tryTicks++;
      return NodeStatus.RUNNING;
    });

    const t = tree(
      `            <AlwaysRunning/>
            <CountCatch/>  <!-- catch -->`
    );

    expect(await t.tickOnce()).toBe(NodeStatus.RUNNING);
    expect(tryTicks).toBe(1);

    // Halt while try-block is RUNNING; catch_on_halt defaults to false
    t.haltTree();
    expect(catchCount).toBe(0); // Catch NOT executed on halt
  });

  it("CatchOnHalt_Enabled", async () => {
    let catchCount = 0;
    factory.registerSimpleAction("CountCatch", (): NodeUserStatus => {
      catchCount++;
      return NodeStatus.SUCCESS;
    });

    let tryTicks = 0;
    factory.registerSimpleCondition("AlwaysRunning", (): NodeUserStatus => {
      tryTicks++;
      return NodeStatus.RUNNING;
    });

    const t = factory.createTreeFromXML(`
    <root BTTS_format="4">
       <BehaviorTree>
          <TryCatch catch_on_halt="true">
            <AlwaysRunning/>
            <CountCatch/>  <!-- catch -->
          </TryCatch>
       </BehaviorTree>
    </root>`);

    expect(await t.tickOnce()).toBe(NodeStatus.RUNNING);
    expect(tryTicks).toBe(1);

    // Halt while try-block is RUNNING; catch_on_halt is true
    t.haltTree();
    expect(catchCount).toBe(1); // Catch executed on halt
  });

  it("CatchOnHalt_NotTriggeredWhenAlreadyInCatch", async () => {
    let catchTicks = 0;
    factory.registerSimpleCondition("RunningCatch", (): NodeUserStatus => {
      catchTicks++;
      return NodeStatus.RUNNING;
    });

    const t = factory.createTreeFromXML(`
    <root BTTS_format="4">
       <BehaviorTree>
          <TryCatch catch_on_halt="true">
            <AlwaysFailure/>  <!-- try fails immediately -->
            <RunningCatch/>   <!-- catch returns RUNNING -->
          </TryCatch>
       </BehaviorTree>
    </root>`);

    // First tick: try fails, enters catch, catch returns RUNNING
    expect(await t.tickOnce()).toBe(NodeStatus.RUNNING);
    expect(catchTicks).toBe(1);

    // Halt while in catch mode: should NOT re-trigger catch
    t.haltTree();
    expect(catchTicks).toBe(1); // Catch NOT ticked again
  });

  it("AsyncCatchCompletesInsideSequence", async () => {
    // The catch child returns RUNNING for 5 ticks, then SUCCESS.
    // Verify that the Sequence keeps ticking TryCatch, which keeps
    // ticking the catch child until it completes.
    const kRunningTicks = 5;
    let catchTicks = 0;
    factory.registerSimpleCondition("AsyncCleanup", (): NodeUserStatus => {
      catchTicks++;
      return catchTicks <= kRunningTicks ? NodeStatus.RUNNING : NodeStatus.SUCCESS;
    });

    const t = factory.createTreeFromXML(`
    <root BTTS_format="4">
       <BehaviorTree>
          <Sequence>
            <TryCatch>
              <AlwaysFailure/>    <!-- try: fails immediately -->
              <AsyncCleanup/>     <!-- catch: RUNNING for 5 ticks, then SUCCESS -->
            </TryCatch>
            <TestA/>              <!-- should NOT execute: TryCatch returns FAILURE -->
          </Sequence>
       </BehaviorTree>
    </root>`);

    // Tick-by-tick: the tree should stay RUNNING while catch is async
    for (let i = 0; i < kRunningTicks; i++) {
      expect(await t.tickOnce()).toBe(NodeStatus.RUNNING);
      expect(catchTicks).toBe(i + 1);
    }

    // Next tick: catch completes -> TryCatch returns FAILURE -> Sequence FAILURE
    expect(await t.tickOnce()).toBe(NodeStatus.FAILURE);

    // Catch child was ticked exactly kRunningTicks + 1 times (5 RUNNING + 1 SUCCESS)
    expect(catchTicks).toBe(kRunningTicks + 1);

    // TestA was never reached because TryCatch returned FAILURE
    expect(counters[0]).toBe(0);
  });

  it("SingleTryChild_Success", async () => {
    const t = tree(
      `            <TestA/>   <!-- single try child -->
            <TestB/>   <!-- catch -->`
    );

    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(1);
    expect(counters[1]).toBe(0);
  });

  it("ManyTryChildren_ThirdFails", async () => {
    const t = tree(
      `            <TestA/>
            <TestB/>
            <AlwaysFailure/>
            <TestC/>  <!-- catch -->`
    );

    expect(await t.tickWhileRunning()).toBe(NodeStatus.FAILURE);
    expect(counters[0]).toBe(1); // TestA executed
    expect(counters[1]).toBe(1); // TestB executed
    expect(counters[2]).toBe(1); // TestC (catch) executed
  });
});
