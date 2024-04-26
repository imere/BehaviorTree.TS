import { TreeFactory } from "./TreeFactory";
import { TestNodeConfig } from "./actions/TestNode";
import { NodeStatus } from "./basic";

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
