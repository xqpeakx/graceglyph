export type KeyName =
  | "char"
  | "enter"
  | "escape"
  | "tab"
  | "backspace"
  | "delete"
  | "up"
  | "down"
  | "left"
  | "right"
  | "home"
  | "end"
  | "pageup"
  | "pagedown"
  | "space"
  | "f1" | "f2" | "f3" | "f4" | "f5" | "f6"
  | "f7" | "f8" | "f9" | "f10" | "f11" | "f12";

export interface KeyEvent {
  type: "key";
  name: KeyName;
  /** The printable character if this was a character key. */
  char?: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** Raw bytes that produced this event (for diagnostics and custom bindings). */
  raw: string;
}

export type MouseButton = "left" | "middle" | "right" | "wheel-up" | "wheel-down";

export interface MouseEvent {
  type: "mouse";
  button: MouseButton;
  action: "press" | "release" | "move";
  x: number;
  y: number;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export interface ResizeEvent {
  type: "resize";
  width: number;
  height: number;
}

export type InputEvent = KeyEvent | MouseEvent | ResizeEvent;
