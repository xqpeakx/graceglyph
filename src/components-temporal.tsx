import { h } from "./runtime/element.js";
import type {
  AccessibilityProps,
  BoxProps,
  StyleLike,
  TextProps,
  ZenElement,
} from "./runtime/element.js";
import type { KeyEvent } from "./input/keys.js";
import { useState, useTheme } from "./runtime/hooks.js";
import { style as styleRule } from "./style/index.js";

function mergeBoxStyle(base: StyleLike, override?: StyleLike): StyleLike {
  return override ? styleRule.merge(base, override) : base;
}

// -- shared helpers ----------------------------------------------------------
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const WEEKDAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function startWeekday(year: number, month: number): number {
  // Mon=0, Tue=1, … Sun=6.
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7;
}

// -- <Calendar> --------------------------------------------------------------
export interface CalendarProps extends AccessibilityProps {
  /** Visible month anchor. Defaults to today. Component does not manage its own. */
  month?: { year: number; month: number };
  onMonthChange?: (next: { year: number; month: number }) => void;
  selected?: { year: number; month: number; day: number };
  onSelect?: (date: { year: number; month: number; day: number }) => void;
  showWeekdays?: boolean;
  width?: number;
  style?: StyleLike;
}

export function Calendar(props: CalendarProps): ZenElement {
  const theme = useTheme();
  const today = new Date();
  const anchor = props.month ?? { year: today.getFullYear(), month: today.getMonth() };
  const days = daysInMonth(anchor.year, anchor.month);
  const offset = startWeekday(anchor.year, anchor.month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function step(deltaDays: number): void {
    if (!props.selected || !props.onSelect) {
      props.onMonthChange?.(stepMonth(anchor, deltaDays > 0 ? 1 : -1));
      return;
    }
    const date = new Date(props.selected.year, props.selected.month, props.selected.day);
    date.setDate(date.getDate() + deltaDays);
    props.onSelect({
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
    });
    if (date.getMonth() !== anchor.month || date.getFullYear() !== anchor.year) {
      props.onMonthChange?.({ year: date.getFullYear(), month: date.getMonth() });
    }
  }

  function stepMonth(
    a: { year: number; month: number },
    delta: number,
  ): { year: number; month: number } {
    const total = a.year * 12 + a.month + delta;
    return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
  }

  const rows: ZenElement[] = [];
  // Header
  rows.push(
    h("box", { direction: "row", justify: "between", height: 1 } as BoxProps, [
      h(
        "text",
        {
          style: theme.window.title,
          onClick: props.onMonthChange
            ? () => props.onMonthChange?.(stepMonth(anchor, -1))
            : undefined,
        } as TextProps & { onClick?: () => void },
        "  ‹ ",
      ),
      h(
        "text",
        { style: theme.window.title } as TextProps,
        ` ${MONTHS_LONG[anchor.month]} ${anchor.year} `,
      ),
      h(
        "text",
        {
          style: theme.window.title,
          onClick: props.onMonthChange
            ? () => props.onMonthChange?.(stepMonth(anchor, 1))
            : undefined,
        } as TextProps & { onClick?: () => void },
        " › ",
      ),
    ]),
  );

  if (props.showWeekdays !== false) {
    rows.push(
      h(
        "box",
        { direction: "row", height: 1, gap: 0 } as BoxProps,
        WEEKDAY_HEADERS.map((label) =>
          h(
            "text",
            {
              key: label,
              style: theme.formField.description,
            } as TextProps & { key: string },
            ` ${label}`,
          ),
        ),
      ),
    );
  }

  for (let row = 0; row < cells.length / 7; row++) {
    const items = cells.slice(row * 7, row * 7 + 7).map((day, i) => {
      const isSelected =
        day != null &&
        props.selected?.year === anchor.year &&
        props.selected?.month === anchor.month &&
        props.selected?.day === day;
      const cellStyle = isSelected
        ? theme.list.selected
        : day === today.getDate() &&
            anchor.year === today.getFullYear() &&
            anchor.month === today.getMonth()
          ? theme.list.active
          : theme.list.normal;
      return h(
        "box",
        {
          key: `${row}-${i}`,
          width: 3,
          height: 1,
          direction: "row",
          justify: "end",
          padding: [0, 0],
          onClick:
            day != null && props.onSelect
              ? () =>
                  props.onSelect?.({
                    year: anchor.year,
                    month: anchor.month,
                    day,
                  })
              : undefined,
          style: cellStyle,
        } as BoxProps,
        h("text", {} as TextProps, day == null ? "  " : pad2(day)),
      );
    });
    rows.push(h("box", { direction: "row", height: 1 } as BoxProps, items));
  }

  return h(
    "box",
    {
      focusable: true,
      direction: "column",
      width: props.width ?? 24,
      accessibilityLabel: props.accessibilityLabel ?? `${MONTHS_LONG[anchor.month]} ${anchor.year}`,
      accessibilityDescription: props.accessibilityDescription,
      onKey: (ev: KeyEvent): boolean | void => {
        if (ev.name === "left") {
          step(-1);
          return true;
        }
        if (ev.name === "right") {
          step(1);
          return true;
        }
        if (ev.name === "up") {
          step(-7);
          return true;
        }
        if (ev.name === "down") {
          step(7);
          return true;
        }
        if (ev.name === "pageup") {
          props.onMonthChange?.(stepMonth(anchor, -1));
          return true;
        }
        if (ev.name === "pagedown") {
          props.onMonthChange?.(stepMonth(anchor, 1));
          return true;
        }
        return false;
      },
      style: props.style,
    } as BoxProps,
    rows,
  );
}

// -- <DatePicker> ------------------------------------------------------------
export interface DatePickerProps extends AccessibilityProps {
  value: { year: number; month: number; day: number } | null;
  onChange: (next: { year: number; month: number; day: number }) => void;
  /** Show inline calendar below the field. */
  showCalendar?: boolean;
  width?: number;
  disabled?: boolean;
  style?: StyleLike;
  focusedStyle?: StyleLike;
}

export function DatePicker(props: DatePickerProps): ZenElement {
  const theme = useTheme();
  const initial = props.value ?? null;
  const [anchor, setAnchor] = useState(() => {
    if (initial) return { year: initial.year, month: initial.month };
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [open, setOpen] = useState(props.showCalendar ?? false);
  const width = props.width ?? 14;
  const text = props.value
    ? `${props.value.year}-${pad2(props.value.month + 1)}-${pad2(props.value.day)}`
    : "YYYY-MM-DD";

  const trigger = h(
    "box",
    {
      focusable: !props.disabled,
      disabled: props.disabled,
      border: true,
      padding: [0, 1],
      direction: "row",
      width,
      accessibilityLabel: props.accessibilityLabel ?? text,
      accessibilityDescription: props.accessibilityDescription,
      onClick: props.disabled ? undefined : () => setOpen((v) => !v),
      onKey: (ev: KeyEvent): boolean | void => {
        if (props.disabled) return false;
        if (ev.name === "enter" || ev.name === "space" || ev.name === "down") {
          setOpen((v) => !v);
          return true;
        }
        return false;
      },
      style: mergeBoxStyle(theme.input.normal, props.style),
      focusedStyle: mergeBoxStyle(theme.input.focused, props.focusedStyle),
    } as BoxProps,
    [
      h("text", { wrap: "truncate", grow: 1 } as unknown as TextProps, text),
      h("text", {} as TextProps, ` ${open ? "▲" : "▼"}`),
    ],
  );

  if (!open) return trigger;

  return h("box", { direction: "column", gap: 0, width } as BoxProps, [
    trigger,
    h(Calendar, {
      month: anchor,
      onMonthChange: setAnchor,
      selected: props.value ?? undefined,
      onSelect: (date: { year: number; month: number; day: number }) => {
        props.onChange(date);
        setOpen(false);
      },
      width,
    }),
  ]);
}

// -- <TimePicker> ------------------------------------------------------------
export interface TimePickerProps extends AccessibilityProps {
  /** 24-hour, with optional seconds. */
  value: { hour: number; minute: number; second?: number };
  onChange: (next: { hour: number; minute: number; second?: number }) => void;
  /** Include a seconds spinner. Defaults to false. */
  showSeconds?: boolean;
  width?: number;
  disabled?: boolean;
  style?: StyleLike;
}

export function TimePicker(props: TimePickerProps): ZenElement {
  const theme = useTheme();
  const showSeconds = props.showSeconds ?? false;
  const [active, setActive] = useState<"hour" | "minute" | "second">("hour");
  const value = {
    hour: clamp(props.value.hour, 0, 23),
    minute: clamp(props.value.minute, 0, 59),
    second: clamp(props.value.second ?? 0, 0, 59),
  };

  function commit(next: typeof value): void {
    props.onChange({
      hour: next.hour,
      minute: next.minute,
      ...(showSeconds ? { second: next.second } : {}),
    });
  }

  function bump(delta: number): void {
    if (active === "hour") commit({ ...value, hour: (value.hour + delta + 24) % 24 });
    else if (active === "minute") commit({ ...value, minute: (value.minute + delta + 60) % 60 });
    else commit({ ...value, second: (value.second + delta + 60) % 60 });
  }

  function switchActive(direction: 1 | -1): void {
    const order: ("hour" | "minute" | "second")[] = showSeconds
      ? ["hour", "minute", "second"]
      : ["hour", "minute"];
    const index = order.indexOf(active);
    const next = (index + direction + order.length) % order.length;
    setActive(order[next]!);
  }

  const segment = (label: string, isActive: boolean, onClickSegment: () => void) =>
    h(
      "text",
      {
        onClick: onClickSegment,
        style: isActive ? theme.list.selected : theme.input.normal,
      } as TextProps & { onClick: () => void },
      label,
    );

  const segments: ZenElement[] = [
    segment(pad2(value.hour), active === "hour", () => setActive("hour")),
    h("text", {} as TextProps, ":"),
    segment(pad2(value.minute), active === "minute", () => setActive("minute")),
  ];
  if (showSeconds) {
    segments.push(h("text", {} as TextProps, ":"));
    segments.push(segment(pad2(value.second), active === "second", () => setActive("second")));
  }

  return h(
    "box",
    {
      focusable: !props.disabled,
      disabled: props.disabled,
      border: true,
      padding: [0, 1],
      direction: "row",
      width: props.width ?? (showSeconds ? 12 : 9),
      accessibilityLabel:
        props.accessibilityLabel ??
        `${pad2(value.hour)}:${pad2(value.minute)}${showSeconds ? `:${pad2(value.second)}` : ""}`,
      accessibilityDescription: props.accessibilityDescription,
      onKey: (ev: KeyEvent): boolean | void => {
        if (props.disabled) return false;
        if (ev.name === "up") {
          bump(1);
          return true;
        }
        if (ev.name === "down") {
          bump(-1);
          return true;
        }
        if (ev.name === "left") {
          switchActive(-1);
          return true;
        }
        if (ev.name === "right") {
          switchActive(1);
          return true;
        }
        return false;
      },
      style: mergeBoxStyle(theme.input.normal, props.style),
    } as BoxProps,
    segments,
  );
}
