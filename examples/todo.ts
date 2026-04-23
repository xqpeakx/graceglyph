/**
 * zenterm · todo — a working task manager that fits on one screen.
 *
 * Demonstrates a realistic app layout: split panes, a live-updating list,
 * a detail view driven off selection, an input bound to a button, and
 * global keyboard shortcuts routed through the event bus.
 */
import {
  Application,
  Button,
  Dialog,
  Label,
  ListView,
  StatusBar,
  TextField,
  Window,
  darkTheme,
  defaultTheme,
} from "../src/index.js";

interface Task {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
}

let nextId = 1;
const mkTask = (title: string, done = false): Task => ({
  id: nextId++,
  title,
  done,
  createdAt: new Date().toLocaleString(),
});

const tasks: Task[] = [
  mkTask("wire up keyboard shortcuts", true),
  mkTask("ship v0.1 of zenterm"),
  mkTask("write the file browser example"),
  mkTask("benchmark the diff renderer"),
];

// -- Layout -------------------------------------------------------------------
const app = new Application();
const root = new Window({ title: " zenterm · todo ", border: true });

// Section headers
root.add(new Label({ x: 2, y: 1, text: "Tasks", style: { bold: true, underline: true } }));
root.add(new Label({ x: 42, y: 1, text: "Detail", style: { bold: true, underline: true } }));

// Task list (left pane)
const list = new ListView<Task>({
  x: 2, y: 2, width: 38, height: 10,
  items: tasks,
  render: (t) => `${t.done ? "[x]" : "[ ]"} ${t.title}`,
  onChange: (_task, idx) => refreshDetail(idx),
  onSelect: (task) => {
    task.done = !task.done;
    list.setItems(tasks);
    refreshStatus();
  },
});
root.add(list);

// Detail pane (right)
const detailTitle = new Label({ x: 42, y: 2, width: 34, text: "", style: { bold: true } });
const detailStatus = new Label({ x: 42, y: 4, width: 34, text: "" });
const detailCreated = new Label({ x: 42, y: 5, width: 34, text: "", style: { dim: true } });
const detailHint = new Label({
  x: 42, y: 7, width: 34,
  text: "enter: toggle done",
  style: { italic: true, dim: true },
});
root.add(detailTitle);
root.add(detailStatus);
root.add(detailCreated);
root.add(detailHint);

// New-task input row
root.add(new Label({ x: 2, y: 13, text: "New:" }));
const input = new TextField({
  x: 8, y: 13, width: 32, placeholder: "describe a task...",
  onSubmit: (v) => addTask(v),
});
root.add(input);

const addBtn = new Button({
  x: 42, y: 13, label: "Add",
  onPress: () => addTask(input.text),
});
root.add(addBtn);

const clearBtn = new Button({
  x: 52, y: 13, label: "Clear done",
  onPress: () => confirmClear(),
});
root.add(clearBtn);

// Status bar
const status = new StatusBar({ text: "" });
root.add(status);

// -- Behavior -----------------------------------------------------------------
function addTask(title: string): void {
  const trimmed = title.trim();
  if (!trimmed) return;
  tasks.push(mkTask(trimmed));
  list.setItems(tasks);
  input.setText("");
  refreshStatus();
  refreshDetail(list.selectedIndex());
}

function deleteFocused(): void {
  if (app.focus.focused() !== list) return;
  const idx = list.selectedIndex();
  if (idx < 0 || idx >= tasks.length) return;
  tasks.splice(idx, 1);
  list.setItems(tasks);
  refreshStatus();
  refreshDetail(list.selectedIndex());
}

function refreshDetail(idx: number): void {
  const t = tasks[idx];
  if (!t) {
    detailTitle.setText("(no task)");
    detailStatus.setText("");
    detailCreated.setText("");
    return;
  }
  detailTitle.setText(t.title);
  detailStatus.setText(`status: ${t.done ? "done ✓" : "pending"}`);
  detailCreated.setText(`created: ${t.createdAt}`);
}

function refreshStatus(): void {
  const done = tasks.filter((t) => t.done).length;
  status.setText(
    `${tasks.length} tasks · ${done} done  ·  n: new  d: delete  enter: toggle  F2: theme  ^C: quit`,
  );
}

// Modal confirm before clearing completed tasks
let dialog: Dialog | null = null;
function confirmClear(): void {
  if (dialog) return;
  const doneCount = tasks.filter((t) => t.done).length;
  if (doneCount === 0) return;
  const prev = app.focus.focused();
  dialog = new Dialog({
    title: " Clear completed ",
    message: `Remove ${doneCount} completed task${doneCount === 1 ? "" : "s"}?`,
    buttons: [
      { label: "Cancel", value: "cancel" },
      { label: "Clear", value: "ok" },
    ],
    onResult: (v) => {
      if (v === "ok") {
        for (let i = tasks.length - 1; i >= 0; i--) {
          if (tasks[i]!.done) tasks.splice(i, 1);
        }
        list.setItems(tasks);
        refreshStatus();
        refreshDetail(list.selectedIndex());
      }
      closeDialog(prev);
    },
  });
  root.add(dialog);
  const firstBtn = dialog.children.find((c) => c instanceof Button);
  if (firstBtn) app.focus.focus(firstBtn);
}

function closeDialog(restoreFocus: ReturnType<typeof app.focus.focused>): void {
  if (!dialog) return;
  root.remove(dialog);
  dialog = null;
  if (restoreFocus) app.focus.focus(restoreFocus);
  app.invalidate();
}

// Global shortcuts — fire after the focused view gets first dibs
app.bus.on("key", (ev) => {
  const e = ev as { name: string; char?: string; ctrl: boolean; alt: boolean };
  if (e.ctrl || e.alt) return;

  if (e.name === "f2") {
    app.theme = app.theme.name === "dark" ? defaultTheme() : darkTheme();
    app.renderer.invalidate();
    app.invalidate();
    return;
  }

  // Shortcuts that shouldn't steal keystrokes from the text field
  const focused = app.focus.focused();
  if (focused === input) return;

  if (e.name === "char" && e.char === "n") {
    app.focus.focus(input);
    app.invalidate();
  } else if (e.name === "char" && e.char === "d") {
    deleteFocused();
  }
});

// Initial paint
refreshDetail(0);
refreshStatus();

app.setRoot(root);
// Start with the list focused so arrows work immediately
app.focus.focus(list);
app.run();
