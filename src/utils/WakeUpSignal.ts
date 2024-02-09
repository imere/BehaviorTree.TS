import { type Fn } from ".";
import { Emitter } from "./Emitter";

export class WakeUpSignal extends Emitter<{ signal: [] }> {
  mutex = `${Math.random().toString(16).slice(2, 10)}`;

  private ready = false;

  /** Return true if the timeout was NOT reached and the signal was received */
  async waitFor(ms: number): Promise<boolean> {
    let off: Fn | undefined;
    const ret = await new Promise<boolean>((resolve) => {
      off = this.once("signal", () => resolve(this.ready));
      setTimeout(() => {
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
