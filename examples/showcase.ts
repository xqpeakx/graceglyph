import {
  Application,
  Button,
  Dialog,
  Label,
  ListView,
  StatusBar,
  TextField,
  View,
  Window,
  darkTheme,
  defaultTheme,
} from "../src/index.js";

const app = new Application();

const root = new Window({ title: " zenterm · showcase ", border: true });

// -- Labels section -----------------------------------------------------------
root.add(new Label({ x: 2, y: 1, text: "Labels", style: { bold: true, underline: true } }));
root.add(new Label({ x: 4, y: 2, width: 60, text: "left aligned", align: "left" }));
root.add(new Label({ x: 4, y: 2, width: 60, text: "centered", align: "center" }));
root.add(new Label({ x: 4, y: 2, width: 60, text: "right aligned", align: "right" }));
root.add(new Label({ x: 4, y: 3, text: "bold", style: { bold: true } }));
root.add(new Label({ x: 10, y: 3, text: "dim", style: { dim: true } }));
root.add(new Label({ x: 15, y: 3, text: "italic", style: { italic: true } }));
root.add(new Label({ x: 23, y: 3, text: "underline", style: { underline: true } }));
root.add(new Label({ x: 34, y: 3, text: "inverse", style: { inverse: true } }));

// -- Inputs section -----------------------------------------------------------
root.add(new Label({ x: 2, y: 5, text: "Inputs", style: { bold: true, underline: true } }));
root.add(new Label({ x: 4, y: 6, width: 6, text: "Name:" }));
const nameField = new TextField({
  x: 11, y: 6, width: 28, placeholder: "your name",
  onChange: (v) => log(`name → ${v}`),
});
root.add(nameField);

root.add(new Label({ x: 4, y: 7, width: 6, text: "Email:" }));
const emailField = new TextField({
  x: 11, y: 7, width: 28, placeholder: "you@example.com",
  onChange: (v) => log(`email → ${v}`),
});
root.add(emailField);

// -- List + Actions side by side ---------------------------------------------
root.add(new Label({ x: 2, y: 9, text: "Role", style: { bold: true, underline: true } }));
const roles = new ListView<string>({
  x: 4, y: 10, width: 20, height: 5,
  items: ["engineer", "designer", "product", "other"],
  onChange: (item) => log(`role → ${item}`),
  onSelect: (item) => log(`picked ${item}`),
});
root.add(roles);

root.add(new Label({ x: 28, y: 9, text: "Actions", style: { bold: true, underline: true } }));

const saveBtn = new Button({
  x: 30, y: 10, label: "Save",
  onPress: () => {
    const role = roles.selectedItem() ?? "-";
    log(`saved: ${nameField.text || "(anon)"} <${emailField.text || "-"}> · ${role}`);
  },
});
root.add(saveBtn);

const resetBtn = new Button({
  x: 42, y: 10, label: "Reset",
  onPress: () => {
    nameField.setText("");
    emailField.setText("");
    log("reset");
  },
});
root.add(resetBtn);

const aboutBtn = new Button({
  x: 55, y: 10, label: "About",
  onPress: () => showAbout(),
});
root.add(aboutBtn);

// -- Output log ---------------------------------------------------------------
root.add(new Label({ x: 2, y: 16, text: "Output", style: { bold: true, underline: true } }));
const logLines: string[] = [];
const logView = new ListView<string>({
  x: 4, y: 17, width: 64, height: 5,
  items: logLines,
});
root.add(logView);

function log(line: string): void {
  const ts = new Date().toLocaleTimeString();
  logLines.push(`${ts}  ${line}`);
  while (logLines.length > 50) logLines.shift();
  logView.setItems(logLines);
}

// -- Status bar ---------------------------------------------------------------
const status = new StatusBar({
  text: "tab: cycle  ·  enter/space: activate  ·  F2: toggle theme  ·  ctrl+c: quit",
});
root.add(status);

// -- Modal dialog -------------------------------------------------------------
let dialog: Dialog | null = null;

function showAbout(): void {
  if (dialog) return;
  const previouslyFocused = app.focus.focused();
  dialog = new Dialog({
    title: " About ",
    message: "zenterm — a cross-platform retained-mode TUI framework.",
    buttons: [{ label: "Close", value: "close" }],
    onResult: () => {
      if (!dialog) return;
      root.remove(dialog);
      dialog = null;
      if (previouslyFocused) app.focus.focus(previouslyFocused);
      app.invalidate();
    },
  });
  root.add(dialog);
  // Focus the first button inside the dialog.
  const firstButton = dialog.children.find((c: View) => c instanceof Button) as Button | undefined;
  if (firstButton) app.focus.focus(firstButton);
  log("opened about dialog");
}

// -- Global shortcuts: F2 toggles theme --------------------------------------
app.bus.on("key", (ev) => {
  const e = ev as { name: string };
  if (e.name === "f2") {
    app.theme = app.theme.name === "dark" ? defaultTheme() : darkTheme();
    log(`theme → ${app.theme.name}`);
    app.renderer.invalidate();
    app.invalidate();
  }
});

log("showcase ready · tab through the widgets to explore");

app.setRoot(root);
app.run();
