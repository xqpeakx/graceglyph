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
  useCapabilities,
  useTerminalSize,
  useTheme,
} from "./runtime/hooks.js";

// Reactive primitives (signal-based authoring path; see ADR-0001).
export {
  batch,
  createEffect,
  createMemo,
  createResource,
  createRoot,
  createSignal,
  onCleanup,
  untrack,
} from "./reactive/index.js";
export type {
  Accessor,
  Resource,
  ResourceFetcherInfo,
  ResourceOptions,
  ResourceState,
  Setter,
  SignalOptions,
} from "./reactive/index.js";

// Built-in components
export {
  App,
  Box,
  Button,
  Column,
  Link,
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
  LinkProps,
  ListProps,
  ModalProps,
  PanelProps,
  TextInputProps,
  WindowProps,
} from "./components.js";

export {
  AppShell,
  Breadcrumbs,
  CommandPalette,
  Grid,
  HelpOverlay,
  Router,
  Route,
  ScrollView,
  SplitPane,
  Stack,
  Tabs,
  ToastViewport,
  registerCommand,
  useAsync,
  useClipboard,
  useCommand,
  useCommands,
  useDebouncedValue,
  useFocusWithin,
  useHotkeys,
  useInterval,
  useMouse,
  usePersistentState,
} from "./app-shell.js";
export type {
  AppShellProps,
  AsyncState,
  BreadcrumbItem,
  Command,
  CommandPaletteProps,
  HelpOverlayProps,
  MouseState,
  RouteProps,
  RouterProps,
  TabItem,
  TabsProps,
  ToastMessage,
} from "./app-shell.js";

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
export type {
  Capabilities,
  CapabilityOverrides,
  ColorDepth,
} from "./render/capabilities.js";
export {
  detectCapabilities,
  DUMB_CAPABILITIES,
  FULL_CAPABILITIES,
} from "./render/capabilities.js";
export {
  parseColor,
  downgrade,
  rgbToAnsi16,
  rgbToAnsi256,
} from "./render/color.js";
export type { ColorInput } from "./render/color.js";

export {
  TestInput,
  TestOutput,
  assertNoLayoutWarnings,
  collectLayoutWarnings,
  keySequence,
  mouseSequence,
  renderTestApp,
  settle,
  snapshotTerminalFrame,
} from "./testing.js";
export type {
  KeyboardFlowOptions,
  MouseFlowEvent,
  RenderTestAppOptions,
  TestApp,
} from "./testing.js";
