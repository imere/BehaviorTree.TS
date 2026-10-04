import { TreeFactory } from "./TreeFactory.js";
import { TestNodeConfig } from "./actions/TestNode.js";
import { NodeStatus } from "./basic.js";

const json = `
{
  "TestNodeConfigs": {
    "TestA": {
      "async_delay": 2000,
      "return_status": "SUCCESS",
      "post_script": "msg ='message SUBSTITUED'"
    },
    "TestB": {
      "return_status": "FAILURE"
    }
  },

  "SubstitutionRules": {
    "actionA": "TestA",
    "actionB": "TestB",
    "actionC": "NotAConfig"
  }
}
`;

describe("Substitution", () => {
  test("Parser", () => {
    const factory = new TreeFactory();

    factory.loadSubstitutionRuleFromJSON(json);

    const rules = factory.substitutionRules;

    expect(rules.size).toEqual(3);
    expect(rules.has("actionA")).toBeTruthy();
    expect(rules.has("actionB")).toBeTruthy();
    expect(rules.has("actionC")).toBeTruthy();

    const configA = rules.get("actionA") as TestNodeConfig;
    expect(configA.return_status).toEqual(NodeStatus[NodeStatus.SUCCESS]);
    expect(configA.async_delay).toEqual(2000);
    expect(configA.post_script).toEqual("msg ='message SUBSTITUED'");

    const configB = rules.get("actionB") as TestNodeConfig;
    expect(configB.return_status).toEqual(NodeStatus[NodeStatus.FAILURE]);
    expect(configB.async_delay).toEqual(0);
    expect(configB.post_script).toBeFalsy();

    expect(rules.get("actionC")).toEqual("NotAConfig");
  });
});

describe("BehaviorTree.CPPIssue1083_SubstitutingASubTree", () => {
  test("a substitution rule may replace a SubTree with a non-SubTree node", async () => {
    const xml = `
      <root BTTS_format="4" mainTreeToExecute="MainTree">
        <BehaviorTree ID="MainTree">
          <SubTree ID="SomeTree" name="mocked"/>
        </BehaviorTree>
        <BehaviorTree ID="SomeTree">
          <AlwaysSuccess/>
        </BehaviorTree>
      </root>
    `;

    const factory = new TreeFactory();
    factory.substitutionRules.set("mocked", "AlwaysFailure");
    const tree = factory.createTreeFromXML(xml);

    // without the guard this reached setSubtreeId on a non-SubTree node
    expect(await tree.tickExactlyOnce()).toBe(NodeStatus.FAILURE);
  });
});
