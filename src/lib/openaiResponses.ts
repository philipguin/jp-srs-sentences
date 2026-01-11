import type { AppSettings, Job, SentenceGeneration, DefinitionRecommendation } from "../state/types";
import { DIFFICULTY_PROFILES } from "../state/difficulty";
import { applyTemplate } from "./template";
import Mustache from "mustache";
import generateSentencesTemplate from "../prompts/generateSentences.mustache?raw";
import analyzeDefinitionsTemplate from "../prompts/analyzeDefinitions.mustache?raw";

type ModelItem = { defIndex: number; jp: string; en: string };
type ModelPayload = { items: ModelItem[] };
type DefinitionAnalysisItem = {
  defIndex: number;
  recommendation: DefinitionRecommendation;
  comment: string;
  colocations: string[];
};
type DefinitionAnalysisPayload = { items: DefinitionAnalysisItem[] };

function uid(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function buildSentencePrompt(job: Job): string {
  const difficulty = DIFFICULTY_PROFILES[job.difficulty];
  return Mustache.render(generateSentencesTemplate, {
    word: job.word || "(not provided)",
    reading: job.reading || "(not provided)",
    difficultyGuidelines: difficulty.promptGuidelines,
    maxJapaneseChars: difficulty.maxJapaneseChars,
    definitions: job.definitions.map((d) => ({
      index: d.index,
      text: d.text,
      count: d.count,
    })),
  });
}

function buildDefinitionAnalysisPrompt(job: Job): string {
  return Mustache.render(analyzeDefinitionsTemplate, {
    word: job.word || "(not provided)",
    reading: job.reading || "(not provided)",
    definitions: job.definitions.map((d) => ({
      index: d.index,
      text: d.text,
    })),
  });
}

function schemaForOutput() {
  // JSON Schema for Structured Outputs (Responses API)
  return {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["defIndex", "jp", "en"],
          properties: {
            defIndex: { type: "integer" },
            jp: { type: "string" },
            en: { type: "string" },
          },
        },
      },
    },
  };
}

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

export async function generateSentences(job: Job, settings: AppSettings): Promise<SentenceGeneration[]> {
  if (!settings.apiKey) throw new Error("Missing API key (Settings → API Key).");
  if (!settings.model) throw new Error("Missing model (Settings → Model).");
  if (!job.word.trim()) throw new Error("Job is missing a target word.");
  if (job.definitions.length === 0) throw new Error("Job has no parsed definitions.");

  const totalNeeded = job.definitions.reduce((sum, d) => sum + (d.count || 0), 0);
  if (totalNeeded <= 0) throw new Error("All definition counts are zero.");

  const prompt = buildSentencePrompt(job);

  const body = {
    model: settings.model,
    input: [
      {
        role: "system",
        content: "You generate Japanese example sentences for SRS study.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    // Structured Outputs: json_schema
    text: {
      format: {
        type: "json_schema",
        name: "jp_srs_sentences",
        strict: true,
        schema: schemaForOutput(),
      },
    },
  };

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
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

  let parsed: ModelPayload;
  try {
    parsed = JSON.parse(txt) as ModelPayload;
  } catch {
    throw new Error("Model returned non-JSON text (unexpected). Try again.");
  }

  if (!parsed?.items || !Array.isArray(parsed.items)) {
    throw new Error("JSON did not match expected schema (items array missing).");
  }

  const defsByIndex = new Map(job.definitions.map((d) => [d.index, d.text]));
  const indicesByDefIdx = new Array(job.definitions.length);

  // Build results + compute notes via your template
  const now = Date.now();
  const results: SentenceGeneration[] = parsed.items.map((it) => {
    const meaning = defsByIndex.get(it.defIndex) ?? "";
    const notes = applyTemplate(settings.notesTemplate, {
      word: job.word,
      meaning,
      defIndex: String(it.defIndex),
      reading: job.reading ?? "",
      difficulty: job.difficulty,
    });

    const subIdx = indicesByDefIdx[it.defIndex] ?? 0;
    indicesByDefIdx[it.defIndex] = subIdx + 1;

    return {
      id: uid(),
      defIndex: it.defIndex,
      defSubIndex: subIdx,
      jp: it.jp,
      en: it.en,
      notes,
      createdAt: now,
      difficulty: job.difficulty,
    };
  });

  return results;
}

function schemaForDefinitionAnalysis() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["defIndex", "recommendation", "comment", "colocations"],
          properties: {
            defIndex: { type: "integer" },
            recommendation: { type: "string", enum: ["recall", "recognize", "drop"] },
            comment: { type: "string" },
            colocations: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
  };
}

export async function analyzeDefinitions(job: Job, settings: AppSettings): Promise<DefinitionAnalysisItem[]> {
  if (!settings.apiKey) throw new Error("Missing API key (Settings → API Key).");
  if (!settings.model) throw new Error("Missing model (Settings → Model).");
  if (!job.word.trim()) throw new Error("Job is missing a target word.");
  if (job.definitions.length === 0) throw new Error("Job has no parsed definitions.");

  const prompt = buildDefinitionAnalysisPrompt(job);

  const body = {
    model: settings.model,
    input: [
      {
        role: "system",
        content: "You analyze Japanese dictionary definitions for SRS study planning.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "jp_srs_definition_analysis",
        strict: true,
        schema: schemaForDefinitionAnalysis(),
      },
    },
  };

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
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

  let parsed: DefinitionAnalysisPayload;
  try {
    parsed = JSON.parse(txt) as DefinitionAnalysisPayload;
  } catch {
    throw new Error("Model returned non-JSON text (unexpected). Try again.");
  }

  if (!parsed?.items || !Array.isArray(parsed.items)) {
    throw new Error("JSON did not match expected schema (items array missing).");
  }

  return parsed.items;
}
