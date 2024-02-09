import { TreeFactory } from "./TreeFactory";
import { NodeStatus } from "./basic";

describe("PostConditions", () => {
  test("BasicTest", () => {
    const factory = new TreeFactory();

    const xml = `
    <root BTTS_format="4">
      <Tree id="MainTree">
          <Sequence>
              <Script code = "A=1; B=1; C=1; D=1" />

              <AlwaysSuccess _onSuccess="B=42"/>

              <ForceSuccess>
                  <AlwaysSuccess _failureIf="A!==0" _onFailure="C=42"/>
              </ForceSuccess>

              <ForceSuccess>
                  <AlwaysFailure _onFailure="D=42"/>
              </ForceSuccess>
          </Sequence>
      </Tree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);

    expect(tree.rootBlackboard!.get("B")).toBe(42);
    expect(tree.rootBlackboard!.get("C")).toBe(42);
    expect(tree.rootBlackboard!.get("D")).toBe(42);
  });
});
