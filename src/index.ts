import "./jsx.js";

// -- Public API ---------------------------------------------------------------
export { h, Fragment } from "./runtime/element.js";
export type {
  AccessibilityProps,
  BoxProps,
  BoxBreakpointPatch,
  BoxBreakpoints,
  BoxLayoutProps,
  BoxStyle,
  ComponentFn,
  DisplayMode,
  DockPosition,
  Edges,
  FlexAlign,
  FlexDirection,
  FlexJustify,
  GridLine,
  GridTrackList,
  GridTrackSize,
  HostType,
  InputProps,
  LayoutMode,
  PositionMode,
  StyleLike,
  StyleResolver,
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
  useFrame,
  useMotion,
  useSetTheme,
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
  Badge,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Column,
  Divider,
  Kbd,
  Link,
  List,
  Modal,
  NumberInput,
  Panel,
  PasswordInput,
  ProgressBar,
  RadioGroup,
  RangeSlider,
  Row,
  Select,
  Skeleton,
  Slider,
  Spacer,
  Sparkline,
  Spinner,
  SPINNER_FRAMES,
  Switch,
  Tag,
  Text,
  TextArea,
  TextInput,
  ToggleButton,
  Window,
} from "./components.js";
export type {
  BadgeProps,
  BadgeVariant,
  ButtonGroupProps,
  ButtonProps,
  CheckboxProps,
  DividerProps,
  KbdProps,
  LinkProps,
  ListProps,
  ModalProps,
  NumberInputProps,
  PanelProps,
  PasswordInputProps,
  ProgressBarProps,
  RadioGroupProps,
  RadioOption,
  RangeSliderProps,
  SelectOption,
  SelectProps,
  SkeletonProps,
  SliderProps,
  SparklineProps,
  SpinnerProps,
  SpinnerVariant,
  SwitchProps,
  TagProps,
  TextInputProps,
  ToggleButtonProps,
  WindowProps,
} from "./components.js";

export {
  Accordion,
  EmptyState,
  Pagination,
  Stepper,
  Table,
  Tooltip,
  Tree,
} from "./components-data.js";
export type {
  AccordionItem,
  AccordionProps,
  EmptyStateProps,
  PaginationProps,
  StepperProps,
  StepperStep,
  TableColumn,
  TableProps,
  TableSortDirection,
  TableSortState,
  TooltipPlacement,
  TooltipProps,
  TreeNode,
  TreeProps,
} from "./components-data.js";

export { Code, DiffView, JSONViewer, LogStream, parseUnifiedDiff } from "./components-viz.js";
export type {
  CodeProps,
  DiffLine,
  DiffLineKind,
  DiffViewProps,
  JSONViewerProps,
  LogEntry,
  LogLevel,
  LogStreamProps,
} from "./components-viz.js";
export type { CodeLanguage, CodeToken, CodeTokenKind } from "./highlight/index.js";
export { highlight, tokensByLine } from "./highlight/index.js";

export {
  Avatar,
  BottomBar,
  Card,
  Chip,
  IconButton,
  KeyHints,
  Notifications,
  Pill,
  ProgressRing,
  Sidebar,
  StatusBar,
  TopBar,
} from "./components-chrome.js";
export type {
  AvatarProps,
  CardProps,
  ChipProps,
  IconButtonProps,
  KeyHint,
  KeyHintsProps,
  NotificationItem,
  NotificationKind,
  NotificationsProps,
  PillProps,
  ProgressRingProps,
  SlotProps,
  StatusBarProps,
} from "./components-chrome.js";

export {
  Autocomplete,
  Combobox,
  ErrorBoundary,
  ErrorMessage,
  Form,
  FormField,
  MaskedInput,
  MultiSelect,
  Suspense,
  Wizard,
} from "./components-forms.js";
export type {
  AutocompleteProps,
  ComboboxOption,
  ComboboxProps,
  ErrorBoundaryProps,
  ErrorMessageProps,
  FormFieldProps,
  FormProps,
  MaskedInputProps,
  MultiSelectOption,
  MultiSelectProps,
  SuspenseProps,
  WizardProps,
  WizardStep,
} from "./components-forms.js";

export { Calendar, DatePicker, TimePicker } from "./components-temporal.js";
export type { CalendarProps, DatePickerProps, TimePickerProps } from "./components-temporal.js";

export { autoDomain, BarChart, Gauge, Heatmap, Histogram, LineChart } from "./components-charts.js";
export type {
  AxisDomain,
  BarChartProps,
  BarDatum,
  GaugeProps,
  HeatmapProps,
  HistogramProps,
  LineChartProps,
  LineSeries,
} from "./components-charts.js";

export { Markdown, parseMarkdown } from "./components-markdown.js";
export type { MarkdownProps } from "./components-markdown.js";

export { FilePicker, PathBreadcrumbs } from "./components-files.js";
export type {
  FileEntry,
  FilePickerProps,
  PathBreadcrumbsProps,
} from "./components-files.js";

export {
  AsciiArt,
  Banner,
  BigText,
  SplashScreen,
  figletBlock,
} from "./components-ascii.js";
export type {
  AsciiArtProps,
  BannerProps,
  BigTextProps,
  SplashScreenProps,
} from "./components-ascii.js";

export { Stream, Transition } from "./components-motion.js";
export type {
  StreamProps,
  TransitionPreset,
  TransitionProps,
} from "./components-motion.js";
export {
  createMotion,
  easings,
  motion,
  spring,
} from "./runtime/motion.js";
export type {
  Easing,
  EasingName,
  MotionHandle,
  MotionOptions,
  SpringOptions,
} from "./runtime/motion.js";
export {
  frameSchedulerActive,
  frameSubscriberCount,
  subscribeFrame,
} from "./runtime/frame.js";
export type { FrameCallback } from "./runtime/frame.js";

export { createPluginRegistry, definePlugin } from "./plugin.js";
export type {
  GraceglyphPlugin,
  PluginContext,
  PluginMiddleware,
  PluginRegistry,
  PluginRenderInfo,
} from "./plugin.js";

export { DataGrid, Popover } from "./components-overlay.js";
export type {
  DataGridColumn,
  DataGridProps,
  PopoverPlacement,
  PopoverProps,
} from "./components-overlay.js";

export {
  AppShell,
  Breadcrumbs,
  canNavigateRoute,
  CommandPalette,
  Dock,
  DockSlot,
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
  resolveDeepLinkPath,
  resolveDeepLinkPathFromArgv,
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
  CommandRegistrationOptions,
  CommandPaletteProps,
  DockProps,
  DockSlotProps,
  GridProps,
  HelpOverlayProps,
  HotkeyOptions,
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
export { css, isStyleRule, style, StyleRule } from "./style/index.js";
export type {
  StyledBoxProps,
  StyleBreakpoint,
  StyleResolveContext,
  StyleState,
} from "./style/index.js";
export { stringWidth } from "./render/unicode.js";
export type { BorderPreset, BuiltInThemeName, Theme, ThemeTokens } from "./theme/theme.js";
export { builtInThemes, darkTheme, defaultTheme, getTheme, themeNames } from "./theme/theme.js";
export type { BreakpointComparator, BreakpointMap, BreakpointQuery } from "./theme/breakpoints.js";
export { matchesBreakpoint, resolveBreakpointMap } from "./theme/breakpoints.js";
export type { Capabilities, CapabilityOverrides, ColorDepth } from "./render/capabilities.js";
export { detectCapabilities, DUMB_CAPABILITIES, FULL_CAPABILITIES } from "./render/capabilities.js";
export { parseColor, downgrade, rgbToAnsi16, rgbToAnsi256 } from "./render/color.js";
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
  snapshotTerminalAnsi,
  snapshotTerminalFrame,
} from "./testing.js";
export type {
  KeyboardFlowOptions,
  MouseFlowEvent,
  RenderTestAppOptions,
  TestApp,
} from "./testing.js";
