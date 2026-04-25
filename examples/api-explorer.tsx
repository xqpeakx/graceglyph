/** @jsx h */

import {
  App,
  Button,
  Column,
  List,
  Panel,
  Row,
  Text,
  TextArea,
  TextInput,
  Window,
  ansi,
  h,
  useCommand,
  useEffect,
  useState,
  useTerminalSize,
} from "../src/index.js";
import type { KeyEvent, ZenElement } from "../src/index.js";
import { runExample } from "./_entry.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  ok: boolean;
  durationMs: number;
  headers: Record<string, string>;
  body: string;
  contentType: string;
}

export interface ApiClient {
  send(request: Omit<ApiRequest, "id" | "name">): Promise<ApiResponse>;
}

interface ApiHistoryItem {
  id: string;
  request: ApiRequest;
  response: ApiResponse;
  capturedAt: number;
}

export interface ApiExplorerAppProps {
  client?: ApiClient;
  collections?: readonly ApiRequest[];
}

const DEFAULT_COLLECTIONS: readonly ApiRequest[] = [
  {
    id: "gh-repo",
    name: "GitHub repo",
    method: "GET",
    url: "https://api.github.com/repos/nodejs/node",
    headers: { Accept: "application/vnd.github+json" },
    body: "",
  },
  {
    id: "httpbin-post",
    name: "Echo JSON",
    method: "POST",
    url: "https://httpbin.org/post",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "graceglyph", kind: "demo" }, null, 2),
  },
  {
    id: "local-health",
    name: "Local health",
    method: "GET",
    url: "http://127.0.0.1:3000/health",
    headers: {},
    body: "",
  },
] as const;

const METHODS: readonly HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export function ApiExplorerApp(props: ApiExplorerAppProps = {}) {
  const size = useTerminalSize();
  const compact = size.height < 25;
  const stacked = size.width < 108;
  const [client] = useState(() => props.client ?? createFetchApiClient());
  const [collections, setCollections] = useState<ApiRequest[]>(() => [
    ...(props.collections ?? DEFAULT_COLLECTIONS),
  ]);
  const [selectedCollection, setSelectedCollection] = useState(0);
  const [method, setMethod] = useState<HttpMethod>(collections[0]?.method ?? "GET");
  const [url, setUrl] = useState(collections[0]?.url ?? "");
  const [headersText, setHeadersText] = useState(formatHeaders(collections[0]?.headers ?? {}));
  const [body, setBody] = useState(collections[0]?.body ?? "");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [responseLine, setResponseLine] = useState(0);
  const [history, setHistory] = useState<ApiHistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState(0);
  const [status, setStatus] = useState("ready");

  const responseLines = response
    ? formatResponseLines(response)
    : ["Send a request to inspect the response."];
  const collectionsHeight = stacked
    ? Math.max(3, Math.min(5, collections.length))
    : Math.max(5, Math.min(8, collections.length));
  const responseHeight = stacked
    ? Math.max(5, Math.min(10, size.height - 19))
    : Math.max(9, Math.min(18, size.height - 12));
  const bodyHeight = compact ? 3 : Math.max(4, Math.min(8, Math.floor(size.height / 4)));

  useEffect(() => {
    setResponseLine((index) => clamp(index, responseLines.length));
  }, [responseLines.length]);

  useEffect(() => {
    setSelectedCollection((index) => clamp(index, collections.length));
  }, [collections.length]);

  useEffect(() => {
    setSelectedHistory((index) => clamp(index, history.length));
  }, [history.length]);

  function loadCollection(index: number): void {
    const next = collections[index];
    if (!next) return;
    setSelectedCollection(index);
    setMethod(next.method);
    setUrl(next.url);
    setHeadersText(formatHeaders(next.headers));
    setBody(next.body);
    setStatus(`loaded ${next.name}`);
  }

  function currentRequest(name = requestName(method, url)): ApiRequest {
    const parsed = parseHeaders(headersText);
    return {
      id: `request-${Date.now()}`,
      name,
      method,
      url,
      headers: parsed.value,
      body,
    };
  }

  function saveRequest(): void {
    const headers = parseHeaders(headersText);
    if (headers.error) {
      setStatus(`header error: ${headers.error}`);
      return;
    }
    const request = {
      ...currentRequest(),
      headers: headers.value,
    };
    setCollections((items) => [request, ...items].slice(0, 20));
    setSelectedCollection(0);
    setStatus(`saved ${request.name}`);
  }

  function loadHistory(index: number): void {
    const item = history[index];
    if (!item) return;
    setSelectedHistory(index);
    setMethod(item.request.method);
    setUrl(item.request.url);
    setHeadersText(formatHeaders(item.request.headers));
    setBody(item.request.body);
    setResponse(item.response);
    setStatus(`restored ${item.request.name}`);
  }

  async function sendRequest(): Promise<void> {
    const headers = parseHeaders(headersText);
    if (headers.error) {
      setStatus(`header error: ${headers.error}`);
      return;
    }

    setStatus(`sending ${method} ${url}`);
    try {
      const request = {
        id: `request-${Date.now()}`,
        name: requestName(method, url),
        method,
        url,
        headers: headers.value,
        body: method === "GET" || method === "DELETE" ? "" : body,
      };
      const next = await client.send({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
      });
      setResponse(next);
      setResponseLine(0);
      setHistory((items) =>
        [
          {
            id: `${request.id}-${next.status}`,
            request,
            response: next,
            capturedAt: Date.now(),
          },
          ...items,
        ].slice(0, 30),
      );
      setSelectedHistory(0);
      setStatus(`${next.status} ${next.statusText} in ${next.durationMs.toFixed(0)}ms`);
    } catch (error) {
      setResponse(null);
      setStatus(`request failed: ${messageOf(error)}`);
    }
  }

  function cycleMethod(): void {
    const index = METHODS.indexOf(method);
    const next = METHODS[(index + 1) % METHODS.length] ?? "GET";
    setMethod(next);
    setStatus(`method ${next}`);
  }

  function onWindowKey(event: KeyEvent): boolean | void {
    if (event.ctrl || event.alt) return false;
    if (event.name === "f5") {
      void sendRequest();
      return true;
    }
    if (event.name !== "char" || !event.char) return false;
    const key = event.char.toLowerCase();
    if (key === "g") {
      setMethod("GET");
      return true;
    }
    if (key === "p") {
      setMethod("POST");
      return true;
    }
    return false;
  }

  useCommand(
    {
      id: "api-explorer.send",
      title: "Send request",
      group: "API explorer",
      keys: ["f5"],
      run: () => {
        void sendRequest();
      },
    },
    [method, url, headersText, body],
  );
  useCommand(
    {
      id: "api-explorer.save",
      title: "Save request",
      group: "API explorer",
      keys: ["s"],
      run: saveRequest,
    },
    [method, url, headersText, body],
  );
  useCommand(
    {
      id: "api-explorer.method",
      title: "Cycle HTTP method",
      group: "API explorer",
      keys: ["m"],
      run: cycleMethod,
    },
    [method],
  );
  useCommand(
    {
      id: "api-explorer.clear-response",
      title: "Clear response",
      group: "API explorer",
      keys: ["c"],
      run: () => setResponse(null),
    },
    [],
  );

  return (
    <App>
      <Window title="API explorer" grow={1} padding={compact ? 0 : 1} onKey={onWindowKey}>
        <Column gap={compact ? 0 : 1} grow={1}>
          {!compact && (
            <Text style={{ dim: true }}>
              Saved collections, editable requests, JSON response viewer, timing, and headers. F5
              sends.
            </Text>
          )}

          {stacked ? (
            <Column gap={compact ? 0 : 1} grow={1}>
              <CollectionsPanel
                collections={collections}
                selected={selectedCollection}
                onChange={setSelectedCollection}
                onSelect={loadCollection}
                height={collectionsHeight}
              />
              {!compact && (
                <HistoryPanel
                  history={history}
                  selected={selectedHistory}
                  onChange={setSelectedHistory}
                  onSelect={loadHistory}
                  height={Math.max(3, Math.min(5, history.length || 3))}
                />
              )}
              <RequestPanel
                method={method}
                setMethod={setMethod}
                url={url}
                setUrl={setUrl}
                headersText={headersText}
                setHeadersText={setHeadersText}
                body={body}
                setBody={setBody}
                bodyHeight={bodyHeight}
                onSend={() => void sendRequest()}
                onSave={saveRequest}
              />
              <ResponsePanel
                response={response}
                lines={responseLines}
                selected={responseLine}
                onChange={setResponseLine}
                height={responseHeight}
              />
            </Column>
          ) : (
            <Row gap={1} grow={1}>
              <Column width={27} gap={1}>
                <CollectionsPanel
                  collections={collections}
                  selected={selectedCollection}
                  onChange={setSelectedCollection}
                  onSelect={loadCollection}
                  height={collectionsHeight}
                />
                <HistoryPanel
                  history={history}
                  selected={selectedHistory}
                  onChange={setSelectedHistory}
                  onSelect={loadHistory}
                  height={Math.max(3, Math.min(5, size.height - 25))}
                />
                <RequestStats response={response} />
              </Column>
              <RequestPanel
                method={method}
                setMethod={setMethod}
                url={url}
                setUrl={setUrl}
                headersText={headersText}
                setHeadersText={setHeadersText}
                body={body}
                setBody={setBody}
                bodyHeight={bodyHeight}
                onSend={() => void sendRequest()}
                onSave={saveRequest}
              />
              <ResponsePanel
                response={response}
                lines={responseLines}
                selected={responseLine}
                onChange={setResponseLine}
                height={responseHeight}
              />
            </Row>
          )}

          <Text style={{ dim: true }}>
            {status} | method keys g/p | Tab moves focus | F12 inspector
          </Text>
        </Column>
      </Window>
    </App>
  );
}

runExample(<ApiExplorerApp />, import.meta.url);

export function createFetchApiClient(): ApiClient {
  return {
    async send(request): Promise<ApiResponse> {
      const started = Date.now();
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body.length > 0 ? request.body : undefined,
      });
      const bodyText = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        durationMs: Date.now() - started,
        headers,
        body: bodyText,
        contentType: response.headers.get("content-type") ?? "",
      };
    },
  };
}

export function createStaticApiClient(response: ApiResponse): ApiClient {
  return {
    async send(): Promise<ApiResponse> {
      return response;
    },
  };
}

function CollectionsPanel(props: {
  collections: readonly ApiRequest[];
  selected: number;
  onChange: (index: number) => void;
  onSelect: (index: number) => void;
  height: number;
}) {
  return (
    <Panel title="Collections" padding={0}>
      <List
        items={props.collections}
        selected={props.selected}
        onChange={props.onChange}
        onSelect={props.onSelect}
        height={props.height}
        render={(item) => `${item.method.padEnd(6, " ")} ${item.name}`}
      />
    </Panel>
  );
}

function RequestPanel(props: {
  method: HttpMethod;
  setMethod: (method: HttpMethod) => void;
  url: string;
  setUrl: (url: string) => void;
  headersText: string;
  setHeadersText: (value: string) => void;
  body: string;
  setBody: (value: string) => void;
  bodyHeight: number;
  onSend: () => void;
  onSave: () => void;
}) {
  return (
    <Panel title="Request" padding={0} grow={1}>
      <Column gap={1} grow={1}>
        <Row gap={1}>
          {METHODS.map((item) => (
            <Button
              key={item}
              onClick={() => props.setMethod(item)}
              style={item === props.method ? { fg: ansi(15), bg: ansi(4), bold: true } : undefined}
            >
              {item}
            </Button>
          ))}
        </Row>
        <TextInput
          value={props.url}
          onChange={props.setUrl}
          placeholder="https://api.example.test/resource"
        />
        <TextArea
          value={props.headersText}
          onChange={props.setHeadersText}
          height={3}
          placeholder={"Accept: application/json\nAuthorization: Bearer token"}
        />
        <TextArea
          value={props.body}
          onChange={props.setBody}
          height={props.bodyHeight}
          placeholder={'{\n  "name": "demo"\n}'}
        />
        <Row gap={1}>
          <Button onClick={props.onSend}>Send</Button>
          <Button onClick={props.onSave}>Save</Button>
          <Text style={{ dim: true }}>GET/DELETE ignore the body.</Text>
        </Row>
      </Column>
    </Panel>
  );
}

function HistoryPanel(props: {
  history: readonly ApiHistoryItem[];
  selected: number;
  onChange: (index: number) => void;
  onSelect: (index: number) => void;
  height: number;
}) {
  return (
    <Panel title="History" padding={0}>
      {props.history.length > 0 ? (
        <List
          items={props.history}
          selected={props.selected}
          onChange={props.onChange}
          onSelect={props.onSelect}
          height={props.height}
          render={(item) =>
            `${item.response.status} ${item.request.method} ${truncate(item.request.name, 14)}`
          }
        />
      ) : (
        <Text style={{ dim: true }}>Sent requests appear here.</Text>
      )}
    </Panel>
  );
}

function ResponsePanel(props: {
  response: ApiResponse | null;
  lines: readonly string[];
  selected: number;
  onChange: (index: number) => void;
  height: number;
}) {
  const title = props.response
    ? `Response ${props.response.status} ${props.response.durationMs.toFixed(0)}ms`
    : "Response";
  return (
    <Panel title={title} padding={0} grow={1}>
      <Column gap={0} grow={1}>
        {props.response && (
          <Text
            style={props.response.ok ? { fg: ansi(2), bold: true } : { fg: ansi(1), bold: true }}
          >
            {props.response.status} {props.response.statusText} |{" "}
            {props.response.contentType || "unknown content"}
          </Text>
        )}
        <List
          items={props.lines}
          selected={props.selected}
          onChange={props.onChange}
          height={props.height}
          render={(line) => formatResponseLine(line)}
        />
      </Column>
    </Panel>
  );
}

function RequestStats(props: { response: ApiResponse | null }) {
  const response = props.response;
  return (
    <Panel title="Headers" padding={0} grow={1}>
      <Column gap={0}>
        {response ? (
          Object.entries(response.headers)
            .slice(0, 8)
            .map(([key, value]) => <Text key={key}>{truncate(`${key}: ${value}`, 24)}</Text>)
        ) : (
          <Text style={{ dim: true }}>Response headers appear here after send.</Text>
        )}
      </Column>
    </Panel>
  );
}

function parseHeaders(value: string): { value: Record<string, string>; error: string | null } {
  const headers: Record<string, string> = {};
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const separator = trimmed.indexOf(":");
    if (separator <= 0) return { value: {}, error: `invalid header "${trimmed}"` };
    headers[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
  return { value: headers, error: null };
}

function formatHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function formatResponseLines(response: ApiResponse): string[] {
  const headerLines = Object.entries(response.headers)
    .slice(0, 12)
    .map(([key, value]) => `${key}: ${value}`);
  return [
    `${response.status} ${response.statusText}`,
    `time: ${response.durationMs.toFixed(0)}ms`,
    "",
    ...headerLines,
    "",
    ...prettyBody(response.body, response.contentType),
  ];
}

function requestName(method: HttpMethod, url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? parsed.hostname : `${parsed.hostname}${parsed.pathname}`;
    return `${method} ${path}`;
  } catch {
    return `${method} ${url || "request"}`;
  }
}

function prettyBody(body: string, contentType: string): string[] {
  const text = body.trim();
  if (text.length === 0) return ["(empty body)"];
  if (contentType.includes("json") || text.startsWith("{") || text.startsWith("[")) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2).split("\n");
    } catch {
      return text.split(/\r?\n/);
    }
  }
  return text.split(/\r?\n/);
}

function formatResponseLine(line: string): ZenElement {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('"') && trimmed.includes(":")) {
    return <Text style={{ fg: ansi(6) }}>{line}</Text>;
  }
  if (trimmed === "true" || trimmed === "false" || /^-?\d+(\.\d+)?[, ]?$/.test(trimmed)) {
    return <Text style={{ fg: ansi(3) }}>{line}</Text>;
  }
  return <Text>{line.length > 0 ? line : " "}</Text>;
}

function truncate(value: string, width: number): string {
  if (value.length <= width) return value;
  return `${value.slice(0, Math.max(0, width - 3))}...`;
}

function clamp(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(index, length - 1);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
