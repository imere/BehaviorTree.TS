import { NodeStatus } from "./src/basic.js";
import { TreeFactory } from "./src/TreeFactory.js";
import { TreeObserver } from "./src/TreeObserver.js";
import { registerTestTick } from "./src/testing/helper.js";

const factory = new TreeFactory();
const counters = [0];
registerTestTick(factory, "Test", counters);
const tree = factory.createTreeFromXML(`
<root BTTS_format="4">
  <BehaviorTree ID="Main">
    <ReactiveSequence>
      <TestA name="testA"/>
      <AlwaysSuccess name="success"/>
      <Sleep msec="100"/>
    </ReactiveSequence>
  </BehaviorTree>
</root>`);
const obs = new TreeObserver(tree);
console.log("subtrees:", tree.subtrees.length, "nodes[0]:", tree.subtrees[0]?.nodes[0]?.name);
console.log("paths:", [...obs.pathsToUid().keys()]);
await tree.tickWhileRunning();
console.log("ticks:", counters[0]);
