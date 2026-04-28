import { EventEmitter } from "node:events";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  App,
  Badge,
  Column,
  DUMB_CAPABILITIES,
  FULL_CAPABILITIES,
  Image,
  Link,
  ProgressBar,
  Row,
  Text,
  Window,
  h,
  render,
  type RuntimeOptions,
  type ZenElement,
} from "../src/index.js";

type CapabilityProfileId = "full" | "dumb" | "graphics";

interface CapabilityProfile {
  id: CapabilityProfileId;
  label: string;
  capabilities: RuntimeOptions["capabilities"];
}

interface PlaygroundFixture {
  width: number;
  height: number;
  ansi: string;
}

interface PlaygroundExample {
  id: string;
  title: string;
  description: string;
  code: string;
  render: () => ZenElement;
}

class FakeInput extends EventEmitter {
  readonly isTTY = true;
  setRawMode(): void {}
  resume(): void {}
  pause(): void {}
}

class FakeOutput extends EventEmitter {
  columns: number;
  rows: number;
  private chunks: string[] = [];

  constructor(width: number, height: number) {
    super();
    this.columns = width;
    this.rows = height;
  }

  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }

  output(): string {
    return this.chunks.join("");
  }
}

const PROFILES: CapabilityProfile[] = [
  { id: "full", label: "Full", capabilities: FULL_CAPABILITIES },
  { id: "dumb", label: "Dumb", capabilities: DUMB_CAPABILITIES },
  {
    id: "graphics",
    label: "Graphics",
    capabilities: {
      ...FULL_CAPABILITIES,
      kittyGraphics: true,
      sixel: true,
      iterm2Images: true,
      hyperlinks: true,
    },
  },
];

const EXAMPLES: PlaygroundExample[] = [
  {
    id: "layout-basics",
    title: "Layout + Components",
    description: "Composable primitives with spacing, badges, and progress.",
    code: `h(App, {},
  h(Window, { title: "Deploy", width: 56, height: 10 },
    h(Column, { gap: 1 },
      h(Row, { gap: 1 },
        h(Badge, { variant: "info", children: "v1.2.4" }),
        h(Text, {}, "Streaming logs")
      ),
      h(ProgressBar, { value: 0.64, width: 36, showPercent: true, label: "upload" })
    )
  )
)`,
    render: () =>
      h(
        App,
        {},
        h(
          Window,
          { title: "Deploy", width: 56, height: 10 },
          h(
            Column,
            { gap: 1 },
            h(
              Row,
              { gap: 1 },
              h(Badge, { variant: "info", children: "v1.2.4" }),
              h(Text, {}, "Streaming logs"),
            ),
            h(ProgressBar, { value: 0.64, width: 36, showPercent: true, label: "upload" }),
          ),
        ),
      ),
  },
  {
    id: "links",
    title: "Capability-Aware Links",
    description: "OSC 8 hyperlinks on capable terminals, visible fallback otherwise.",
    code: `h(App, {},
  h(Column, { gap: 1 },
    h(Text, {}, "Read the docs:"),
    h(Link, { href: "https://graceglyph.dev", children: "graceglyph.dev/docs" })
  )
)`,
    render: () =>
      h(
        App,
        {},
        h(
          Column,
          { gap: 1 },
          h(Text, {}, "Read the docs:"),
          h(Link, { href: "https://graceglyph.dev", children: "graceglyph.dev/docs" }),
        ),
      ),
  },
  {
    id: "image-protocols",
    title: "Inline Image Protocols",
    description: "Auto protocol routing across Kitty/Sixel/iTerm2 with fallback behavior.",
    code: `h(App, {},
  h(Image, { src: "/tmp/cat.png", alt: "Cat", protocol: "auto", width: 50, height: 8 })
)`,
    render: () =>
      h(
        App,
        {},
        h(Image, { src: "/tmp/cat.png", alt: "Cat", protocol: "auto", width: 50, height: 8 }),
      ),
  },
];

async function renderAnsi(
  element: ZenElement,
  profile: CapabilityProfile,
  width = 72,
  height = 14,
): Promise<PlaygroundFixture> {
  const input = new FakeInput();
  const output = new FakeOutput(width, height);
  const handle = render(element, {
    input: input as never,
    output: output as never,
    capabilities: profile.capabilities,
  });

  await settleRuntime();
  const ansi = output.output();
  handle.stop();
  return { width, height, ansi };
}

async function settleRuntime(turns = 2): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

async function main(): Promise<void> {
  const payload: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    profiles: PROFILES.map((p) => ({ id: p.id, label: p.label })),
    examples: [],
  };

  const examples: Array<Record<string, unknown>> = [];
  for (const example of EXAMPLES) {
    const fixtures: Record<string, PlaygroundFixture> = {};
    for (const profile of PROFILES) {
      fixtures[profile.id] = await renderAnsi(example.render(), profile);
    }
    examples.push({
      id: example.id,
      title: example.title,
      description: example.description,
      code: example.code,
      fixtures,
    });
  }

  payload.examples = examples;
  const target = resolve(process.cwd(), "docs/site/.vitepress/playground-fixtures.json");
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  // eslint-disable-next-line no-console
  console.log(`wrote ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
