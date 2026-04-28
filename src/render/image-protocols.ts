import { existsSync, readFileSync } from "node:fs";
import { basename, extname } from "node:path";

export type InlineImageProtocol = "kitty" | "sixel" | "iterm2";

export interface InlineImageRequest {
  protocol: InlineImageProtocol;
  src: string;
  width?: number;
  height?: number;
}

export function buildInlineImageSequence(request: InlineImageRequest): string | undefined {
  switch (request.protocol) {
    case "kitty":
      return buildKittySequence(request.src, request.width, request.height);
    case "sixel":
      return buildSixelSequence(request.src);
    case "iterm2":
      return buildIterm2Sequence(request.src);
    default:
      return undefined;
  }
}

function buildKittySequence(src: string, width?: number, height?: number): string | undefined {
  const dims = [
    Number.isFinite(width) && width && width > 0 ? `c=${Math.floor(width)}` : "",
    Number.isFinite(height) && height && height > 0 ? `r=${Math.floor(height)}` : "",
  ]
    .filter((part) => part.length > 0)
    .join(",");

  const dimPart = dims.length > 0 ? `,${dims}` : "";
  if (src.startsWith("data:")) {
    const parsed = parseDataUri(src);
    if (!parsed || !parsed.base64) return undefined;
    return `\x1b_Ga=T,t=d,f=100${dimPart};${parsed.payload}\x1b\\`;
  }

  const payload = Buffer.from(src).toString("base64");
  return `\x1b_Ga=T,t=f,f=100${dimPart};${payload}\x1b\\`;
}

function buildSixelSequence(src: string): string | undefined {
  if (src.startsWith("\x1bP")) return src;

  if (src.startsWith("data:")) {
    const parsed = parseDataUri(src);
    if (!parsed || !parsed.base64) return undefined;
    return Buffer.from(parsed.payload, "base64").toString("latin1");
  }

  if (!existsSync(src)) return undefined;
  const ext = extname(src).toLowerCase();
  if (ext !== ".six" && ext !== ".sixel") return undefined;
  return readFileSync(src, "latin1");
}

function buildIterm2Sequence(src: string): string | undefined {
  const payload = readBinaryPayload(src);
  if (!payload) return undefined;
  const name = Buffer.from(payload.name).toString("base64");
  const bytes = payload.bytes;
  return `\x1b]1337;File=name=${name};size=${bytes.length};inline=1:${bytes.toString("base64")}\x07`;
}

function readBinaryPayload(src: string): { name: string; bytes: Buffer } | undefined {
  if (src.startsWith("data:")) {
    const parsed = parseDataUri(src);
    if (!parsed || !parsed.base64) return undefined;
    return {
      name: "inline-image",
      bytes: Buffer.from(parsed.payload, "base64"),
    };
  }

  if (!existsSync(src)) return undefined;
  return {
    name: basename(src),
    bytes: readFileSync(src),
  };
}

function parseDataUri(uri: string): { payload: string; base64: boolean } | undefined {
  const comma = uri.indexOf(",");
  if (comma < 0) return undefined;
  const metadata = uri.slice(5, comma);
  const payload = uri.slice(comma + 1);
  return {
    payload,
    base64: metadata.includes(";base64"),
  };
}
