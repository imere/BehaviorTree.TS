import { StatefulActionNode, SyncActionNode } from "./ActionNode";
import { TreeFactory } from "./TreeFactory";
import { NodeStatus, PortList, createOutputPort, type NodeUserStatus } from "./basic";
import { registerTestTick } from "./testing/helper";

describe("PreconditionsDecorator", () => {
  test("Integers", () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0, 0];
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4">
      <Tree id="MainTree">
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
      </Tree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);

    expect(counters).toEqual([1, 0, 1]);
  });

  test("DoubleEquals", () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0, 0];
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4">
      <Tree id="MainTree">
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
      </Tree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);

    expect(counters).toEqual([1, 0, 1]);
  });

  test("DoubleEquals", () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0, 0];
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4">
      <Tree id="MainTree">
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
      </Tree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);

    expect(counters).toEqual([1, 0, 1]);
  });

  test("StringEquals", () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0];
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4">
      <Tree id="MainTree">
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
      </Tree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);

    expect(counters).toEqual([0, 1]);
  });
});

describe("Preconditions", () => {
  test("Basic", () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0, 0, 0];
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4">
      <Tree id="MainTree">
          <Sequence>
              <Script code = "A=1" />
              <TestA _successIf= "A===1"/>
              <TestB _successIf= "A===2"/>
              <Fallback>
                  <TestC _failureIf= "A===1"/>
                  <TestD _failureIf= "A!==1"/>
              </Fallback>
          </Sequence>
      </Tree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);

    expect(counters).toEqual([0, 1, 0, 1]);
  });

  test("BehaviorTree.CPPIssue533", async () => {
    const factory = new TreeFactory();
    const counters: number[] = [0, 0, 0];
    registerTestTick(factory, "Test", counters);

    const xml = `
    <root BTTS_format="4">
      <Tree id="MainTree">
          <Sequence>
            <TestA _skipIf="A!==1" />
            <TestB _skipIf="A!==2" _onSuccess="A=1"/>
            <TestC _skipIf="A!==3" _onSuccess="A=2"/>
          </Sequence>
      </Tree>
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

  test("BehaviorTree.CPPIssue615_NoSkipWhenRunning_B", () => {
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
      <Tree id="MainTree">
        <KeepRunning _skipIf="check===false"/>
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerNodeType(KeepRunning, KeepRunning.name, new PortList());
    const tree = factory.createTreeFromXML(xml);

    tree.rootBlackboard!.set("check", false);
    expect(tree.tickOnce()).resolves.toBe(NodeStatus.SKIPPED);

    // Should not be skipped anymore
    tree.rootBlackboard!.set("check", true);
    expect(tree.tickOnce()).resolves.toBe(NodeStatus.RUNNING);

    // skipIf should be ignored, because KeepRunning is RUNNING and not IDLE
    tree.rootBlackboard!.set("check", false);
    expect(tree.tickOnce()).resolves.toBe(NodeStatus.RUNNING);
  });

  test("Remapping", () => {
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
      <Tree id="Main">
        <Sequence>
          <SimpleOutput  output="{param}" />
          <Script  code="value=true" />
          <Subtree id="Sub1" param="{param}"/>
          <Subtree id="Sub1" param="{value}"/>
          <Subtree id="Sub1" param="true"/>
          <TestA/>
        </Sequence>
      </Tree>

      <Tree id="Sub1">
        <Sequence>
          <Subtree id="Sub2" _skipIf="param !== true" />
        </Sequence>
      </Tree>
        
      <Tree id="Sub2">
        <Sequence>
          <TestB/>
        </Sequence>
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    const counters: number[] = [0, 0];
    factory.registerNodeType(SimpleOutput, SimpleOutput.name);
    registerTestTick(factory, "Test", counters);

    factory.registerTreeFromXML(xml);
    const tree = factory.createTree("Main");

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);
    expect(counters).toEqual([1, 3]);
  });
});
