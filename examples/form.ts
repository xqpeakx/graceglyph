import {
  Application,
  Button,
  Label,
  ListView,
  StatusBar,
  TextField,
  Window,
} from "../src/index.js";

const app = new Application();

const root = new Window({ title: " Sign up ", border: true });

root.add(new Label({ x: 2, y: 1, text: "Name:" }));
const nameField = new TextField({
  x: 10,
  y: 1,
  width: 30,
  placeholder: "your name",
});
root.add(nameField);

root.add(new Label({ x: 2, y: 3, text: "Role:" }));
const roles = new ListView<string>({
  x: 10,
  y: 3,
  width: 30,
  height: 4,
  items: ["engineer", "designer", "pm", "other"],
});
root.add(roles);

const status = new Label({ x: 2, y: 8, width: 40, text: "", style: { italic: true } });
root.add(status);

root.add(
  new Button({
    x: 10,
    y: 10,
    label: "Submit",
    onPress: () => {
      const role = roles.selectedItem() ?? "?";
      status.setText(`hello ${nameField.text || "friend"} (${role})`);
    },
  }),
);

root.add(new StatusBar({ text: "tab: next field · enter: submit · ctrl+c: quit" }));

app.setRoot(root);
app.run();
