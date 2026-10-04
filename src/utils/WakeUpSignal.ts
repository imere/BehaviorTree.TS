import { type Fn } from "./index.js";
import { Emitter } from "./Emitter.js";

export class WakeUpSignal extends Emitter<{ signal: [] }> {
  mutex = `${Math.random().toString(16).slice(2, 10)}`;

  private ready = false;

  /** Return true if the timeout was NOT reached and the signal was received */
  async waitFor(ms: number): Promise<boolean> {
    let off: Fn | undefined;
    const ret = await new Promise<boolean>((resolve) => {
      // a signal that landed before we started waiting would otherwise be lost,
      // and we would sit out the whole timeout
      if (this.ready) {
        resolve(true);
        return;
      }
      off = this.once("signal", () => resolve(true));
      setTimeout(() => {
        off?.();
        resolve(this.ready);
      }, ms);
    });
    off?.();
    this.ready = false;
    return ret;
  }

  emitSignal(): void {
    this.ready = true;
    this.emit("signal");
  }
}
