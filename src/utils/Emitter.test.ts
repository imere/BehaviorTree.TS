import { Emitter } from "./Emitter.js";

type Events = { signal: []; tick: [number] };

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Emitter", () => {
  test("on() disposer removes only its own listener", async () => {
    const emitter = new Emitter<Events>();
    const calls: string[] = [];

    const offA = emitter.on("tick", (n) => calls.push(`a${n}`));
    emitter.on("tick", (n) => calls.push(`b${n}`));

    offA();
    await emitter.emit("tick", 1);

    expect(calls).toEqual(["b1"]);
  });

  test("once() fires at most once", async () => {
    const emitter = new Emitter<Events>();
    let count = 0;

    emitter.once("signal", () => count++);
    await emitter.emit("signal");
    await emitter.emit("signal");
    await flush();

    expect(count).toBe(1);
  });

  test("once() disposer removes the once-listener, not a sibling", async () => {
    const emitter = new Emitter<Events>();
    const calls: string[] = [];

    const offOnce = emitter.once("signal", () => calls.push("once"));
    emitter.on("signal", () => calls.push("persistent"));

    offOnce();
    await emitter.emit("signal");

    expect(calls).toEqual(["persistent"]);
    expect(emitter.getListeners("signal")).toHaveLength(1);
  });

  test("two once() disposers do not clobber each other", async () => {
    const emitter = new Emitter<Events>();
    const calls: string[] = [];

    const off1 = emitter.once("signal", () => calls.push("one"));
    emitter.once("signal", () => calls.push("two"));

    off1();
    await emitter.emit("signal");

    expect(calls).toEqual(["two"]);
  });

  test("off() with an unregistered listener leaves the list intact", async () => {
    const emitter = new Emitter<Events>();
    const calls: string[] = [];

    emitter.on("tick", (n) => calls.push(`a${n}`));
    emitter.on("tick", (n) => calls.push(`b${n}`));

    emitter.off("tick", () => undefined);
    await emitter.emit("tick", 1);

    expect(calls).toEqual(["a1", "b1"]);
  });

  test("off() with no function clears the whole event", async () => {
    const emitter = new Emitter<Events>();
    const calls: string[] = [];

    emitter.on("signal", () => calls.push("x"));
    emitter.on("signal", () => calls.push("y"));

    emitter.off("signal");
    await emitter.emit("signal");

    expect(calls).toEqual([]);
  });

  test("emitting an event with no listeners is a no-op", async () => {
    const emitter = new Emitter<Events>();

    await expect(emitter.emit("signal")).resolves.toBeUndefined();
  });
});
