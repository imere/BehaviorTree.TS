import { Blackboard } from "./Blackboard";
import { TreeFactory } from "./TreeFactory";
import { NodeStatus, isStatusCompleted } from "./basic";
import { AsyncActionTest } from "./testing/ActionTestNode";
import { registerTestTick } from "./testing/helper";

describe("SkippingLogic", () => {
  test("Sequence", async () => {
    const factory = new TreeFactory();
    const counters = Array.from<number>({ length: 2 });
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4" >
        <Tree id="MainTree">
            <Sequence>
                <Script code = "A=1"/>
                <TestA _successIf="A===2" _failureIf="A!==1" _skipIf="A===1"/>
                <TestB/>
            </Sequence>
        </Tree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);
    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters).toEqual([0, 1]);
  });

  test("SkipAll", async () => {
    const factory = new TreeFactory();
    const counters = Array.from<number>({ length: 3 });
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4" >
        <Tree id="MainTree">
            <Sequence>
                <TestA _skipIf="A===1"/>
                <TestB _skipIf="A<2"/>
                <TestC _skipIf="A>0"/>
            </Sequence>
        </Tree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);
    tree.rootBlackboard!.set("A", 1);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SKIPPED);
    expect(counters).toEqual([0, 0, 0]);
  });

  test("SkipSubtree", async () => {
    const factory = new TreeFactory();
    const counters = Array.from<number>({ length: 2 });
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4" >
        <Tree id="main">
            <Sequence>
                <TestA/>
                <Script code = "data=true"/>
                <Subtree id="sub" _skipIf="data"/>
            </Sequence>
        </Tree>

        <Tree id="sub">
            <TestB/>
        </Tree>
    </root>
    `;

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("main");

    tree.rootBlackboard!.set("A", 1);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters).toEqual([1, 0]);
  });

  test("ReactiveSingleChild", async () => {
    const xml = `
    <root BTTS_format="4" >
        <Tree id="Untitled">
          <ReactiveSequence>
            <AlwaysSuccess _skipIf="flag"/>
          </ReactiveSequence>
        </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    const rootBlackboard = Blackboard.create();
    rootBlackboard.set("flag", true);

    const tree = factory.createTreeFromXML(xml, rootBlackboard);

    expect(await tree.tickWhileRunning()).toBeDefined();
  });

  test("SkippingReactiveSequence", async () => {
    const factory = new TreeFactory();
    const counters = Array.from<number>({ length: 2 });
    registerTestTick(factory, "Test", counters);

    const xml_noskip = `
    <root BTTS_format="4" >
        <Tree>
          <ReactiveSequence>
            <Script code=" value=50 "/>
            <TestA _skipIf="value < 25"/>
            <AsyncActionTest/>
          </ReactiveSequence>
        </Tree>
    </root>
    `;

    const xml_skip = `
    <root BTTS_format="4" >
        <Tree>
          <ReactiveSequence>
            <Script code=" value=10 "/>
              <TestB _skipIf="value < 25"/>
            <AsyncActionTest/>
          </ReactiveSequence>
        </Tree>
    </root>
    `;

    factory.registerNodeType(AsyncActionTest, AsyncActionTest.name);

    let expected_test_A_ticks = 0;

    for (const xml of [xml_noskip, xml_skip]) {
      factory.clearRegisteredTrees();
      const tree = factory.createTreeFromXML(xml);

      for (let repeat = 0; repeat < 3; repeat++) {
        let status = NodeStatus.IDLE;
        while (!isStatusCompleted(status)) {
          status = await tree.tickOnce();

          if (xml === xml_noskip) expected_test_A_ticks++;

          await tree.sleep(15);
        }
        expect(status).toBe(NodeStatus.SUCCESS);
      }
    }

    expect(counters).toEqual([expected_test_A_ticks, 0]);
  });

  test("WhileSkip", async () => {
    const factory = new TreeFactory();
    const counters = Array.from<number>({ length: 2 });
    registerTestTick(factory, "Test", counters);

    const xml_noskip = `
    <root BTTS_format="4" >
        <Tree>
          <Sequence>
            <Script code=" doit=true "/>
            <Sequence>
              <TestA _while="doit"/>
            </Sequence>
          </Sequence>
        </Tree>
    </root>
    `;

    const xml_skip = `
    <root BTTS_format="4" >
        <Tree>
          <Sequence>
            <Script code=" doit=false "/>
            <Sequence>
              <TestB _while="doit"/>
            </Sequence>
          </Sequence>
        </Tree>
    </root>
    `;

    for (const xml of [xml_noskip, xml_skip]) {
      factory.clearRegisteredTrees();
      const tree = factory.createTreeFromXML(xml);
      expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    }

    expect(counters).toEqual([1, 0]);
  });
});
