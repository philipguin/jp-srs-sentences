import type { AppSettings } from "../settings/settingsTypes";
import type { Difficulty, SentenceGeneration } from "./sentenceGenTypes";
import type { WordEntry } from "../wordEntry/wordEntryTypes";
import { DIFFICULTY_PROFILES } from "./sentenceGenDifficulty";
import { applyTemplate } from "../shared/template";
import type { LlmClient } from "../llm/llmClient";
import Mustache from "mustache";
import generateSentencesTemplate from "./generateSentences.mustache?raw";

type ModelItem = { defIndex: number; jp: string; en: string };

type ModelPayload = { items: ModelItem[] };

function uid(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

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
  llmClient: LlmClient,
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

  const parsed = await llmClient.requestStructuredJson<ModelPayload>({
    apiKey: settings.apiKey,
    model: settings.model,
    system: "You generate Japanese example sentences for SRS study.",
    prompt,
    schema: schemaForGenerateSentences(),
    schemaName: "jp_srs_sentences",
  });

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
