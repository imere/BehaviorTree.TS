import { SyncActionNode } from "../ActionNode";
import { Blackboard } from "../Blackboard";
import { Runtime } from "../Runtime";
import { TreeFactory } from "../TreeFactory";
import { TreeNode } from "../TreeNode";
import {
  NodeStatus,
  PortList,
  createInputPort,
  createOutputPort,
  type NodeUserStatus,
} from "../basic";
import { SaySomething } from "../sample/DummyNodes";
import { registerTestTick } from "../testing/helper";
import {
  Environment,
  createRuntimeExecutor,
  createTreeExecutionContext,
  supportScriptExpression,
} from "./parser";

describe("ParserTest", () => {
  test("Equations", () => {
    const env: Environment = [Blackboard.create(), new Map()];

    const context = createTreeExecutionContext(env);

    const GetResult = (script: string) =>
      Runtime.runInContext(context, supportScriptExpression(script));

    const variables = env[0];

    expect(GetResult("x=3,y=5,x+y")).toBe(8);
    expect(variables.size).toBe(2);
    expect(variables.get("x")).toBe(3);
    expect(variables.get("y")).toBe(5);

    expect(GetResult("x+=1")).toBe(4);
    expect(variables.get("x")).toBe(4);

    expect(GetResult("x+=1")).toBe(5);
    expect(variables.get("x")).toBe(5);

    expect(GetResult("x-=1")).toBe(4);
    expect(variables.get("x")).toBe(4);

    expect(GetResult("x-=1")).toBe(3);
    expect(variables.get("x")).toBe(3);

    expect(GetResult("x*=2")).toBe(6);
    expect(variables.get("x")).toBe(6);

    expect(GetResult("-x")).toBe(-6);

    expect(GetResult("x/=2")).toBe(3);
    expect(variables.get("x")).toBe(3);

    expect(variables.get("y")).toBe(5);
    expect(GetResult("y/2")).toBe(2.5);
    expect(GetResult("y*2")).toBe(10);
    expect(GetResult("y-x")).toBe(2);

    expect(GetResult("y & x")).toBe(5 & 3);
    expect(GetResult("y | x")).toBe(5 | 3);
    expect(GetResult("y ^ x")).toBe(5 ^ 3);

    expect(GetResult("A='hello', B=' ', C='world', A+B+C")).toBe("hello world");
    expect(variables.size).toBe(5);
    expect(variables.get("A")).toBe("hello");
    expect(variables.get("B")).toBe(" ");
    expect(variables.get("C")).toBe("world");

    expect(GetResult("A='   right', B=' center ', C='left    '")).toBeTruthy();

    expect(variables.size).toBe(5);
    expect(variables.get("A")).toBe("   right");
    expect(variables.get("B")).toBe(" center ");
    expect(variables.get("C")).toBe("left    ");
  });

  test("EnumsBasic", () => {
    const environment: Environment = [Blackboard.create(), new Map()];

    const context = createTreeExecutionContext(environment);

    const GetResult = (script: string) =>
      Runtime.runInContext(context, supportScriptExpression(script));

    enum Color {
      RED = 1,
      BLUE = 3,
      GREEN = 5,
    }

    environment[1].set(Color[Color.RED], Color.RED);
    environment[1].set(Color[Color.BLUE], Color.BLUE);
    environment[1].set(Color[Color.GREEN], Color.GREEN);

    GetResult("A=RED");
    GetResult("B=RED");
    GetResult("C=BLUE");

    expect(GetResult("A===B")).toBe(true);
    expect(GetResult("A!==C")).toBe(true);

    expect(GetResult("A")).toBe(Color.RED);
    expect(GetResult("B")).toBe(Color.RED);
    expect(GetResult("C")).toBe(Color.BLUE);
  });

  test("EnumsXML", async () => {
    const factory = new TreeFactory();

    const xml = `
    <root BTTS_format="4" >
        <Tree id="MainTree">
            <Script code = "A=THE_ANSWER; color1=RED; color2=BLUE; color3=GREEN" />
        </Tree>
    </root>
    `;

    enum Color {
      RED,
      BLUE,
      GREEN,
    }

    factory.registerScriptingEnum("THE_ANSWER", 42);
    factory.registerScriptingEnums(Color);

    const tree = factory.createTreeFromXML(xml);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);

    const blackboard = tree.subtrees[0].blackboard;
    expect(blackboard.get("A")).toBe(42);
    expect(blackboard.get("color1")).toBe(Color.RED);
    expect(blackboard.get("color2")).toBe(Color.BLUE);
    expect(blackboard.get("color3")).toBe(Color.GREEN);
  });

  enum DeviceType {
    BATT = 1,
    CONTROLLER = 2,
  }

  function checkLevel(self: TreeNode): NodeUserStatus {
    const percent = self.getInput("percentage", Number)!;
    const devType: any = self.getInputOrThrow("deviceType");

    if (devType === DeviceType.BATT) {
      self.setOutput("isLowBattery", percent < 25);
    }
    return NodeStatus.SUCCESS;
  }

  test("Enums_BehaviorTree.CPPIssue_523", async () => {
    const factory = new TreeFactory();

    const xml = `
    <root BTTS_format="4" >
      <Tree id="PowerManagerT">
        <ReactiveSequence>
          <Script code=" deviceA=BATT; deviceB=CONTROLLER; battery_level=30 "/>
          <CheckLevel deviceType="{deviceA}" percentage="{battery_level}" isLowBattery="{isLowBattery}"/>
          <SaySomething message="FIRST low batteries!" _skipIf="!isLowBattery" />

          <Script code=" battery_level=20 "/>
          <CheckLevel deviceType="{deviceA}" percentage="{battery_level}" isLowBattery="{isLowBattery}"/>
          <SaySomething message="SECOND low batteries!" _skipIf="!isLowBattery" />
        </ReactiveSequence>
      </Tree>
    </root>
    `;

    factory.registerNodeType(SaySomething, SaySomething.name);
    factory.registerSimpleCondition(
      "CheckLevel",
      checkLevel,
      new PortList([
        createInputPort("percentage"),
        createInputPort("deviceType"),
        createOutputPort("isLowBattery"),
      ])
    );

    factory.registerScriptingEnums(DeviceType);

    const tree = factory.createTreeFromXML(xml);
    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);

    const blackboard = tree.subtrees[0].blackboard;
    expect(blackboard.get("deviceA")).toBe(DeviceType.BATT);
    expect(blackboard.get("deviceB")).toBe(DeviceType.CONTROLLER);
    expect(blackboard.get("isLowBattery")).toBe(true);
  });

  class SampleNode595 extends SyncActionNode {
    static providedPorts() {
      return new PortList([createOutputPort("find_enemy")]);
    }

    protected override tick(): NodeUserStatus {
      this.setOutput("find_enemy", 0);
      return NodeStatus.SUCCESS;
    }
  }

  test("BehaviorTree.CPPIssue595", async () => {
    const factory = new TreeFactory();

    const xml = `
    <root BTTS_format="4" >
      <Tree ID="PowerManagerT">
        <Sequence>
          <SampleNode595 find_enemy="{find_enemy}" />
          <TestA _skipIf="find_enemy==0"/>
        </Sequence>
      </Tree>
    </root>
    `;

    const counters = Array.from<number>({ length: 1 });
    registerTestTick(factory, "Test", counters);
    factory.registerNodeType(SampleNode595, SampleNode595.name);

    const tree = factory.createTreeFromXML(xml);
    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters).toEqual([0]);
  });

  test("NewLine", async () => {
    const factory = new TreeFactory();

    const xml = `
    <root BTTS_format="4" >
      <Tree ID="Main">
        <Script code="A=5;&#10;B=6"/>
      </Tree>
    </root>
    `;

    const tree = factory.createTreeFromXML(xml);
    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);

    expect(tree.rootBlackboard!.get("A")).toBe(5);
    expect(tree.rootBlackboard!.get("B")).toBe(6);
  });
});

describe("ScriptParser", () => {
  const BOARD_KEY = "board",
    BOARD_VALUE = "board",
    ENUM_KEY = "enums",
    ENUM_VALUE = "enums";

  let board: Blackboard, execute: (script: string) => unknown;

  beforeEach(() => {
    board = Blackboard.create();
    board.set(BOARD_KEY, BOARD_VALUE);

    execute = (script: string) =>
      createRuntimeExecutor(
        [board, new Map([[ENUM_KEY, ENUM_VALUE]])],
        supportScriptExpression(script)
      )();
  });

  test("Blank", () => {
    expect(execute("   ")).toBe(undefined);
  });

  test("Literals", () => {
    expect(execute("123")).toBe(123);
    expect(execute("'123'")).toBe("123");
  });

  test("Returns", () => {
    expect(execute("return 123")).toBe(123);
  });

  test("Expression", () => {
    expect(execute("123, 456")).toBe(456);
  });

  test("UndefinedSymbol", () => {
    expect(execute("id")).toBe(undefined);
    expect(execute("id=123,id")).toBe(123);
  });

  test("Semicolon", () => {
    expect(execute("123;")).toBe(undefined);
  });

  test("Brackets", () => {
    expect(execute("{123}")).toBe(undefined);
  });

  test("Builtin", () => {
    expect(execute(BOARD_KEY)).toBe(BOARD_VALUE);
    expect(execute(ENUM_KEY)).toBe(ENUM_VALUE);
  });

  test("ImmutableEnum", () => {
    expect(execute(ENUM_KEY)).toBe(ENUM_VALUE);
    expect(execute(`${ENUM_KEY}=123,${ENUM_KEY}`)).toBe(ENUM_VALUE);
  });
});

describe("ScriptExpression", () => {
  test("Blank", () => {
    expect(supportScriptExpression("   ")).toBe("");
  });

  test("Literals", () => {
    expect(supportScriptExpression("123")).toBe("return (123)");
    expect(supportScriptExpression("'123'")).toBe("return ('123')");
  });

  test("Returns", () => {
    expect(supportScriptExpression("return 123")).toBe("return 123");
    expect(supportScriptExpression("return123")).toBe("return (return123)");
  });

  test("Expression", () => {
    expect(supportScriptExpression("123, 456")).toBe("return (123, 456)");
  });

  test("UndefinedSymbol", () => {
    expect(supportScriptExpression("id")).toBe("return (id)");
  });

  test("Semicolon", () => {
    expect(supportScriptExpression("123;")).toBe("123;");
  });

  test("Brackets", () => {
    expect(supportScriptExpression("{123}")).toBe("{123}");
  });
});
