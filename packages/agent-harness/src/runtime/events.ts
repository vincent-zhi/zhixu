import type { HarnessEvent } from "../types.js";

export type HarnessEventCallback = (event: HarnessEvent) => void;

export class HarnessEventEmitter {
  private readonly callbacks: HarnessEventCallback[] = [];

  on(callback: HarnessEventCallback): void {
    this.callbacks.push(callback);
  }

  emit(event: HarnessEvent): void {
    for (const cb of this.callbacks) {
      try {
        cb(event);
      } catch {
        // swallow callback errors to protect the executor loop
      }
    }
  }
}
