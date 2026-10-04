import { TreeFactory } from "../TreeFactory.js";
import { NodeStatus, type NodeUserStatus } from "../basic.js";

function testTick(tickCounter: () => number): NodeUserStatus {
  tickCounter();
  return NodeStatus.SUCCESS;
}

export function registerTestTick(factory: TreeFactory, namePrefix: string, tickCounters: number[]) {
  const A = "A".charCodeAt(0);
  for (let i = 0; i < tickCounters.length; i++) {
    tickCounters[i] = 0;
    const str = `${namePrefix}${String.fromCharCode(A + i)}`;
    factory.registerSimpleAction(
      str,
      testTick.bind(null, () => tickCounters[i]++)
    );
  }
}
