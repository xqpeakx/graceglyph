import { h } from "./runtime/element.js";
import type {
  AccessibilityProps,
  BoxProps,
  StyleLike,
  TextProps,
  ZenElement,
} from "./runtime/element.js";
import type { KeyEvent } from "./input/keys.js";
import { useEffect, useState, useTheme } from "./runtime/hooks.js";
import { style as styleRule } from "./style/index.js";
import { Button, Checkbox, TextInput } from "./components.js";
import { Stepper } from "./components-data.js";
import type { StepperStep } from "./components-data.js";

function mergeBoxStyle(base: StyleLike, override?: StyleLike): StyleLike {
  return override ? styleRule.merge(base, override) : base;
}

function accessibleText(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

// -- <Combobox> --------------------------------------------------------------
export interface ComboboxOption<T extends string | number = string> {
  value: T;
  label: string;
}

export interface ComboboxProps<T extends string | number = string> extends AccessibilityProps {
  options: readonly ComboboxOption<T>[];
  value: T | null;
  onChange: (next: T) => void;
  /** Substring-filter the dropdown by user query. Defaults to true. */
  filter?: boolean;
  placeholder?: string;
  width?: number;
  dropdownHeight?: number;
  disabled?: boolean;
  style?: StyleLike;
  focusedStyle?: StyleLike;
  disabledStyle?: StyleLike;
}

export function Combobox<T extends string | number = string>(props: ComboboxProps<T>): ZenElement {
  const theme = useTheme();
  const filterEnabled = props.filter !== false;
  const initialQuery = props.options.find((o) => o.value === props.value)?.label ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const dropdownHeight = Math.max(1, props.dropdownHeight ?? 6);
  const triggerWidth = props.width ?? 22;

  const matches = filterEnabled
    ? props.options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : [...props.options];

  function pick(index: number): void {
    const option = matches[index];
    if (!option) return;
    props.onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  const trigger = h(TextInput, {
    value: query,
    onChange: (next: string) => {
      setQuery(next);
      setOpen(true);
      setHighlight(0);
    },
    onSubmit: () => pick(highlight),
    onFocus: () => setOpen(true),
    onBlur: () => {
      // Defer close so onClick on a row can land first.
      setTimeout(() => setOpen(false), 0);
    },
    placeholder: props.placeholder ?? "Type to search",
    width: triggerWidth,
    disabled: props.disabled,
    accessibilityLabel: props.accessibilityLabel,
    accessibilityDescription: props.accessibilityDescription,
    style: mergeBoxStyle(theme.input.normal, props.style),
    focusedStyle: mergeBoxStyle(theme.input.focused, props.focusedStyle),
  } as Record<string, unknown>);

  if (!open || matches.length === 0) {
    return h(
      "box",
      {
        direction: "column",
        width: triggerWidth,
        onKey: (ev: KeyEvent): boolean | void => {
          if (props.disabled) return false;
          if (ev.name === "down" || (ev.name === "char" && ev.char === " ")) {
            setOpen(true);
            return true;
          }
          if (ev.name === "escape") {
            setOpen(false);
            return true;
          }
          return false;
        },
      } as BoxProps,
      trigger,
    );
  }

  const dropdown = h(
    "box",
    {
      position: "absolute",
      top: 1,
      left: 0,
      width: triggerWidth,
      height: Math.min(dropdownHeight, matches.length) + 2,
      border: true,
      direction: "column",
      zIndex: 50,
      style: theme.window.body,
      borderStyle: theme.window.frame,
    } as BoxProps,
    matches.slice(0, dropdownHeight).map((option, index) =>
      h(
        "box",
        {
          key: String(option.value),
          height: 1,
          padding: [0, 1],
          onClick: () => pick(index),
          style: index === highlight ? theme.list.selected : theme.list.normal,
        } as BoxProps,
        h("text", {} as TextProps, option.label),
      ),
    ),
  );

  return h(
    "box",
    {
      direction: "column",
      width: triggerWidth,
      onKey: (ev: KeyEvent): boolean | void => {
        if (props.disabled) return false;
        if (ev.name === "escape") {
          setOpen(false);
          return true;
        }
        if (ev.name === "down") {
          setHighlight((h) => Math.min(matches.length - 1, h + 1));
          return true;
        }
        if (ev.name === "up") {
          setHighlight((h) => Math.max(0, h - 1));
          return true;
        }
        if (ev.name === "enter") {
          pick(highlight);
          return true;
        }
        return false;
      },
    } as BoxProps,
    [trigger, dropdown],
  );
}

// -- <Autocomplete> ----------------------------------------------------------
export interface AutocompleteProps extends AccessibilityProps {
  value: string;
  onChange: (next: string) => void;
  /** Source of suggestions for the current query. */
  suggestions: (query: string) => readonly string[];
  placeholder?: string;
  width?: number;
  dropdownHeight?: number;
  disabled?: boolean;
  /** Fire onSelect when the user picks a suggestion. */
  onSelect?: (suggestion: string) => void;
  style?: StyleLike;
  focusedStyle?: StyleLike;
}

export function Autocomplete(props: AutocompleteProps): ZenElement {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const dropdownHeight = Math.max(1, props.dropdownHeight ?? 6);
  const triggerWidth = props.width ?? 22;
  const matches = props.value.length === 0 ? [] : props.suggestions(props.value);

  function pick(index: number): void {
    const suggestion = matches[index];
    if (!suggestion) return;
    props.onChange(suggestion);
    props.onSelect?.(suggestion);
    setOpen(false);
  }

  const trigger = h(TextInput, {
    value: props.value,
    onChange: (next: string) => {
      props.onChange(next);
      setOpen(true);
      setHighlight(0);
    },
    onSubmit: () => pick(highlight),
    onFocus: () => setOpen(true),
    placeholder: props.placeholder,
    width: triggerWidth,
    disabled: props.disabled,
    accessibilityLabel: props.accessibilityLabel,
    accessibilityDescription: props.accessibilityDescription,
    style: mergeBoxStyle(theme.input.normal, props.style),
    focusedStyle: mergeBoxStyle(theme.input.focused, props.focusedStyle),
  } as Record<string, unknown>);

  if (!open || matches.length === 0) {
    return h("box", { direction: "column", width: triggerWidth } as BoxProps, trigger);
  }

  const dropdown = h(
    "box",
    {
      position: "absolute",
      top: 1,
      left: 0,
      width: triggerWidth,
      height: Math.min(dropdownHeight, matches.length) + 2,
      border: true,
      direction: "column",
      zIndex: 50,
      style: theme.window.body,
      borderStyle: theme.window.frame,
    } as BoxProps,
    matches.slice(0, dropdownHeight).map((suggestion, index) =>
      h(
        "box",
        {
          key: suggestion,
          height: 1,
          padding: [0, 1],
          onClick: () => pick(index),
          style: index === highlight ? theme.list.selected : theme.list.normal,
        } as BoxProps,
        h("text", {} as TextProps, suggestion),
      ),
    ),
  );

  return h(
    "box",
    {
      direction: "column",
      width: triggerWidth,
      onKey: (ev: KeyEvent): boolean | void => {
        if (props.disabled) return false;
        if (ev.name === "escape") {
          setOpen(false);
          return true;
        }
        if (ev.name === "down") {
          setHighlight((h) => Math.min(matches.length - 1, h + 1));
          return true;
        }
        if (ev.name === "up") {
          setHighlight((h) => Math.max(0, h - 1));
          return true;
        }
        if (ev.name === "enter") {
          pick(highlight);
          return true;
        }
        return false;
      },
    } as BoxProps,
    [trigger, dropdown],
  );
}

// -- <MultiSelect> -----------------------------------------------------------
export interface MultiSelectOption<T extends string | number = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface MultiSelectProps<T extends string | number = string> extends AccessibilityProps {
  options: readonly MultiSelectOption<T>[];
  value: readonly T[];
  onChange: (next: readonly T[]) => void;
  width?: number;
  dropdownHeight?: number;
  disabled?: boolean;
  placeholder?: string;
  /** Limit to a max number of selections. */
  max?: number;
  style?: StyleLike;
  focusedStyle?: StyleLike;
}

export function MultiSelect<T extends string | number = string>(
  props: MultiSelectProps<T>,
): ZenElement {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const triggerWidth = props.width ?? 24;
  const dropdownHeight = Math.max(1, props.dropdownHeight ?? 6);
  const selectedSet = new Set(props.value);

  function toggle(option: MultiSelectOption<T>): void {
    if (option.disabled) return;
    if (selectedSet.has(option.value)) {
      props.onChange(props.value.filter((v) => v !== option.value));
      return;
    }
    if (props.max != null && props.value.length >= props.max) return;
    props.onChange([...props.value, option.value]);
  }

  const triggerLabel =
    props.value.length === 0
      ? (props.placeholder ?? "Select…")
      : props.value.length <= 2
        ? props.options
            .filter((o) => selectedSet.has(o.value))
            .map((o) => o.label)
            .join(", ")
        : `${props.value.length} selected`;

  const trigger = h(
    "box",
    {
      focusable: !props.disabled,
      disabled: props.disabled,
      border: true,
      padding: [0, 1],
      direction: "row",
      width: triggerWidth,
      accessibilityLabel: props.accessibilityLabel ?? triggerLabel,
      accessibilityDescription: props.accessibilityDescription,
      onClick: props.disabled ? undefined : () => setOpen((v) => !v),
      onKey: (ev: KeyEvent): boolean | void => {
        if (props.disabled) return false;
        if (!open && (ev.name === "enter" || ev.name === "space" || ev.name === "down")) {
          setOpen(true);
          return true;
        }
        if (open && ev.name === "escape") {
          setOpen(false);
          return true;
        }
        if (open && ev.name === "down") {
          setHighlight((h) => Math.min(props.options.length - 1, h + 1));
          return true;
        }
        if (open && ev.name === "up") {
          setHighlight((h) => Math.max(0, h - 1));
          return true;
        }
        if (open && (ev.name === "enter" || ev.name === "space")) {
          const option = props.options[highlight];
          if (option) toggle(option);
          return true;
        }
        return false;
      },
      style: mergeBoxStyle(theme.input.normal, props.style),
      focusedStyle: mergeBoxStyle(theme.input.focused, props.focusedStyle),
    } as BoxProps,
    [
      h("text", { wrap: "truncate", grow: 1 } as unknown as TextProps, triggerLabel),
      h("text", {} as TextProps, ` ${open ? "▲" : "▼"}`),
    ],
  );

  if (!open) return trigger;

  const dropdown = h(
    "box",
    {
      position: "absolute",
      top: 3,
      left: 0,
      width: triggerWidth,
      height: dropdownHeight + 2,
      border: true,
      direction: "column",
      zIndex: 50,
      style: theme.window.body,
      borderStyle: theme.window.frame,
    } as BoxProps,
    props.options.slice(0, dropdownHeight).map((option, index) =>
      h(
        "box",
        {
          key: String(option.value),
          height: 1,
          padding: [0, 1],
          onClick: () => toggle(option),
          style: index === highlight ? theme.list.selected : theme.list.normal,
        } as BoxProps,
        h(
          "text",
          {} as TextProps,
          `${selectedSet.has(option.value) ? "[x]" : "[ ]"} ${option.label}`,
        ),
      ),
    ),
  );

  return h("box", { direction: "column", width: triggerWidth } as BoxProps, [trigger, dropdown]);
}

// -- <MaskedInput> -----------------------------------------------------------
export interface MaskedInputProps extends AccessibilityProps {
  /** The mask. `#` accepts a digit, `A` an uppercase letter, `*` any char.
   *  Anything else is a literal that auto-inserts. */
  mask: string;
  /** Raw value (mask placeholders only — no literals). */
  value: string;
  onChange: (raw: string) => void;
  placeholderChar?: string;
  width?: number;
  disabled?: boolean;
  style?: StyleLike;
  focusedStyle?: StyleLike;
}

export function MaskedInput(props: MaskedInputProps): ZenElement {
  const theme = useTheme();
  const placeholder = props.placeholderChar ?? "_";
  const display = formatMask(props.mask, props.value, placeholder);

  // We render a text input that displays the formatted mask. Edits go back
  // through `unformat` to recover the raw stream.
  return h(TextInput, {
    value: display,
    onChange: (next: string) => {
      const raw = unformatMask(props.mask, next);
      props.onChange(raw);
    },
    width: props.width ?? props.mask.length,
    disabled: props.disabled,
    accessibilityLabel: props.accessibilityLabel,
    accessibilityDescription: props.accessibilityDescription,
    style: mergeBoxStyle(theme.input.normal, props.style),
    focusedStyle: mergeBoxStyle(theme.input.focused, props.focusedStyle),
  } as Record<string, unknown>);
}

function formatMask(mask: string, raw: string, placeholder: string): string {
  let i = 0;
  let out = "";
  for (const m of mask) {
    if (isMaskSlot(m)) {
      if (i < raw.length) {
        out += raw[i]!;
        i++;
      } else {
        out += placeholder;
      }
    } else {
      out += m;
    }
  }
  return out;
}

function unformatMask(mask: string, formatted: string): string {
  let raw = "";
  for (let i = 0; i < mask.length && i < formatted.length; i++) {
    const m = mask[i]!;
    const v = formatted[i]!;
    if (!isMaskSlot(m)) continue;
    if (matchesSlot(m, v)) raw += v;
  }
  return raw;
}

function isMaskSlot(ch: string): boolean {
  return ch === "#" || ch === "A" || ch === "*";
}

function matchesSlot(slot: string, ch: string): boolean {
  if (slot === "#") return /\d/.test(ch);
  if (slot === "A") return /[A-Za-z]/.test(ch);
  if (slot === "*") return ch.length === 1 && ch !== "_" && ch !== " ";
  return false;
}

// -- Form / FormField / ErrorMessage ----------------------------------------
export interface FormProps extends AccessibilityProps {
  onSubmit?: () => void;
  children?: unknown;
}

export function Form(props: FormProps): ZenElement {
  return h(
    "box",
    {
      direction: "column",
      gap: 1,
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
      onKey: (ev: KeyEvent): boolean | void => {
        if (ev.name === "enter" && ev.ctrl) {
          props.onSubmit?.();
          return true;
        }
        return false;
      },
    } as BoxProps,
    props.children,
  );
}

export interface FormFieldProps extends AccessibilityProps {
  label: string;
  description?: string;
  error?: string;
  children?: unknown;
}

export function FormField(props: FormFieldProps): ZenElement {
  const theme = useTheme();
  const rows: ZenElement[] = [
    h("text", { style: theme.formField.label } as TextProps, props.label),
  ];
  if (props.description) {
    rows.push(h("text", { style: theme.formField.description } as TextProps, props.description));
  }
  rows.push(h("box", { direction: "column" } as BoxProps, props.children));
  if (props.error) {
    rows.push(h("text", { style: theme.formField.error } as TextProps, props.error));
  }
  return h(
    "box",
    {
      direction: "column",
      gap: 0,
      accessibilityLabel: props.accessibilityLabel ?? props.label,
      accessibilityDescription: props.accessibilityDescription ?? props.description,
    } as BoxProps,
    rows,
  );
}

export interface ErrorMessageProps extends AccessibilityProps {
  children?: unknown;
}

export function ErrorMessage(props: ErrorMessageProps): ZenElement {
  const theme = useTheme();
  return h(
    "text",
    {
      style: theme.formField.error,
      accessibilityLabel: props.accessibilityLabel ?? accessibleText(props.children),
      accessibilityDescription: props.accessibilityDescription,
    } as TextProps,
    String(props.children ?? ""),
  );
}

// -- <Wizard> ----------------------------------------------------------------
export interface WizardStep extends StepperStep {
  /** Body content for this step. */
  content: ZenElement | string;
  /** Optional gate; returns true when this step is valid to leave. */
  canAdvance?: () => boolean;
}

export interface WizardProps extends AccessibilityProps {
  steps: readonly WizardStep[];
  current: number;
  onChange: (next: number) => void;
  onSubmit?: () => void;
}

export function Wizard(props: WizardProps): ZenElement {
  const step = props.steps[props.current];
  const total = props.steps.length;
  const isLast = props.current >= total - 1;

  function next(): void {
    if (!step) return;
    if (step.canAdvance && !step.canAdvance()) return;
    if (isLast) {
      props.onSubmit?.();
      return;
    }
    props.onChange(Math.min(total - 1, props.current + 1));
  }

  function back(): void {
    props.onChange(Math.max(0, props.current - 1));
  }

  return h(
    "box",
    {
      direction: "column",
      gap: 1,
      accessibilityLabel: props.accessibilityLabel ?? "wizard",
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    [
      h(Stepper, { steps: props.steps, current: props.current }),
      h(
        "box",
        { direction: "column", padding: 1 } as BoxProps,
        step
          ? typeof step.content === "string"
            ? h("text", {} as TextProps, step.content)
            : step.content
          : null,
      ),
      h("box", { direction: "row", gap: 1, justify: "end" } as BoxProps, [
        h(Button, { onClick: back, disabled: props.current === 0 }, "Back"),
        h(Button, { onClick: next }, isLast ? "Finish" : "Next"),
      ]),
    ],
  );
}

// -- <ErrorBoundary> ---------------------------------------------------------
export interface ErrorBoundaryProps extends AccessibilityProps {
  /** Render thunk. Errors thrown here are caught. */
  render: () => ZenElement;
  /** Render a fallback when the thunk throws. */
  fallback: (error: Error) => ZenElement;
}

export function ErrorBoundary(props: ErrorBoundaryProps): ZenElement {
  try {
    return props.render();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    try {
      return props.fallback(err);
    } catch {
      return h("text", {} as TextProps, `Error: ${err.message}`);
    }
  }
}

// -- <Suspense> --------------------------------------------------------------
export interface SuspenseProps extends AccessibilityProps {
  /** When true (or a loading resource state), render the fallback. */
  when: boolean;
  fallback: ZenElement | string;
  children?: unknown;
}

export function Suspense(props: SuspenseProps): ZenElement {
  if (props.when) {
    return typeof props.fallback === "string"
      ? h("text", {} as TextProps, props.fallback)
      : props.fallback;
  }
  return h(
    "box",
    {
      direction: "column",
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    props.children,
  );
}

// Suppress unused-import warning when these grow real consumers.
export { Checkbox, useEffect };
