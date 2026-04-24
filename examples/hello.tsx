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
  TextArea,
  TextInput,
  Window,
  render,
  useState,
} from "../src/index.js";

interface Template {
  name: string;
  subject: string;
  body: string;
  note: string;
}

const TEMPLATES: readonly Template[] = [
  {
    name: "Release notes",
    subject: "Graceglyph 0.1 preview",
    body: [
      "Highlights",
      "",
      "- multiline draft editing",
      "- reusable modal flows",
      "- inspector on F12",
      "",
      "Next up: layout helpers and menus.",
    ].join("\n"),
    note: "A product-style update with bullets and a short sign-off.",
  },
  {
    name: "Incident update",
    subject: "Terminal rendering incident - mitigated",
    body: [
      "Status",
      "",
      "Rendering is stable again after the buffer flush fix.",
      "",
      "Follow-up",
      "- keep the diff smaller",
      "- add resize coverage",
      "- validate wide-character output",
    ].join("\n"),
    note: "A structured status update with a short action list.",
  },
  {
    name: "Roadmap memo",
    subject: "Toolkit roadmap snapshot",
    body: [
      "Now",
      "- textarea",
      "- richer examples",
      "",
      "Soon",
      "- menu popovers",
      "- stack and grid helpers",
      "",
      "Later",
      "- plugin surface once widgets settle",
    ].join("\n"),
    note: "A simple planning memo that shows off multiline editing.",
  },
] as const;

function HelloApp() {
  const [selected, setSelected] = useState(0);
  const [subject, setSubject] = useState(TEMPLATES[0]?.subject ?? "");
  const [body, setBody] = useState(TEMPLATES[0]?.body ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [events, setEvents] = useState<string[]>([
    "hello example ready",
    "textarea supports multiline editing",
  ]);

  const activeTemplate = TEMPLATES[selected] ?? TEMPLATES[0]!;
  const lineCount = body.length === 0 ? 1 : body.split("\n").length;
  const wordCount = countWords(body);

  function log(message: string): void {
    setEvents((items) => [`${timeStamp()} ${message}`, ...items].slice(0, 8));
  }

  function loadTemplate(index: number): void {
    const template = TEMPLATES[index];
    if (!template) return;
    setSelected(index);
    setSubject(template.subject);
    setBody(template.body);
    log(`loaded ${template.name.toLowerCase()}`);
  }

  function resetDraft(): void {
    setSubject("");
    setBody("");
    log("cleared draft");
  }

  function insertStamp(): void {
    const stamp = [
      "",
      "--",
      `updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    ].join("\n");
    setBody((current) => current + stamp);
    log("inserted update stamp");
  }

  return (
    <App>
      <Window title="Hello graceglyph" grow={1}>
        <Row gap={1} grow={1}>
          <Panel title="Templates" width={22}>
            <Column gap={1} grow={1}>
              <Text style={{ dim: true }}>
                Pick a draft shape, then tab into the editor and start typing.
              </Text>

              <List
                items={TEMPLATES}
                selected={selected}
                onChange={(index) => {
                  setSelected(index);
                  log(`selected ${TEMPLATES[index]?.name.toLowerCase() ?? "template"}`);
                }}
                onSelect={(index) => loadTemplate(index)}
                height={7}
                render={(item) => item.name}
              />

              <Text>{activeTemplate.name}</Text>
              <Text style={{ dim: true }}>{activeTemplate.note}</Text>
              <Button onClick={() => loadTemplate(selected)}>Load template</Button>
            </Column>
          </Panel>

          <Panel title="Composer" grow={1}>
            <Column gap={1} grow={1}>
              <TextInput
                value={subject}
                onChange={setSubject}
                placeholder="Subject"
              />

              <TextArea
                value={body}
                onChange={setBody}
                grow={1}
                placeholder={[
                  "Write something with real structure.",
                  "",
                  "- Enter inserts a newline",
                  "- Arrow keys move the cursor",
                  "- F12 opens the inspector",
                ].join("\n")}
              />

              <Row gap={1}>
                <Button onClick={insertStamp}>Stamp</Button>
                <Button onClick={resetDraft}>Reset</Button>
                <Button
                  onClick={() => {
                    setPreviewOpen(true);
                    log("opened preview");
                  }}
                >
                  View
                </Button>
              </Row>
            </Column>
          </Panel>

          <Column width={24} gap={1}>
            <Panel title="Snapshot" height={13}>
              <Column gap={0}>
                <Text>{subject || "(untitled draft)"}</Text>
                <Text style={{ dim: true }}>{lineCount} lines · {wordCount} words</Text>
                {previewLines(body, 8).map((line, index) => (
                  <Text key={`preview-${index}`}>{line}</Text>
                ))}
              </Column>
            </Panel>

            <Panel title="Activity" grow={1}>
              <Column gap={0}>
                {events.map((entry, index) => (
                  <Text key={`${entry}-${index}`}>{entry}</Text>
                ))}
              </Column>
            </Panel>
          </Column>
        </Row>

        {previewOpen && (
          <Modal title="Preview" width={58} height={15}>
            <Column gap={0}>
              <Text>{subject || "(untitled draft)"}</Text>
              {previewLines(body, 8).map((line, index) => (
                <Text key={`modal-${index}`}>{line}</Text>
              ))}
              <Row gap={1}>
                <Button onClick={() => setPreviewOpen(false)}>Close</Button>
              </Row>
            </Column>
          </Modal>
        )}
      </Window>
    </App>
  );
}

render(<HelloApp />);

function previewLines(value: string, limit: number): string[] {
  const source = value.length === 0 ? ["(empty draft)"] : value.split("\n");
  if (source.length <= limit) return source;
  return [...source.slice(0, limit - 1), "…"];
}

function countWords(value: string): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

function timeStamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
