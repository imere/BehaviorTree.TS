import { SyncActionNode } from "./ActionNode";
import { TreeFactory } from "./TreeFactory";
import {
  ImplementPorts,
  NodeStatus,
  PortList,
  createInputPort,
  type NodeUserStatus,
} from "./basic";

enum Color {
  Red = 0,
  Blue = 1,
  Green = 2,
  Undefined,
}

@ImplementPorts
class ActionEnum extends SyncActionNode {
  static providedPorts() {
    return new PortList([createInputPort("color")]);
  }

  color = Color.Undefined;

  protected override tick(): NodeUserStatus {
    this.color = this.getInputOrThrow("color", (value, { hints: { remap } }) => {
      return remap ? value : JSON.parse(value);
    });
    return NodeStatus.SUCCESS;
  }
}

describe("Enums", () => {
  test("StrintToEnum", async () => {
    const xml = `
<root BTTS_format="4" >
  <Tree id="Main">
    <Sequence>
      <SetBlackboard value="Red" outputKey="my_color" />
      <ActionEnum name="maybe_blue" color="Blue"/>
      <ActionEnum name="maybe_green" color="2"/>
      <ActionEnum name="maybe_red" color="{my_color}"/>
    </Sequence>
  </Tree>
</root>
  `;

    const factory = new TreeFactory();
    factory.registerNodeType(ActionEnum, "ActionEnum");
    factory.registerScriptingEnums(Color);

    const tree = factory.createTreeFromXML(xml);
    const status = await tree.tickWhileRunning();

    expect(status).toBe(NodeStatus.SUCCESS);

    for (const node of tree.subtrees[0].nodes) {
      if (node instanceof ActionEnum) {
        if (node.name === "maybe_red") expect(node.color).toBe(Color.Red);
        else if (node.name === "maybe_blue") expect(node.color).toBe(Color.Blue);
        else if (node.name === "maybe_green") expect(node.color).toBe(Color.Green);
      }
    }
  });

  test("SwitchNodeWithEnum", async () => {
    const xml = `
<root BTTS_format="4" >
  <Tree id="Main">
    <Sequence>
      <Script code=" my_color = Blue "/>
      <Switch4 variable="{my_color}"
        case_1="Red"
        case_2="Blue"
        case_3="Green"
        case_4="Undefined">
        <AlwaysFailure name="case_red" />
        <AlwaysSuccess name="case_blue" />
        <AlwaysFailure name="case_green" />
        <AlwaysFailure name="case_undefined" />
        <AlwaysFailure name="default_case" />
      </Switch4>
    </Sequence>
  </Tree>
</root>
  `;

    const factory = new TreeFactory();
    factory.registerScriptingEnums(Color);

    const tree = factory.createTreeFromXML(xml);

    expect(tree.tickWhileRunning()).resolves.toBe(NodeStatus.SUCCESS);
  });
});
