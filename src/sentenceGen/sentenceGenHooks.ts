import { useState } from "react";
import type { AppMessages } from "../app/appTypes";
import type { AppSettings } from "../settings/settingsTypes";
import type { WordEntries } from "../wordEntry/wordEntryTypes";
import { analyzeMeanings } from "../wordEntry/wordEntryMeaningAnalysis";
import type { SentenceGenState, Difficulty, GenerationBatch, SentenceGeneration } from "./sentenceGenTypes";
import { buildMockGenerations } from "./sentenceGenMock";
import { buildSentenceItem, generateSentences, nextBatchId } from "./sentenceGenWorkflow";

type SentenceGenDeps = {
  llmClient: any;
  settings: AppSettings;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
};

export function useSentenceGeneration(
  deps: SentenceGenDeps,
  wordEntries: WordEntries,
  messages: AppMessages,

): SentenceGenState {

  const { llmClient, settings, difficulty, setDifficulty } = deps;

  const [generationBusy, setGenerationBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);

  const clearMessages = () => {
    messages.clear();
  };

  const generate = async () => {
    const selected = wordEntries.selected;
    if (!selected) return;
    const id = wordEntries.selectedId;

    clearMessages();
    setGenerationBusy(true);

    // Mark generating.
    wordEntries.update(id, (current) => ({ ...current, status: "generating" }));

    try {
      const results: SentenceGeneration[] = settings.apiKey
        ? await generateSentences(llmClient, selected, settings, difficulty)
        : buildMockGenerations(selected, settings, difficulty);

      if (!settings.apiKey) {
        messages.setGenerationNotice("No API key set — using mock results.");
      }

      wordEntries.update(id, (current) => {
        const batchId = nextBatchId(current.generationBatches);
        const batchCreatedAt = results[0]?.createdAt ?? Date.now();

        const batch: GenerationBatch = {
          id: batchId,
          createdAt: batchCreatedAt,
          difficulty,
          definitions: current.definitions.map((definition) => ({ ...definition })),
        };

        const nextItems = results.map((generation) => buildSentenceItem(current, generation, batchId));

        return {
          ...current,
          generations: results,
          generationBatches: [...current.generationBatches, batch],
          sentences: [...current.sentences, ...nextItems],
          status: "ready",
        };
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      messages.setGenerationErr(msg);
      wordEntries.update(id, (current) => ({ ...current, status: "error" }));
    } finally {
      setGenerationBusy(false);
    }
  };

  const analyze = async () => {
    const selected = wordEntries.selected;
    if (!selected) return;
    const id = wordEntries.selectedId;

    clearMessages();
    setAnalysisBusy(true);

    try {
      const results = await analyzeMeanings(llmClient, selected, settings);
      const resultsByIndex = new Map(results.map((result) => [result.meaningIndex, result]));

      wordEntries.update(id, (current) => {
        const nextDefinitions = current.definitions.map((definition) => {
          const analysis = resultsByIndex.get(definition.index);
          if (!analysis) return definition;
          return {
            ...definition,
            validity: analysis.validity,
            studyPriority: analysis.studyPriority,
            comment: analysis.comment,
            colocations: analysis.colocations,
            count: definition.count,
          };
        });

        return {
          ...current,
          definitions: nextDefinitions,
        };
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      messages.setGenerationErr(msg);
    } finally {
      setAnalysisBusy(false);
    }
  };

  return {
    difficulty,
    generationBusy,
    analysisBusy,
    generationErr: messages.generationErr,
    generationNotice: messages.generationNotice,
    generate,
    analyze,
    clearMessages,
    setDifficulty,
  };
}
