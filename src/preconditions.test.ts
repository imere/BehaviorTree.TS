import { StatefulActionNode, SyncActionNode } from "./ActionNode";
import { TreeFactory } from "./TreeFactory";
import { NodeStatus, PortList, createOutputPort, type NodeUserStatus } from "./basic";
import { registerTestTick } from "./testing/helper";

describe("PreconditionsDecorator", () => {
  test("Integers", async () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0, 0];
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
          <Sequence>
              <Script code = "A=1; B=1; C=3" />
              <Precondition if="A===B" else="FAILURE">
                  <TestA/>
              </Precondition>
              <Precondition if="A===C" else="SUCCESS">
                  <TestB/>
              </Precondition>
              <Precondition if="A!==C" else="FAILURE">
                  <TestC/>
              </Precondition>
          </Sequence>
      </BehaviorTree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);

    expect(counters).toEqual([1, 0, 1]);
  });

  test("DoubleEquals", async () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0, 0];
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
          <Sequence>
              <Script code = "A=1.1; B=1.0+0.1; C=2.0" />

              <Precondition if="A===B" else="FAILURE">
                  <TestA/>
              </Precondition>

              <Precondition if="A===C" else="SUCCESS">
                  <TestB/>
              </Precondition>

              <Precondition if="A!==C" else="FAILURE">
                  <TestC/>
              </Precondition>
          </Sequence>
      </BehaviorTree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);

    expect(counters).toEqual([1, 0, 1]);
  });

  test("DoubleEquals", async () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0, 0];
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
          <Sequence>
              <Script code = "A=1.1; B=1.0+0.1; C=2.0" />

              <Precondition if="A===B" else="FAILURE">
                  <TestA/>
              </Precondition>

              <Precondition if="A===C" else="SUCCESS">
                  <TestB/>
              </Precondition>

              <Precondition if="A!==C" else="FAILURE">
                  <TestC/>
              </Precondition>
          </Sequence>
      </BehaviorTree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);

    expect(counters).toEqual([1, 0, 1]);
  });

  test("StringEquals", async () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0];
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
          <Sequence>
              <Script code = "A='hello'" />
              <Script code = "B='world'" />
              <Script code = "C='world'" />

              <Precondition if="A===B" else="SUCCESS">
                  <TestA/>
              </Precondition>

              <Precondition if="B===C" else="FAILURE">
                  <TestB/>
              </Precondition>
          </Sequence>
      </BehaviorTree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);

    expect(counters).toEqual([0, 1]);
  });
});

describe("Preconditions", () => {
  test("Basic", async () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0, 0, 0];
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
          <Sequence>
              <Script code = "A=1" />
              <TestA _successIf= "A===1"/>
              <TestB _successIf= "A===2"/>
              <Fallback>
                  <TestC _failureIf= "A===1"/>
                  <TestD _failureIf= "A!==1"/>
              </Fallback>
          </Sequence>
      </BehaviorTree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);

    expect(counters).toEqual([0, 1, 0, 1]);
  });

  test("BehaviorTree.CPPIssue533", async () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0, 0];
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
          <Sequence>
            <TestA _skipIf="A!==1" />
            <TestB _skipIf="A!==2" _onSuccess="A=1"/>
            <TestC _skipIf="A!==3" _onSuccess="A=2"/>
          </Sequence>
      </BehaviorTree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);
    tree.subtrees[0].blackboard.set("A", 3);

    await tree.tickOnce();
    expect(counters).toEqual([0, 0, 1]);

    await tree.tickOnce();
    expect(counters).toEqual([0, 1, 1]);

    await tree.tickOnce();
    expect(counters).toEqual([1, 1, 1]);
  });

  test("BehaviorTree.CPPIssue615_NoSkipWhenRunning_B", async () => {
    class KeepRunning extends StatefulActionNode {
      override onStart(): NodeUserStatus {
        return NodeStatus.RUNNING;
      }

      override onRunning(): NodeUserStatus {
        return NodeStatus.RUNNING;
      }

      override onHalted(): void {
        console.log("Node halted");
      }
    }

    const xml = `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
        <KeepRunning _skipIf="check===false"/>
      </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(KeepRunning, KeepRunning.name, new PortList());
    const tree = factory.createTreeFromXML(xml);

    tree.rootBlackboard!.set("check", false);
    expect(await tree.tickOnce()).toBe(NodeStatus.SKIPPED);

    // Should not be skipped anymore
    tree.rootBlackboard!.set("check", true);
    expect(await tree.tickOnce()).toBe(NodeStatus.RUNNING);

    // skipIf should be ignored, because KeepRunning is RUNNING and not IDLE
    tree.rootBlackboard!.set("check", false);
    expect(await tree.tickOnce()).toBe(NodeStatus.RUNNING);
  });

  test("Remapping", async () => {
    class SimpleOutput extends SyncActionNode {
      static providedPorts(): PortList {
        return new PortList([createOutputPort("output")]);
      }

      protected override tick(): NodeUserStatus {
        this.setOutput("output", true);
        return NodeStatus.SUCCESS;
      }
    }

    const xml = `
    <root BTTS_format="4">
      <BehaviorTree ID="Main">
        <Sequence>
          <SimpleOutput  output="{param}" />
          <Script  code="value=true" />
          <SubTree ID="Sub1" param="{param}"/>
          <SubTree ID="Sub1" param="{value}"/>
          <SubTree ID="Sub1" param="true"/>
          <TestA/>
        </Sequence>
      </BehaviorTree>

      <BehaviorTree ID="Sub1">
        <Sequence>
          <SubTree ID="Sub2" _skipIf="param !== true" />
        </Sequence>
      </BehaviorTree>
        
      <BehaviorTree ID="Sub2">
        <Sequence>
          <TestB/>
        </Sequence>
      </BehaviorTree>
    </root>
    `;

    const factory = new TreeFactory();
    const counters: number[] = [0, 0];
    factory.registerNodeType(SimpleOutput, SimpleOutput.name);
    registerTestTick(factory, "Test", counters);

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("Main");

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters).toEqual([1, 3]);
  });
});
