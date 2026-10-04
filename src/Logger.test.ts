import { describe, expect, it } from "vitest";
import { TreeFactory } from "./TreeFactory.js";
import {
  debug,
  error,
  getLogLevel,
  info,
  setLogLevel,
  setLogSink,
  warn,
  type LogRecord,
} from "./Logger.js";

describe("Logger", () => {
  function capture() {
    const records: LogRecord[] = [];
    const previousSink = setLogSink((record) => records.push(record));
    const previousLevel = getLogLevel();
    return {
      records,
      restore: () => {
        setLogSink(previousSink);
        setLogLevel(previousLevel);
      },
    };
  }

  it("forwards records at or above the threshold", () => {
    const { records, restore } = capture();
    try {
      setLogLevel("warn");
      debug("d");
      info("i");
      warn("w");
      error("e");
      expect(records.map((r) => r.level)).toEqual(["warn", "error"]);
    } finally {
      restore();
    }
  });

  it("captures everything at debug level", () => {
    const { records, restore } = capture();
    try {
      setLogLevel("debug");
      debug("d");
      info("i");
      warn("w");
      error("e");
      expect(records.map((r) => r.level)).toEqual(["debug", "info", "warn", "error"]);
    } finally {
      restore();
    }
  });

  it("lets a sink redirect records away from the console", () => {
    const { records, restore } = capture();
    try {
      setLogLevel("info");
      const tree = new TreeFactory();
      const xml = `
        <root BTTS_format="4" mainTreeToExecute="MainTree">
          <BehaviorTree ID="MainTree">
            <AlwaysSuccess/>
          </BehaviorTree>
        </root>
      `;
      tree.registerTreeFromXML(xml);
      // createTreeFromXML after registering warns; the sink should capture it
      tree.createTreeFromXML(xml);
      expect(records.some((r) => r.level === "warn")).toBe(true);
    } finally {
      restore();
    }
  });
});
