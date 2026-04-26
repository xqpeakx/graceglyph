# Component Library Matrix

This file tracks the §6 component-library gate for v1.0. The public surface is
framework-level API, not an app-specific showcase.

## Acceptance

- Public API: exported from `src/index.ts`.
- Tokenized: styles come from theme tokens or caller-supplied `StyleLike`.
- Tested: covered by `test/components*.test.ts`, focused integration tests, or
  runtime tests for host behavior.
- Storied: demonstrated in `examples/components-gallery.tsx` or the dashboard
  shell examples.
- A11y: accepts host-level `accessibilityLabel` /
  `accessibilityDescription`, or derives a semantic label from visible text.

## Inventory

| Tier            | Components                                                                                                                     | Public | Tokenized | Tested | Storied  | A11y    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ | --------- | ------ | -------- | ------- |
| Host wrappers   | `App`, `Window`, `Panel`, `Box`, `Row`, `Column`, `Text`, `Spacer`                                                             | yes    | yes       | yes    | yes      | host    |
| Actions         | `Button`, `IconButton`, `ToggleButton`, `ButtonGroup`, `Link`                                                                  | yes    | yes       | yes    | yes      | yes     |
| Text entry      | `TextInput`, `TextArea`, `NumberInput`, `PasswordInput`, `MaskedInput`                                                         | yes    | yes       | yes    | yes      | yes     |
| Choice controls | `Checkbox`, `Switch`, `RadioGroup`, `Select`, `Combobox`, `Autocomplete`, `MultiSelect`                                        | yes    | yes       | yes    | yes      | yes     |
| Ranges          | `Slider`, `RangeSlider`                                                                                                        | yes    | yes       | yes    | yes      | yes     |
| Data display    | `List`, `Table`, `Tree`, `Accordion`, `Stepper`, `Pagination`                                                                  | yes    | yes       | yes    | yes      | yes     |
| Feedback        | `Badge`, `Tag`, `Chip`, `Pill`, `ProgressBar`, `ProgressRing`, `Spinner`, `Skeleton`, `EmptyState`, `Tooltip`, `Notifications` | yes    | yes       | yes    | yes      | yes     |
| Chrome          | `Avatar`, `Card`, `KeyHints`, `Sidebar`, `TopBar`, `BottomBar`, `StatusBar`                                                    | yes    | yes       | yes    | yes      | yes     |
| Temporal        | `Calendar`, `DatePicker`, `TimePicker`                                                                                         | yes    | yes       | yes    | yes      | yes     |
| Forms and flow  | `Form`, `FormField`, `ErrorMessage`, `Wizard`, `ErrorBoundary`, `Suspense`                                                     | yes    | yes       | yes    | yes      | yes     |
| Visualization   | `Code`, `JSONViewer`, `DiffView`, `LogStream`                                                                                  | yes    | yes       | yes    | yes      | yes     |
| Layout helpers  | `Grid`, `Dock`, `DockSlot`, `Stack`, `SplitPane`, `ScrollView`                                                                 | yes    | yes       | yes    | yes      | host    |
| App shell       | `Router`, `Route`, `Tabs`, `CommandPalette`, `HelpOverlay`, `ToastViewport`                                                    | yes    | yes       | yes    | examples | partial |

## Remaining §6 Hardening

- Promote app-shell a11y from host-only to first-class props while §7 is being
  completed.
- Add generated inventory checks once the package API stabilizes, so new
  components cannot ship without tests and a story.
- Keep the gallery focused on framework primitives; flagship apps belong to
  §13 and should consume this surface rather than defining it.
