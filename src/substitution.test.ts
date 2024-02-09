import { TreeFactory } from "./TreeFactory";
import { TestNodeConfig } from "./actions/TestNode";
import { NodeStatus } from "./basic";

const json = `
{
  "TestNodeConfigs": {
    "TestA": {
      "asyncDelay": 2000,
      "returnStatus": "SUCCESS",
      "postScript": "msg ='message SUBSTITUED'"
    },
    "TestB": {
      "returnStatus": "FAILURE"
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
    expect(configA.returnStatus).toEqual(NodeStatus[NodeStatus.SUCCESS]);
    expect(configA.asyncDelay).toEqual(2000);
    expect(configA.postScript).toEqual("msg ='message SUBSTITUED'");

    const configB = rules.get("actionB") as TestNodeConfig;
    expect(configB.returnStatus).toEqual(NodeStatus[NodeStatus.FAILURE]);
    expect(configB.asyncDelay).toEqual(0);
    expect(configB.postScript).toBeFalsy();

    expect(rules.get("actionC")).toEqual("NotAConfig");
  });
});
