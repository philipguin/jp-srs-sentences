import type { LlmClient, StructuredJsonRequest } from "./llmClient";

/**
 * Responses API returns an object with an `output` array containing content items.
 * We extract the first textual content we can find and parse it as JSON.
 */
function extractAnyText(res: any): string | null {
  // Some SDKs have output_text helpers, but in raw REST we defensively inspect.
  if (typeof res?.output_text === "string") return res.output_text;

  const out = res?.output;
  if (!Array.isArray(out)) return null;

  for (const item of out) {
    const content = item?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (typeof c?.text === "string") return c.text;
      if (typeof c?.content === "string") return c.content;
    }
  }
  return null;
}

async function requestStructuredJson<T>(request: StructuredJsonRequest): Promise<T> {
  const body = {
    model: request.model,
    input: [
      {
        role: "system",
        content: request.system,
      },
      {
        role: "user",
        content: request.prompt,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: request.schemaName,
        strict: true,
        schema: request.schema,
      },
    },
  };

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${request.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`OpenAI error (${resp.status}): ${t || resp.statusText}`);
  }

  const data = await resp.json();
  const txt = extractAnyText(data);
  if (!txt) throw new Error("Could not extract text from Responses API result.");

  let parsed: T;
  try {
    parsed = JSON.parse(txt) as T;
  } catch {
    throw new Error("Model returned non-JSON text (unexpected). Try again.");
  }

  return parsed;
}

export const openAiClient: LlmClient = {
  requestStructuredJson,
};
