import "./jsx.js";

// -- Public API ---------------------------------------------------------------
export { h, Fragment } from "./runtime/element.js";
export type {
  BoxProps,
  BoxStyle,
  ComponentFn,
  Edges,
  FlexAlign,
  FlexDirection,
  FlexJustify,
  HostType,
  InputProps,
  TextAreaProps,
  TextProps,
  ZenElement,
  ZenNode,
} from "./runtime/element.js";

export { render } from "./runtime/render.js";
export type { RenderHandle } from "./runtime/render.js";
export type { RuntimeOptions } from "./runtime/runtime.js";

export {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useTerminalSize,
  useTheme,
} from "./runtime/hooks.js";

// Built-in components
export {
  App,
  Box,
  Button,
  Column,
  List,
  Modal,
  Panel,
  Row,
  Spacer,
  Text,
  TextArea,
  TextInput,
  Window,
} from "./components.js";
export type {
  ButtonProps,
  ListProps,
  ModalProps,
  PanelProps,
  TextInputProps,
  WindowProps,
} from "./components.js";

// Input types (for consumer event handlers)
export type {
  InputEvent,
  KeyEvent,
  MouseEvent,
  ResizeEvent,
  KeyName,
  MouseButton,
} from "./input/keys.js";

// Low-level escape hatches — same primitives used internally
export { Runtime } from "./runtime/runtime.js";
export { Terminal } from "./core/terminal.js";
export type { TerminalOptions } from "./core/terminal.js";
export { Renderer } from "./render/renderer.js";
export { ScreenBuffer } from "./render/buffer.js";
export { Rect } from "./layout/rect.js";
export type { Point, Size } from "./layout/rect.js";
export * from "./render/style.js";
export { stringWidth } from "./render/unicode.js";
export type { Theme } from "./theme/theme.js";
export { defaultTheme, darkTheme } from "./theme/theme.js";
