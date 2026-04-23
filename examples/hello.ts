import { Application, Label, StatusBar, Window } from "../src/index.js";

const app = new Application();

const root = new Window({ title: " zenterm ", border: true });
root.add(new Label({ x: 2, y: 1, text: "Hello, terminal." }));
root.add(new Label({ x: 2, y: 2, text: "Press Ctrl+C to quit.", style: { dim: true } }));
root.add(new StatusBar({ text: "zenterm · hello example" }));

app.setRoot(root);
app.run();
