import { Blackboard } from "../Blackboard.js";
import { NodeConfig } from "../TreeNode.js";
import { NodeStatus } from "../basic.js";
import { TestNode, TestNodeConfig } from "./TestNode.js";

function build(cfg: Partial<TestNodeConfig>) {
  const testConfig = new TestNodeConfig();
  Object.assign(testConfig, cfg);

  const nodeConfig = new NodeConfig();
  const node = new TestNode("test_node", nodeConfig, testConfig);

  return { node, blackboard: nodeConfig.blackboard };
}

const ALL_SCRIPTS = {
  success_script: "from_success = 1",
  failure_script: "from_failure = 1",
  post_script: "from_post = 1",
};

describe("BehaviorTree.CPPIssue1169_TestNodeExecutorWiring", () => {
  test("SUCCESS runs success_script and post_script, not failure_script", () => {
    const { node, blackboard } = build({
      return_status: "SUCCESS",
      ...ALL_SCRIPTS,
    });

    expect(node.executeTick()).toBe(NodeStatus.SUCCESS);

    expect(blackboard.get("from_success")).toBe(1);
    expect(blackboard.get("from_post")).toBe(1);
    expect(blackboard.get("from_failure")).toBeUndefined();
  });

  test("FAILURE runs failure_script and post_script, not success_script", () => {
    const { node, blackboard } = build({
      return_status: "FAILURE",
      ...ALL_SCRIPTS,
    });

    expect(node.executeTick()).toBe(NodeStatus.FAILURE);

    expect(blackboard.get("from_failure")).toBe(1);
    expect(blackboard.get("from_post")).toBe(1);
    expect(blackboard.get("from_success")).toBeUndefined();
  });

  test("SKIPPED runs only post_script", () => {
    const { node, blackboard } = build({
      return_status: "SKIPPED",
      ...ALL_SCRIPTS,
    });

    expect(node.executeTick()).toBe(NodeStatus.SKIPPED);

    expect(blackboard.get("from_post")).toBe(1);
    expect(blackboard.get("from_success")).toBeUndefined();
    expect(blackboard.get("from_failure")).toBeUndefined();
  });

  test("each script is bound to its own config field", () => {
    const { node, blackboard } = build({
      return_status: "FAILURE",
      success_script: "only_success = 1",
    });

    expect(node.executeTick()).toBe(NodeStatus.FAILURE);
    expect(blackboard.get("only_success")).toBeUndefined();
  });

  test("no scripts configured is a no-op", () => {
    const { node } = build({ return_status: "SUCCESS" });

    expect(node.executeTick()).toBe(NodeStatus.SUCCESS);
  });

  test("BehaviorTree.CPPIssue1169_ReturnStatusScriptOverrides", () => {
    const { node } = build({
      return_status: "SUCCESS",
      return_status_script: "should_fail ? 'FAILURE' : 'SUCCESS'",
    });

    const config = node as unknown as { config: { blackboard: Blackboard } };
    config.config.blackboard.set("should_fail", true);

    expect(node.executeTick()).toBe(NodeStatus.FAILURE);
  });

  test("BehaviorTree.CPPIssue1169_ReturnStatusScriptSeesStatusNames", () => {
    const { node } = build({
      return_status: "SUCCESS",
      return_status_script: "verdict",
    });

    const bb = (node as unknown as { config: { blackboard: Blackboard } }).config.blackboard;
    bb.set("verdict", "SKIPPED");

    expect(node.executeTick()).toBe(NodeStatus.SKIPPED);
  });

  test("BehaviorTree.CPPIssue1169_ReturnStatusScriptRejectsIdle", () => {
    const { node } = build({ return_status: "SUCCESS", return_status_script: "'IDLE'" });

    expect(() => node.executeTick()).toThrow(/IDLE/);
  });

  test("BehaviorTree.CPPIssue1169_ReturnStatusScriptDrivesHooks", () => {
    const { node, blackboard } = build({
      return_status: "SUCCESS",
      return_status_script: "'FAILURE'",
      success_script: "ran_success = 1",
      failure_script: "ran_failure = 1",
      post_script: "ran_post = 1",
    });

    expect(node.executeTick()).toBe(NodeStatus.FAILURE);
    expect(blackboard.get("ran_failure")).toBe(1);
    expect(blackboard.get("ran_post")).toBe(1);
    expect(blackboard.get("ran_success")).toBeUndefined();
  });
});
