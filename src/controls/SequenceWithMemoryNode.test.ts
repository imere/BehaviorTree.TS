import { describe, expect, it } from "vitest";
import { NodeStatus } from "../basic.js";
import { Tree, TreeFactory } from "../TreeFactory.js";
import { registerTestTick } from "../testing/helper.js";

describe("SequenceWithMemoryTest.Issue_636", () => {
  const xml = `
<root BTTS_format="4" mainTreeToExecute="MainTree" >

    <BehaviorTree ID="MainTree">
        <SequenceWithMemory>
            <Script code = " counter = 0 " />
            <TestA/>
            <ScriptCondition code = "counter+=1; counter >= 5" />
            <TestB/>
            <TestC/>
        </SequenceWithMemory>
    </BehaviorTree>
</root>`;

  // upstream loops until the tree reports SUCCESS; the cap keeps a regression
  // from hanging the suite instead of failing it
  async function tickUntilSuccess(tree: Tree): Promise<number> {
    let res = await tree.tickOnce();
    let tickCount = 1;
    while (res !== NodeStatus.SUCCESS && tickCount <= 20) {
      res = await tree.tickOnce();
      tickCount++;
    }
    return res === NodeStatus.SUCCESS ? tickCount : -1;
  }

  it("runs every child exactly once, however many ticks it takes", async () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0, 0];
    registerTestTick(factory, "Test", counters);

    const tickCount = await tickUntilSuccess(factory.createTreeFromXML(xml));

    expect(counters).toEqual([1, 1, 1]);
    expect(tickCount).toBe(5);
  });

});
