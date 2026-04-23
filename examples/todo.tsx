/** @jsxRuntime automatic */
/** @jsxImportSource ../src */

import {
  App,
  Button,
  Column,
  Modal,
  Panel,
  Row,
  Text,
  TextInput,
  Window,
  List,
  render,
  useEffect,
  useState,
} from "../src/index.js";
import type { KeyEvent } from "../src/index.js";

interface Task {
  id: number;
  title: string;
  done: boolean;
}

let nextId = 1;

function makeTask(title: string, done = false): Task {
  return { id: nextId++, title, done };
}

function TodoApp() {
  const [draft, setDraft] = useState("");
  const [tasks, setTasks] = useState<Task[]>([
    makeTask("review open pull requests", true),
    makeTask("cut a patch release"),
    makeTask("check nightly logs"),
    makeTask("update the changelog"),
  ]);
  const [selected, setSelected] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setSelected((index) => clamp(index, tasks.length));
  }, [tasks.length]);

  const active = tasks[selected] ?? null;
  const doneCount = tasks.filter((task) => task.done).length;

  function addTask(): void {
    const title = draft.trim();
    if (!title) return;
    setTasks((items) => [...items, makeTask(title)]);
    setDraft("");
  }

  function toggleTask(index: number): void {
    setTasks((items) => items.map((task, current) => (
      current === index ? { ...task, done: !task.done } : task
    )));
  }

  function deleteSelected(): void {
    setTasks((items) => items.filter((_, index) => index !== selected));
  }

  function clearDone(): void {
    setTasks((items) => items.filter((task) => !task.done));
    setConfirmOpen(false);
  }

  function onWindowKey(event: KeyEvent): boolean | void {
    if (event.ctrl || event.alt) return false;
    if (event.name === "char" && event.char === "d") {
      deleteSelected();
      return true;
    }
    if (event.name === "char" && event.char === "c") {
      setConfirmOpen(true);
      return true;
    }
    return false;
  }

  return (
    <App>
      <Window title="Todo" width={80} height={24} onKey={onWindowKey}>
        <Column gap={1} grow={1}>
          <Row gap={1} grow={1}>
            <Panel title="Tasks" width={36}>
              <List
                items={tasks}
                selected={selected}
                onChange={setSelected}
                onSelect={toggleTask}
                height={12}
                render={(task) => `${task.done ? "[x]" : "[ ]"} ${task.title}`}
              />
            </Panel>

            <Panel title="Detail" grow={1}>
              <Column gap={1}>
                <Text>{active ? active.title : "(no task selected)"}</Text>
                <Text style={{ dim: true }}>
                  {active ? `status: ${active.done ? "done" : "pending"}` : "Select a task to inspect it."}
                </Text>
                <Text style={{ dim: true }}>
                  {tasks.length} task{tasks.length === 1 ? "" : "s"} total, {doneCount} done
                </Text>
                <Text style={{ dim: true }}>
                  Enter toggles the selected task. d deletes it. c opens clear-done.
                </Text>
              </Column>
            </Panel>
          </Row>

          <Row gap={1}>
            <TextInput
              value={draft}
              onChange={setDraft}
              onSubmit={addTask}
              placeholder="describe a task..."
              width={34}
            />
            <Button onClick={addTask}>Add</Button>
            <Button onClick={() => setConfirmOpen(true)}>Clear done</Button>
          </Row>

          <Text style={{ dim: true }}>
            Tab cycles focus. F12 opens the inspector.
          </Text>

          {confirmOpen && (
            <Modal title="Clear completed tasks?" width={44} height={9}>
              <Column gap={1}>
                <Text>
                  Remove {doneCount} completed task{doneCount === 1 ? "" : "s"}?
                </Text>
                <Row gap={1}>
                  <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                  <Button onClick={clearDone}>Clear</Button>
                </Row>
              </Column>
            </Modal>
          )}
        </Column>
      </Window>
    </App>
  );
}

render(<TodoApp />);

function clamp(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(index, length - 1);
}
