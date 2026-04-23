import { Rect } from "../layout/rect.js";
import { Button } from "./button.js";
import { Label } from "./label.js";
import { Window } from "./window.js";
import { ViewOptions } from "./view.js";

export interface DialogOptions extends ViewOptions {
  title?: string;
  message: string;
  buttons?: Array<{ label: string; value: string }>;
  onResult?: (value: string) => void;
}

/**
 * Centered modal with a message and one or more action buttons. A simple
 * convenience composition over Window + Label + Button.
 */
export class Dialog extends Window {
  readonly onResult?: (value: string) => void;

  constructor(opts: DialogOptions) {
    const buttons = opts.buttons ?? [{ label: "OK", value: "ok" }];
    super({
      title: opts.title ?? "",
      border: true,
      width: opts.width ?? Math.max(opts.message.length + 6, 30),
      height: opts.height ?? 7,
    });
    this.onResult = opts.onResult;

    this.add(new Label({ x: 2, y: 1, text: opts.message }));

    let bx = 2;
    for (const b of buttons) {
      const btn = new Button({
        x: bx,
        y: 3,
        label: b.label,
        onPress: () => this.onResult?.(b.value),
      });
      this.add(btn);
      bx += b.label.length + 6;
    }
  }

  protected override computeBounds(container: Rect): Rect {
    const w = this.desired.width ?? 30;
    const h = this.desired.height ?? 7;
    const x = container.x + Math.max(0, Math.floor((container.width - w) / 2));
    const y = container.y + Math.max(0, Math.floor((container.height - h) / 2));
    return new Rect(x, y, w, h).intersect(container);
  }
}
