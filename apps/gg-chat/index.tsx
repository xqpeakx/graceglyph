#!/usr/bin/env node

import {
  App,
  Avatar,
  Badge,
  Box,
  Button,
  Column,
  Panel,
  Row,
  Text,
  TextInput,
  Window,
  builtInThemes,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  h,
  render,
  useState,
} from "../../src/index.js";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: number;
  role: ChatRole;
  content: string;
}

/**
 * Pluggable model interface. Apps can swap this for a real provider.
 * The default `echoModel` returns a token-by-token reflection so the demo
 * runs without any API keys.
 */
export interface ChatModel {
  /** Returns an async iterable that yields tokens. */
  stream(history: readonly ChatMessage[]): AsyncIterable<string>;
}

export function echoModel(opts: { delayMs?: number } = {}): ChatModel {
  const delay = opts.delayMs ?? 30;
  return {
    async *stream(history) {
      const last = history[history.length - 1];
      const text = last?.content ?? "";
      const reply = `you said: ${text}\n\n(swap echoModel for a real provider — the renderer doesn't care).`;
      for (const word of reply.split(/(\s+)/)) {
        yield word;
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      }
    },
  };
}

export interface ParsedChatArgs {
  intervalMs: number;
  theme?: string;
}

export function parseArgs(argv: readonly string[]): ParsedChatArgs {
  let intervalMs = 30;
  let theme: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--delay") {
      const ms = Number(argv[++i]);
      if (!Number.isFinite(ms) || ms < 0) throw new Error("--delay requires a non-negative number");
      intervalMs = ms;
      continue;
    }
    if (arg === "--theme") {
      theme = argv[++i];
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`unknown flag: ${arg}`);
  }
  return { intervalMs, theme };
}

function printHelp(): void {
  process.stdout.write("gg-chat [--delay ms] [--theme name]\n");
  process.stdout.write("\n");
  process.stdout.write("Streaming chat client demo. Swap apps/gg-chat/index.tsx#echoModel\n");
  process.stdout.write("for a real provider — the renderer is provider-agnostic.\n");
}

interface AppProps {
  model: ChatModel;
}

function GgChatApp(props: AppProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: "assistant", content: "Welcome to gg-chat. Type a message and press Enter." },
  ]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<number | null>(null);

  function appendMessage(message: ChatMessage): void {
    setMessages((current) => [...current, message]);
  }

  async function send(): Promise<void> {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || streamingText !== null) return;
    const userMsg: ChatMessage = { id: messages.length + 1, role: "user", content: trimmed };
    const id = userMsg.id + 1;
    appendMessage(userMsg);
    setDraft("");
    setStreamingId(id);
    setStreamingText("");
    try {
      let acc = "";
      for await (const token of props.model.stream([...messages, userMsg])) {
        acc += token;
        setStreamingText(acc);
      }
      appendMessage({ id, role: "assistant", content: acc });
    } catch (err) {
      appendMessage({
        id,
        role: "assistant",
        content: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setStreamingText(null);
      setStreamingId(null);
    }
  }

  // Keep the streaming row up to date during render — no extra subscription
  // needed since setStreamingText already triggers a re-render per token.

  return (
    <App>
      <Window title="gg-chat" grow={1} padding={1}>
        <Column gap={1} grow={1}>
          <Panel title="Conversation" grow={1} padding={1}>
            <Column gap={1}>
              {messages.map((m) => (
                <ChatRow key={m.id} message={m} />
              ))}
              {streamingText !== null ? (
                <ChatRow
                  key={streamingId ?? "streaming"}
                  message={{
                    id: streamingId ?? 0,
                    role: "assistant",
                    content: streamingText,
                  }}
                  streaming
                />
              ) : null}
            </Column>
          </Panel>

          <Row gap={1}>
            <TextInput
              value={draft}
              onChange={setDraft}
              placeholder="say something"
              grow={1}
              onSubmit={() => void send()}
            />
            <Button onClick={() => void send()} disabled={streamingText !== null}>
              Send
            </Button>
            {streamingText !== null ? <Badge variant="warning">streaming…</Badge> : null}
          </Row>
        </Column>
      </Window>
    </App>
  );
}

function ChatRow(props: { message: ChatMessage; streaming?: boolean }) {
  const { role, content } = props.message;
  return (
    <Row gap={1}>
      <Avatar
        glyph={role === "user" ? "U" : role === "assistant" ? "A" : "S"}
        variant={role === "user" ? "primary" : "accent"}
        size={3}
      />
      <Box grow={1}>
        <Text wrap="truncate">{content}</Text>
      </Box>
      {props.streaming ? <Text style={{ dim: true }}>▍</Text> : null}
    </Row>
  );
}

const isMain =
  typeof import.meta?.url === "string" &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const handle = render(<GgChatApp model={echoModel({ delayMs: args.intervalMs })} />);
  if (args.theme && args.theme in builtInThemes) {
    handle.setTheme(builtInThemes[args.theme as keyof typeof builtInThemes]);
  }
}
