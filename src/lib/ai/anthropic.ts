import Anthropic from "@anthropic-ai/sdk";
import { z, type ZodTypeAny } from "zod";

let cachedClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicConfigError(
      "ANTHROPIC_API_KEY is not set. AI features are disabled.",
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class AnthropicConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnthropicConfigError";
  }
}

const FENCE_RE = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/;

function extractJsonString(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(FENCE_RE);
  if (fenced) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    start = Math.min(firstBrace, firstBracket);
  } else {
    start = Math.max(firstBrace, firstBracket);
  }
  if (start === -1) return trimmed;
  const lastBrace = trimmed.lastIndexOf("}");
  const lastBracket = trimmed.lastIndexOf("]");
  const end = Math.max(lastBrace, lastBracket);
  if (end <= start) return trimmed;
  return trimmed.slice(start, end + 1);
}

type CallClaudeJsonArgs<T extends ZodTypeAny> = {
  model: "claude-opus-4-7" | "claude-haiku-4-5";
  maxTokens?: number;
  system?: string | Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
  schema: T;
  schemaDescription?: string;
};

export async function callClaudeJson<T extends ZodTypeAny>(
  args: CallClaudeJsonArgs<T>,
): Promise<z.infer<T>> {
  const client = getAnthropicClient();

  const systemBase =
    typeof args.system === "string"
      ? [
          {
            type: "text" as const,
            text: args.system,
            cache_control: { type: "ephemeral" as const },
          },
        ]
      : args.system;

  const schemaInstruction = args.schemaDescription
    ? `\n\nYou MUST reply with a single JSON object that matches this contract:\n${args.schemaDescription}\nReturn ONLY the JSON object — no prose, no markdown fences.`
    : "\n\nReply with a single JSON object only. No prose, no markdown fences.";

  const system: Anthropic.TextBlockParam[] = systemBase
    ? [
        ...systemBase,
        {
          type: "text",
          text: schemaInstruction,
        },
      ]
    : [{ type: "text", text: schemaInstruction.trimStart() }];

  const response = await client.messages.create({
    model: args.model,
    max_tokens: args.maxTokens ?? 4096,
    system,
    messages: args.messages,
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Anthropic returned no text content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonString(text));
  } catch {
    throw new Error(
      `Anthropic returned non-JSON output (first 200 chars): ${text.slice(0, 200)}`,
    );
  }

  return args.schema.parse(parsed);
}

type CallClaudeWebSearchArgs<T extends ZodTypeAny> = {
  maxTokens?: number;
  system?: string;
  userPrompt: string;
  schema: T;
  schemaDescription: string;
  maxUses?: number;
};

export async function callClaudeWebSearch<T extends ZodTypeAny>(
  args: CallClaudeWebSearchArgs<T>,
): Promise<z.infer<T>> {
  const client = getAnthropicClient();

  const systemPrompt = `${args.system ?? ""}\n\nYou have access to a web_search tool. Use it to find authoritative manufacturer-published Safety Data Sheets. Always prefer URLs from the manufacturer's own domain over reseller or aggregator sites. When you are done searching, reply with a single JSON object matching this contract:\n${args.schemaDescription}\nReturn ONLY the JSON — no prose, no markdown fences.`.trim();

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: args.maxTokens ?? 4096,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: args.maxUses ?? 5,
      },
    ],
    messages: [{ role: "user", content: args.userPrompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Anthropic returned no text content from web search");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonString(text));
  } catch {
    throw new Error(
      `Web search call returned non-JSON output (first 200 chars): ${text.slice(0, 200)}`,
    );
  }

  return args.schema.parse(parsed);
}
