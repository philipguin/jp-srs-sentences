import type { AppSettings } from "../settings/settingsTypes";
import type { Difficulty, SentenceGeneration } from "../sentenceGen/sentenceGenTypes";
import type { DefinitionStudyPriority, DefinitionValidity, WordEntry } from "../wordEntry/wordEntryTypes";
import { DIFFICULTY_PROFILES } from "../sentenceGen/sentenceGenDifficulty";
import { applyTemplate } from "../shared/template";
import Mustache from "mustache";
import generateSentencesTemplate from "../prompts/generateSentences.mustache?raw";
import analyzeMeaningsTemplate from "../prompts/analyzeMeanings.mustache?raw";

type ModelItem = { defIndex: number; jp: string; en: string };
type ModelPayload = { items: ModelItem[] };
type DefinitionAnalysisItem = {
  meaningIndex: number;
  validity: DefinitionValidity;
  studyPriority: DefinitionStudyPriority;
  comment: string;
  colocations: string[];
};
type DefinitionAnalysisPayload = { items: DefinitionAnalysisItem[] };

function uid(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
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

////////////////////////////////////////////////////////////////

function buildPromptForGenerateSentences(wordEntry: WordEntry, difficultyKey: Difficulty): string {
  const difficulty = DIFFICULTY_PROFILES[difficultyKey];
  return Mustache.render(generateSentencesTemplate, {
    word: wordEntry.word,
    reading: wordEntry.reading,
    difficultyGuidelines: difficulty.promptGuidelines,
    maxJapaneseChars: difficulty.maxJapaneseChars,
    definitions: wordEntry.definitions.map((d) => ({
      index: d.index,
      text: d.text,
      count: d.count,
    })),
  });
}

function schemaForGenerateSentences() {
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

export async function generateSentences(
  wordEntry: WordEntry,
  settings: AppSettings,
  difficultyKey: Difficulty,
): Promise<SentenceGeneration[]> {
  if (!settings.apiKey) throw new Error("Missing API key (Settings → API Key).");
  if (!settings.model) throw new Error("Missing model (Settings → Model).");
  if (!wordEntry.word.trim()) throw new Error("Word entry is missing a target word.");
  if (wordEntry.definitions.length === 0) throw new Error("Word entry has no parsed definitions.");

  const totalNeeded = wordEntry.definitions.reduce((sum, d) => sum + (d.count || 0), 0);
  if (totalNeeded <= 0) throw new Error("All definition counts are zero.");

  const prompt = buildPromptForGenerateSentences(wordEntry, difficultyKey);

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
        schema: schemaForGenerateSentences(),
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

  const defsByIndex = new Map(wordEntry.definitions.map((d) => [d.index, d.text]));
  const indicesByDefIdx = new Array(wordEntry.definitions.length);

  // Build results + compute notes via your template
  const now = Date.now();
  const results: SentenceGeneration[] = parsed.items.map((it) => {
    const meaning = defsByIndex.get(it.defIndex) ?? "";
    const notes = applyTemplate(settings.notesTemplate, {
      word: wordEntry.word,
      meaning,
      defIndex: String(it.defIndex),
      reading: wordEntry.reading ?? "",
      difficulty: difficultyKey,
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
      difficulty: difficultyKey,
    };
  });

  return results;
}

////////////////////////////////////////////////////////////////

function buildPromptForAnalyzeMeanings(wordEntry: WordEntry): string {
  return Mustache.render(analyzeMeaningsTemplate, {
    word: wordEntry.word,
    reading: wordEntry.reading,
    meanings: wordEntry.definitions.map((d) => ({
      index: d.index,
      text: d.text,
    })),
  });
}

function schemaForAnalyzeMeanings() {
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
          required: ["meaningIndex", "validity", "studyPriority", "comment", "colocations"],
          properties: {
            meaningIndex: { type: "integer" },
            validity: { type: "string", enum: ["valid", "dubious", "not_a_sense"] },
            studyPriority: { type: "string", enum: ["recall", "recognize", "ignore_for_now"] },
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

export async function analyzeMeanings(wordEntry: WordEntry, settings: AppSettings): Promise<DefinitionAnalysisItem[]> {
  if (!settings.apiKey) throw new Error("Missing API key (Settings → API Key).");
  if (!settings.model) throw new Error("Missing model (Settings → Model).");
  if (!wordEntry.word.trim()) throw new Error("Word entry is missing a target word.");
  if (wordEntry.definitions.length === 0) throw new Error("Word entry has no parsed definitions.");

  const prompt = buildPromptForAnalyzeMeanings(wordEntry);

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
        schema: schemaForAnalyzeMeanings(),
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
