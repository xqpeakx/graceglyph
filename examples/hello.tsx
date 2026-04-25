/** @jsx h */

import {
  App,
  Button,
  Column,
  List,
  Modal,
  Row,
  Text,
  TextArea,
  TextInput,
  Window,
  h,
  useState,
  useTerminalSize,
} from "../src/index.js";
import { runExample } from "./_entry.js";

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
    note: "A short product update with bullets and a clean close.",
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
    note: "A structured status note with actions at the bottom.",
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
    note: "A planning memo that shows off multiline editing.",
  },
] as const;

export function HelloApp() {
  const size = useTerminalSize();
  const stacked = size.width < 72;
  const compact = stacked && size.height < 22;
  const [selected, setSelected] = useState(0);
  const [subject, setSubject] = useState(TEMPLATES[0]?.subject ?? "");
  const [body, setBody] = useState(TEMPLATES[0]?.body ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [events, setEvents] = useState<string[]>([
    "ready to edit",
    "Enter loads the selected template",
  ]);

  const activeTemplate = TEMPLATES[selected] ?? TEMPLATES[0]!;
  const lineCount = body.length === 0 ? 1 : body.split("\n").length;
  const wordCount = countWords(body);
  const latestEvent = events[0] ?? "ready";
  const windowPadding: number | [number, number] = compact ? 0 : stacked ? 1 : [1, 2];
  const rootGap = compact ? 1 : stacked ? 1 : 2;
  const editorGap = compact ? 0 : 1;
  const listHeight = stacked
    ? compact
      ? 2
      : Math.max(3, Math.min(4, size.height - 16))
    : Math.max(4, Math.min(8, size.height - 20));
  const previewLimit = Math.max(4, Math.min(10, size.height - 10));

  function log(message: string): void {
    setEvents((items) => [`${timeStamp()} ${message}`, ...items].slice(0, 6));
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

  function openPreview(): void {
    setPreviewOpen(true);
    log("opened preview");
  }

  return (
    <App>
      <Window title="Hello graceglyph" grow={1} padding={windowPadding}>
        <Column gap={rootGap} grow={1}>
          <Text style={{ dim: true }}>
            Build a real draft fast: pick a template, edit it, and preview the result.
          </Text>

          {stacked ? (
            <Column gap={editorGap} grow={1}>
              <Text>Templates</Text>
              <List
                items={TEMPLATES}
                selected={selected}
                onChange={(index) => {
                  setSelected(index);
                  log(`selected ${TEMPLATES[index]?.name.toLowerCase() ?? "template"}`);
                }}
                onSelect={loadTemplate}
                height={listHeight}
                render={(item) => item.name}
              />

              <TextInput value={subject} onChange={setSubject} placeholder="Subject" />

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
                <Button onClick={openPreview}>View</Button>
              </Row>
            </Column>
          ) : (
            <Row gap={2} grow={1}>
              <Column width={24} gap={1}>
                <Text>Templates</Text>
                <Text style={{ dim: true }}>
                  Use arrows to browse. Enter loads the selected draft.
                </Text>

                <List
                  items={TEMPLATES}
                  selected={selected}
                  onChange={(index) => {
                    setSelected(index);
                    log(`selected ${TEMPLATES[index]?.name.toLowerCase() ?? "template"}`);
                  }}
                  onSelect={loadTemplate}
                  height={listHeight}
                  render={(item) => item.name}
                />
              </Column>

              <Column grow={1} gap={1}>
                <TextInput value={subject} onChange={setSubject} placeholder="Subject" />

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
                  <Button onClick={openPreview}>View</Button>
                </Row>
              </Column>
            </Row>
          )}

          {!compact && (
            <Text style={{ dim: true }}>
              {subject || "(untitled draft)"} · {lineCount} lines · {wordCount} words
              {stacked ? ` · ${activeTemplate.name}` : ""}
            </Text>
          )}
          {!compact && !stacked && <Text style={{ dim: true }}>{activeTemplate.note}</Text>}
          <Text style={{ dim: true }}>{latestEvent}</Text>

          {previewOpen && (
            <Modal
              title="Preview"
              width={54}
              height={previewLimit + 6}
              onDismiss={() => setPreviewOpen(false)}
            >
              <Column gap={0} grow={1}>
                <Text>{subject || "(untitled draft)"}</Text>
                {previewLines(body, previewLimit).map((line, index) => (
                  <Text key={`modal-${index}`}>{line}</Text>
                ))}
                <Row gap={1}>
                  <Button onClick={() => setPreviewOpen(false)}>Close</Button>
                </Row>
              </Column>
            </Modal>
          )}
        </Column>
      </Window>
    </App>
  );
}

runExample(<HelloApp />, import.meta.url);

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
