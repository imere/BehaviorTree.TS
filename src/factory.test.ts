import { Parser } from "./Parser.js";
import { TreeFactory } from "./TreeFactory.js";
import { Metadata, NodeStatus } from "./basic.js";
import { SaySomething } from "./sample/DummyNodes.js";

function makeTestMetadata(): Metadata {
  return new Metadata([
    ["foo", "hello"],
    ["bar", "42"],
  ]);
}

describe("BehaviorTreeFactory", () => {
  test("BehaviorTree.CPPIssue7", () => {
    const xml = `
      <root BTTS_format="4">
        <BehaviorTree ID="ReceiveGuest">
        </BehaviorTree>
      </root>
    `;
    const factory = new TreeFactory();
    const parser = new Parser(factory);
    expect(() => parser.loadFromXML(xml)).toThrow();
  });

  test("BehaviorTree.CPPIssue931_NotRegisteredNode", () => {
    const xml = `
      <root BTTS_format="4">
        <BehaviorTree ID="MainTree">
          <Fallback name="root_selector">
            <IsDoorOpen/>
          </Fallback>
        </BehaviorTree>
      </root>
    `;
    const factory = new TreeFactory();
    const parser = new Parser(factory);
    expect(() => parser.loadFromXML(xml)).toThrow(/Node not recognized/);
    expect(() => new Parser(factory).loadFromXML(xml)).toThrow(/Node not recognized/);
  });

  test("WrongTreeName", () => {
    const xml = `
      <root BTTS_format="4">
        <BehaviorTree ID="MainTree">
          <AlwaysSuccess/>
        </BehaviorTree>
      </root>
    `;
    const factory = new TreeFactory();
    factory.registerTreeFromXML(xml);
    expect(() => factory.createTree("Wrong Name")).toThrow();
  });

  test("addMetadataToManifest", () => {
    const factory = new TreeFactory();
    factory.registerNodeType(SaySomething, SaySomething.name);
    const initialManifest = factory.manifests.get(SaySomething.name);
    expect(initialManifest!.metadata.size).toBe(0);
    factory.addMetadataToManifest(SaySomething.name, makeTestMetadata());
    const modifiedManifest = factory.manifests.get(SaySomething.name);
    expect(modifiedManifest!.metadata).toEqual(makeTestMetadata());
  });
});

describe("BehaviorTreeReload", () => {
  test("ReloadSameTree", async () => {
    const xmlA = `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
        <AlwaysSuccess/>
      </BehaviorTree>
    </root>
  `;
    const xmlB = `
    <root BTTS_format="4">
      <BehaviorTree ID="MainTree">
        <AlwaysFailure/>
      </BehaviorTree>
    </root>
  `;
    const factory = new TreeFactory();

    factory.registerTreeFromXML(xmlA);
    {
      const tree = factory.createTree("MainTree");

      expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    }

    factory.registerTreeFromXML(xmlB);
    {
      const tree = factory.createTree("MainTree");

      expect(await tree.tickWhileRunning()).toBe(NodeStatus.FAILURE);
    }
  });
});
