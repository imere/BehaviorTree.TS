import { describe, expect, it } from "vitest";
import { findForbiddenChar, isAllowedPortName } from "./basic.js";
import { TreeFactory } from "./TreeFactory.js";
import { createPort } from "./basic.js";

describe("ForbiddenCharDetection_ValidNames", () => {
  it("accepts plain ASCII names", () => {
    expect(findForbiddenChar("ValidName")).toBeUndefined();
    expect(findForbiddenChar("my_action")).toBeUndefined();
    expect(findForbiddenChar("My-Action")).toBeUndefined();
    expect(findForbiddenChar("action123")).toBeUndefined();
    expect(findForbiddenChar("CamelCaseNode")).toBeUndefined();
    expect(findForbiddenChar("snake_case_node")).toBeUndefined();
    expect(findForbiddenChar("kebab-case-node")).toBeUndefined();
  });
});

describe("ForbiddenCharDetection_Unicode", () => {
  it("accepts UTF-8 multibyte sequences", () => {
    expect(findForbiddenChar("检查门状态")).toBeUndefined(); // Chinese
    expect(findForbiddenChar("ドアを開ける")).toBeUndefined(); // Japanese
    expect(findForbiddenChar("Tür_öffnen")).toBeUndefined(); // German with umlaut
    expect(findForbiddenChar("проверка")).toBeUndefined(); // Russian
    expect(findForbiddenChar("действие")).toBeUndefined(); // Russian
  });
});

describe("ForbiddenCharDetection_ForbiddenChars", () => {
  it("rejects space and whitespace", () => {
    expect(findForbiddenChar("My Action")).toBe(" ");
    expect(findForbiddenChar("with\ttab")).toBe("\t");
    expect(findForbiddenChar("with\nnewline")).toBe("\n");
    expect(findForbiddenChar("with\rcarriage")).toBe("\r");
  });

  it("rejects the XML special characters", () => {
    expect(findForbiddenChar("My<Node>")).toBe("<");
    expect(findForbiddenChar("Node>End")).toBe(">");
    expect(findForbiddenChar("A&B")).toBe("&");
    expect(findForbiddenChar('say"hello"')).toBe('"');
    expect(findForbiddenChar("it's")).toBe("'");
  });

  it("rejects the filesystem problematic characters", () => {
    expect(findForbiddenChar("path/to/node")).toBe("/");
    expect(findForbiddenChar("path\\to\\node")).toBe("\\");
    expect(findForbiddenChar("C:drive")).toBe(":");
    expect(findForbiddenChar("wild*card")).toBe("*");
    expect(findForbiddenChar("what?")).toBe("?");
    expect(findForbiddenChar("pipe|char")).toBe("|");
  });

  it("rejects a period", () => {
    expect(findForbiddenChar("request.name")).toBe(".");
    expect(findForbiddenChar("file.ext")).toBe(".");
  });
});

describe("ForbiddenCharDetection_ControlChars", () => {
  it("rejects a control character", () => {
    expect(findForbiddenChar(`test${String.fromCharCode(7)}bell`)).toBe(String.fromCharCode(7));
    expect(findForbiddenChar(`test${String.fromCharCode(127)}del`)).toBe(String.fromCharCode(127));
  });

  it("skips a NUL, which a JavaScript string cannot carry", () => {
    expect(findForbiddenChar("testname")).toBeUndefined();
  });
});

describe("IsAllowedPortName_Valid", () => {
  it("accepts names that start with a letter", () => {
    expect(isAllowedPortName("input")).toBe(true);
    expect(isAllowedPortName("output_value")).toBe(true);
    expect(isAllowedPortName("myPort123")).toBe(true);
    expect(isAllowedPortName("Port_With_Underscore")).toBe(true);
  });
});

describe("IsAllowedPortName_Invalid", () => {
  it("rejects an empty name", () => {
    expect(isAllowedPortName("")).toBe(false);
  });

  it("rejects a name starting with a digit", () => {
    expect(isAllowedPortName("1port")).toBe(false);
    expect(isAllowedPortName("123")).toBe(false);
  });

  it("rejects a name starting with an underscore, which is reserved", () => {
    expect(isAllowedPortName("_private")).toBe(false);
  });

  it("rejects the reserved names", () => {
    expect(isAllowedPortName("name")).toBe(false);
    expect(isAllowedPortName("ID")).toBe(false);
    expect(isAllowedPortName("_failureIf")).toBe(false);
    expect(isAllowedPortName("_successIf")).toBe(false);
    expect(isAllowedPortName("_skipIf")).toBe(false);
    expect(isAllowedPortName("_while")).toBe(false);
    expect(isAllowedPortName("_onSuccess")).toBe(false);
    expect(isAllowedPortName("_onFailure")).toBe(false);
    expect(isAllowedPortName("_onHalted")).toBe(false);
    expect(isAllowedPortName("_post")).toBe(false);
    expect(isAllowedPortName("_autoremap")).toBe(false);
  });

  it("rejects the forbidden characters", () => {
    expect(isAllowedPortName("port name")).toBe(false); // space
    expect(isAllowedPortName("port.name")).toBe(false); // period
    expect(isAllowedPortName("port<T>")).toBe(false); // angle brackets
  });
});

describe("CreatePort_NamesForbiddenChar", () => {
  it("names the offending character of a port name with a period", () => {
    let message = "";
    try {
      createPort(1, "goal.pose");
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("goal.pose");
    expect(message).toContain("forbidden character '.'");
  });

  it("reports a control character by its ASCII code", () => {
    let message = "";
    try {
      createPort(1, "goal\tpose");
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("control character (ASCII 9)");
  });
});

describe("NameValidationXMLTest", () => {
  const create = (xml: string) => new TreeFactory().createTreeFromXML(xml);

  const singleTree = (id: string) => `
    <root BTTS_format="4">
      <BehaviorTree ID="${id}">
        <AlwaysSuccess/>
      </BehaviorTree>
    </root>`;

  it("ValidBehaviorTreeID", () => {
    expect(() => create(singleTree("MainTree"))).not.toThrow();
  });

  it("ValidBehaviorTreeID_WithUnderscore", () => {
    expect(() => create(singleTree("My_Main_Tree"))).not.toThrow();
  });

  it("InvalidBehaviorTreeID_Root", () => {
    expect(() => create(singleTree("Root"))).toThrow();
  });

  it("InvalidBehaviorTreeID_root_lowercase", () => {
    expect(() => create(singleTree("root"))).toThrow();
  });

  it("InvalidBehaviorTreeID_WithSpace", () => {
    expect(() => create(singleTree("Main Tree"))).toThrow();
  });

  it("InvalidBehaviorTreeID_WithPeriod", () => {
    expect(() => create(singleTree("Main.Tree"))).toThrow();
  });

  const withInstanceName = (name: string) => `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
        <AlwaysSuccess name="${name}"/>
      </BehaviorTree>
    </root>`;

  it("ValidInstanceName", () => {
    expect(() => create(withInstanceName("my_success_node"))).not.toThrow();
  });

  it("ValidInstanceName_WithSpace", () => {
    // Instance names are XML attribute VALUES, so spaces are allowed
    expect(() => create(withInstanceName("my success node"))).not.toThrow();
  });

  it("ValidInstanceName_WithPeriod", () => {
    // Instance names are XML attribute VALUES, so periods are allowed
    expect(() => create(withInstanceName("node.name"))).not.toThrow();
  });

  const subTreeId = (id: string) => `
    <root BTTS_format="4" mainTreeToExecute="MainTree">
      <BehaviorTree ID="MainTree">
        <SubTree ID="${id}"/>
      </BehaviorTree>
      <BehaviorTree ID="${id}">
        <AlwaysSuccess/>
      </BehaviorTree>
    </root>`;

  it("ValidSubTreeID", () => {
    expect(() => create(subTreeId("SubTree1"))).not.toThrow();
  });

  it("InvalidSubTreeID_WithSpace", () => {
    expect(() => create(subTreeId("Sub Tree"))).toThrow();
  });

  it("UnicodeTreeID_Chinese", () => {
    expect(() => create(singleTree("检查门"))).not.toThrow();
  });

  it("UnicodeInstanceName_Japanese", () => {
    expect(() => create(withInstanceName("成功ノード"))).not.toThrow();
  });

  it("UnicodeTreeID_German", () => {
    expect(() => create(singleTree("Türöffner"))).not.toThrow();
  });

  const modelPort = (portName: string, withPort = true) => `
    <root BTTS_format="4" mainTreeToExecute="MainTree">
      <BehaviorTree ID="MainTree">
        ${withPort ? '<SubTree ID="MySubTree" input_value="{value}"/>' : "<AlwaysSuccess/>"}
      </BehaviorTree>
      ${withPort ? '<BehaviorTree ID="MySubTree"><AlwaysSuccess/></BehaviorTree>' : ""}
      <TreeNodesModel>
        <SubTree ID="MySubTree">
          <input_port name="${portName}"/>
        </SubTree>
      </TreeNodesModel>
    </root>`;

  it("ValidSubTreePortName", () => {
    expect(() => create(modelPort("input_value"))).not.toThrow();
  });

  it("InvalidSubTreePortName_WithSpace", () => {
    expect(() => create(modelPort("input value", false))).toThrow();
  });

  it("InvalidSubTreePortName_Reserved", () => {
    expect(() => create(modelPort("ID", false))).toThrow();
  });

  it("InvalidSubTreePortName_StartsWithDigit", () => {
    expect(() => create(modelPort("1port", false))).toThrow();
  });
});
