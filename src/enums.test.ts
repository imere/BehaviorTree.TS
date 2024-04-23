import { SyncActionNode } from "./ActionNode";
import { ConditionNode } from "./ConditionNode";
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

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
  });

  enum BatteryStatus {
    NO_FAULT,
    LOW_BATTERY,
  }

  class PrintEnum extends ConditionNode {
    static providedPorts(): PortList {
      return new PortList([createInputPort("enum")]);
    }

    protected override tick(): NodeUserStatus {
      const enumValue = this.getInput<BatteryStatus>("enum");
      if (enumValue === undefined) return NodeStatus.FAILURE;
      return NodeStatus.SUCCESS;
    }
  }

  class IsHealthOk extends ConditionNode {
    static providedPorts(): PortList {
      return new PortList([createInputPort("check_name"), createInputPort("health")]);
    }

    protected override tick(): NodeUserStatus {
      const health = this.getInput<BatteryStatus>("health", (_) => JSON.parse(_));
      if (health === undefined) return NodeStatus.FAILURE;

      if (health) return NodeStatus.SUCCESS;
      else return NodeStatus.FAILURE;
    }
  }

  test("SubtreeRemapping", async () => {
    const xml = `
    <root BTTS_format="4">
      <Tree id="MainTree">
        <Sequence>
          <Script code=" fault_status = NO_FAULT " />
          <PrintEnum enum="{fault_status}"/>
          <Subtree id="FailsafeCheck"
            health="false"
            trigger_fault_status="LOW_BATTERY"
            fault_status="{=}" />
          <PrintEnum enum="{fault_status}"/>
        </Sequence>
      </Tree>

      <Tree id="FailsafeCheck">
        <ForceSuccess>
          <IsHealthOk
              health="{health}"
              _onFailure="fault_status = trigger_fault_status"/>
        </ForceSuccess>
      </Tree>
    </root>
    `;

    const factory = new TreeFactory();
    factory.registerScriptingEnums(BatteryStatus);
    factory.registerNodeType(PrintEnum, PrintEnum.name);
    factory.registerNodeType(IsHealthOk, IsHealthOk.name);

    factory.registerTreeFromXML(xml);

    const tree = factory.createTree("MainTree");

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(tree.rootBlackboard!.get("fault_status")).toBe(BatteryStatus.LOW_BATTERY);
  });
});
