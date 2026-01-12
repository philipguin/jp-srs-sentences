import type { AppSettings } from "../settings/settingsTypes";
import type { DefinitionStudyPriority, DefinitionValidity, WordEntry } from "./wordEntryTypes";
import type { LlmClient } from "../llm/llmClient";
import Mustache from "mustache";
import analyzeMeaningsTemplate from "./analyzeMeanings.mustache?raw";

type DefinitionAnalysisItem = {
  meaningIndex: number;
  validity: DefinitionValidity;
  studyPriority: DefinitionStudyPriority;
  comment: string;
  colocations: string[];
};

type DefinitionAnalysisPayload = { items: DefinitionAnalysisItem[] };

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

export async function analyzeMeanings(
  llmClient: LlmClient,
  wordEntry: WordEntry,
  settings: AppSettings,
): Promise<DefinitionAnalysisItem[]> {
  if (!settings.apiKey) throw new Error("Missing API key (Settings → API Key).");
  if (!settings.model) throw new Error("Missing model (Settings → Model).");
  if (!wordEntry.word.trim()) throw new Error("Word entry is missing a target word.");
  if (wordEntry.definitions.length === 0) throw new Error("Word entry has no parsed definitions.");

  const prompt = buildPromptForAnalyzeMeanings(wordEntry);

  const parsed = await llmClient.requestStructuredJson<DefinitionAnalysisPayload>({
    apiKey: settings.apiKey,
    model: settings.model,
    system: "You analyze Japanese dictionary definitions for SRS study planning.",
    prompt,
    schema: schemaForAnalyzeMeanings(),
    schemaName: "jp_srs_definition_analysis",
  });

  if (!parsed?.items || !Array.isArray(parsed.items)) {
    throw new Error("JSON did not match expected schema (items array missing).");
  }

  return parsed.items;
}
