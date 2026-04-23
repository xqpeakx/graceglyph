/** @jsxRuntime automatic */
/** @jsxImportSource ../src */

import {
  App,
  Button,
  Column,
  List,
  Modal,
  Panel,
  Row,
  Text,
  TextInput,
  Window,
  render,
  useState,
} from "../src/index.js";

const PRIORITIES = [
  "lists",
  "forms",
  "dialogs",
  "inspection",
] as const;

function ShowcaseApp() {
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [events, setEvents] = useState<string[]>([
    "showcase ready",
    "F12 toggles the inspector",
  ]);

  function log(message: string): void {
    setEvents((items) => [`${timeStamp()} ${message}`, ...items].slice(0, 6));
  }

  return (
    <App>
      <Window title="Showcase" width={78} height={24}>
        <Column gap={1} grow={1}>
          <Row gap={1} grow={1}>
            <Panel title="Controls" width={36} grow={1}>
              <Column gap={1}>
                <TextInput
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => log(`submitted "${draft || "(empty)"}"`)}
                  placeholder="type something"
                  width={28}
                />

                <Row gap={1}>
                  <Button onClick={() => log(`saved "${draft || "(empty)"}"`)}>Save</Button>
                  <Button
                    onClick={() => {
                      setDraft("");
                      log("reset draft");
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={() => {
                      setAboutOpen(true);
                      log("opened about modal");
                    }}
                  >
                    About
                  </Button>
                </Row>

                <Text style={{ dim: true }}>
                  Tab through the controls. Buttons, inputs, lists, and modals use the same runtime.
                </Text>
              </Column>
            </Panel>

            <Panel title="Priorities" grow={1}>
              <Column gap={1}>
                <Text style={{ dim: true }}>
                  Move through the list and watch the log update.
                </Text>
                <List
                  items={PRIORITIES}
                  selected={selected}
                  onChange={(index) => {
                    setSelected(index);
                    log(`selected ${PRIORITIES[index] ?? "item"}`);
                  }}
                  onSelect={(index) => log(`confirmed ${PRIORITIES[index] ?? "item"}`)}
                  height={6}
                  render={(item) => item}
                />
              </Column>
            </Panel>
          </Row>

          <Panel title="Event log" grow={1}>
            <Column gap={0}>
              {events.map((entry, index) => (
                <Text key={`${entry}-${index}`}>{entry}</Text>
              ))}
            </Column>
          </Panel>

          {aboutOpen && (
            <Modal title="About zenterm" width={48} height={9}>
              <Column gap={1}>
                <Text>Terminal UI primitives with row/column layout and an inspector.</Text>
                <Row gap={1}>
                  <Button onClick={() => setAboutOpen(false)}>Close</Button>
                </Row>
              </Column>
            </Modal>
          )}
        </Column>
      </Window>
    </App>
  );
}

render(<ShowcaseApp />);

function timeStamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
