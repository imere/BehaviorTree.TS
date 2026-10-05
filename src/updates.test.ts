import { describe, expect, it } from "vitest";
import { NodeStatus } from "./basic.js";
import { TreeFactory } from "./TreeFactory.js";
import { registerTestTick } from "./testing/helper.js";

const xmlTextCheck = `

  <root BTTS_format="4" >
    <BehaviorTree ID="Check">
      <Sequence>
        <Fallback>
          <WasEntryUpdated entry="A"/>
          <TestA/>
        </Fallback>

        <SkipUnlessUpdated entry="A">
          <TestB/>
        </SkipUnlessUpdated>

      </Sequence>
    </BehaviorTree>
  </root>`;

function build(body: string[]) {
  const factory = new TreeFactory();
  const counters: number[] = [0, 0, 0, 0];
  registerTestTick(factory, "Test", counters);

  const xml = `
    <root BTTS_format="4" >
      <BehaviorTree ID="Main">
${body.map((l) => `        ${l}`).join("\n")}
      </BehaviorTree>
    </root>`;

  factory.registerTreeFromXML(xmlTextCheck);
  factory.registerTreeFromXML(xml);
  return { tree: factory.createTree("Main"), counters };
}

describe("EntryUpdates", () => {
  it("NoEntry", async () => {
    const { tree, counters } = build([
      `<Sequence>`,
      `  <SubTree ID="Check" _autoremap="true"/>`,
      `</Sequence>`,
    ]);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(1); // fallback!
    expect(counters[1]).toBe(0); // skipped
  });

  it("Initialized", async () => {
    const { tree, counters } = build([
      `<Sequence>`,
      `  <Script code="A=1;B=1"/>`,
      `  <SubTree ID="Check" _autoremap="true"/>`,
      `</Sequence>`,
    ]);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(0); // fallback!
    expect(counters[1]).toBe(1); // skipped
  });

  it("UpdateOnce", async () => {
    const { tree, counters } = build([
      `<Sequence>`,
      `  <Script code="A=1"/>`,
      `  <Repeat num_cycles="2" >`,
      `    <SubTree ID="Check" _autoremap="true"/>`,
      `  </Repeat>`,
      `</Sequence>`,
    ]);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(1); // fallback!
    expect(counters[1]).toBe(1); // skipped
  });

  it("UpdateTwice", async () => {
    const { tree, counters } = build([
      `<Repeat num_cycles="2" >`,
      `  <Sequence>`,
      `    <Script code="A=1"/>`,
      `    <SubTree ID="Check" _autoremap="true"/>`,
      `  </Sequence>`,
      `</Repeat>`,
    ]);

    expect(await tree.tickWhileRunning()).toBe(NodeStatus.SUCCESS);
    expect(counters[0]).toBe(0); // fallback!
    expect(counters[1]).toBe(2); // skipped
  });
});
