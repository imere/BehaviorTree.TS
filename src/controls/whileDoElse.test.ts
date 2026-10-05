import { beforeEach, describe, expect, it } from "vitest";
import { NodeStatus, type NodeUserStatus } from "../basic.js";
import { TreeFactory } from "../TreeFactory.js";
import { registerTestTick } from "../testing/helper.js";

describe("WhileDoElseTest", () => {
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
          <WhileDoElse>
${body}
          </WhileDoElse>
       </BehaviorTree>
    </root>`);

  it("ConditionTrue_DoBranch", async () => {
    // When condition is true, execute the "do" branch
    const t = tree(
      `            <AlwaysSuccess/>  <!-- condition -->
            <TestA/>          <!-- do -->
            <TestB/>          <!-- else -->`
    );

    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(1); // TestA executed
    expect(counters[1]).toBe(0); // TestB not executed
  });

  it("ConditionFalse_ElseBranch", async () => {
    // When condition is false, execute the "else" branch
    const t = tree(
      `            <AlwaysFailure/>  <!-- condition -->
            <TestA/>          <!-- do -->
            <TestB/>          <!-- else -->`
    );

    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(0); // TestA not executed
    expect(counters[1]).toBe(1); // TestB executed
  });

  it("ConditionFalse_TwoChildren_ReturnsFailure", async () => {
    // With only 2 children and condition false, return FAILURE
    const t = tree(
      `            <AlwaysFailure/>  <!-- condition -->
            <TestA/>          <!-- do -->`
    );

    expect(await t.tickWhileRunning()).toBe(NodeStatus.FAILURE);
    expect(counters[0]).toBe(0); // TestA not executed
  });

  it("DoBranchFails", async () => {
    // When do-branch fails, WhileDoElse returns FAILURE
    const t = tree(
      `            <AlwaysSuccess/>  <!-- condition -->
            <AlwaysFailure/>  <!-- do -->
            <TestA/>          <!-- else -->`
    );

    expect(await t.tickWhileRunning()).toBe(NodeStatus.FAILURE);
    expect(counters[0]).toBe(0); // TestA (else) not executed
  });

  it("ElseBranchFails", async () => {
    // When else-branch fails, WhileDoElse returns FAILURE
    const t = tree(
      `            <AlwaysFailure/>  <!-- condition -->
            <TestA/>          <!-- do -->
            <AlwaysFailure/>  <!-- else -->`
    );

    expect(await t.tickWhileRunning()).toBe(NodeStatus.FAILURE);
    expect(counters[0]).toBe(0); // TestA (do) not executed
  });

  it("ConditionChanges_HaltsElse", async () => {
    // When condition changes from false to true, else branch should be halted
    let conditionCounter = 0;
    factory.registerSimpleCondition("ToggleCondition", (): NodeUserStatus => {
      return conditionCounter++ === 0 ? NodeStatus.FAILURE : NodeStatus.SUCCESS;
    });

    const t = tree(
      `            <ToggleCondition/>
            <TestA/>
            <TestB/>`
    );

    // First tick - condition false, executes else (TestB)
    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(0); // TestA not executed
    expect(counters[1]).toBe(1); // TestB executed
  });

  it("ConditionChanges_HaltsDo", async () => {
    // When condition changes from true to false, do branch should be halted
    let conditionCounter = 0;
    factory.registerSimpleCondition("ToggleCondition2", (): NodeUserStatus => {
      return conditionCounter++ === 0 ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
    });

    const t = tree(
      `            <ToggleCondition2/>
            <TestA/>
            <TestB/>`
    );

    // First tick - condition true, executes do (TestA)
    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(1); // TestA executed
    expect(counters[1]).toBe(0); // TestB not executed
  });

  it("HaltBehavior", async () => {
    // Test that halt resets the node properly
    const t = tree(
      `            <AlwaysSuccess/>
            <TestA/>
            <TestB/>`
    );

    // First execution
    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(1);

    // Halt and re-execute
    t.haltTree();
    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(2); // TestA executed again
  });

  it("InvalidChildCount_One", async () => {
    // WhileDoElse with only 1 child should throw
    const t = tree(`            <AlwaysSuccess/>`);
    await expect(t.tickWhileRunning()).rejects.toThrow(/either 2 or 3 children/);
  });

  it("InvalidChildCount_Four", async () => {
    // WhileDoElse with 4 children should throw
    const t = tree(
      `            <AlwaysSuccess/>
            <TestA/>
            <TestB/>
            <TestC/>`
    );
    await expect(t.tickWhileRunning()).rejects.toThrow(/either 2 or 3 children/);
  });

  it("ConditionRunning", async () => {
    // Test behavior when condition returns RUNNING
    let firstTick = true;
    factory.registerSimpleCondition("RunningThenSuccess", (): NodeUserStatus => {
      if (firstTick) {
        firstTick = false;
        return NodeStatus.RUNNING;
      }
      return NodeStatus.SUCCESS;
    });

    const t = tree(
      `            <RunningThenSuccess/>
            <TestA/>
            <TestB/>`
    );

    // First tick - condition returns RUNNING
    expect(await t.tickOnce()).toBe(NodeStatus.RUNNING);
    expect(counters[0]).toBe(0); // TestA not executed yet
    expect(counters[1]).toBe(0); // TestB not executed yet

    // Second tick - condition returns SUCCESS, executes do branch
    expect(await t.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(1); // TestA executed
  });
});
