import { InputEvent } from "../input/keys.js";

export interface ZenEventMap {
  key: InputEvent & { type: "key" };
  mouse: InputEvent & { type: "mouse" };
  resize: InputEvent & { type: "resize" };
  focus: { type: "focus" };
  blur: { type: "blur" };
  [custom: string]: unknown;
}

type Listener<T> = (payload: T) => void;

/**
 * Minimal typed pub/sub. Used for global app-level events; view-level events
 * bubble through the view tree directly rather than going through the bus.
 */
export class EventBus {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  on<K extends string>(event: K, listener: Listener<unknown>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }

  off(event: string, listener: Listener<unknown>): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, payload: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Snapshot so handlers can subscribe/unsubscribe safely mid-emit.
    for (const l of [...set]) l(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
