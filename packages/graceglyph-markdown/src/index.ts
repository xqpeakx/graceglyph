import {
  Markdown,
  Panel,
  definePlugin,
  h,
  type ComponentFn,
  type GraceglyphPlugin,
  type StyleLike,
} from "graceglyph";

export interface MarkdownDocumentProps {
  source: string;
  width?: number;
  style?: StyleLike;
}

export interface MarkdownCardProps extends MarkdownDocumentProps {
  title?: string;
}

export interface MarkdownPluginOptions {
  defaultWidth?: number;
  includeHelpCommand?: boolean;
}

/**
 * Markdown renderer component for plugin consumers. Preprocesses common
 * authoring shorthand (task lists + bare links) before delegating to core
 * Markdown so the plugin can evolve independently.
 */
export function MarkdownDocument(props: MarkdownDocumentProps) {
  return h(Markdown, {
    children: normalizeMarkdown(props.source),
    width: props.width,
    style: props.style,
  });
}

/**
 * Convenience wrapper that adds Panel chrome around MarkdownDocument.
 */
export function MarkdownCard(props: MarkdownCardProps) {
  return h(
    Panel,
    {
      title: props.title ?? "Markdown",
      width: props.width,
      style: props.style,
    },
    h(MarkdownDocument, { source: props.source, width: props.width }),
  );
}

export function createMarkdownPlugin(options: MarkdownPluginOptions = {}): GraceglyphPlugin {
  const defaultWidth = options.defaultWidth;
  const includeHelpCommand = options.includeHelpCommand ?? true;
  return definePlugin({
    id: "@graceglyph/markdown",
    version: "0.1.0",
    description: "Expanded markdown rendering plugin with code highlighting passthrough.",
    components: {
      MarkdownDocument: ((props: MarkdownDocumentProps) =>
        h(MarkdownDocument, {
          ...props,
          width: props.width ?? defaultWidth,
        })) as ComponentFn<MarkdownDocumentProps>,
      MarkdownCard: ((props: MarkdownCardProps) =>
        h(MarkdownCard, {
          ...props,
          width: props.width ?? defaultWidth,
        })) as ComponentFn<MarkdownCardProps>,
    },
    commands: includeHelpCommand
      ? [
          {
            id: "markdown.help",
            title: "Markdown: formatting quick reference",
            group: "Markdown",
            run: () => {},
          },
        ]
      : [],
  });
}

export const markdownPlugin = createMarkdownPlugin();

export function normalizeMarkdown(source: string): string {
  const withTaskLists = source
    .replace(/^(\s*[-*]\s+)\[ \]\s+/gm, "$1☐ ")
    .replace(/^(\s*[-*]\s+)\[[xX]\]\s+/gm, "$1☑ ");
  return withTaskLists.replace(
    /(^|[\s(])((https?:\/\/[^\s)]+))/g,
    (_, prefix: string, url: string) => {
      if (url.includes("](")) return `${prefix}${url}`;
      return `${prefix}[${url}](${url})`;
    },
  );
}
