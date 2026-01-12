import type { AppSettings } from "../settings/settingsTypes";
import type { SentenceGeneration } from "./sentenceGenTypes";
import type { Job } from "../wordEntry/wordEntryTypes";
import { applyTemplate } from "../shared/template";

export function buildMockGenerations(job: Job, settings: AppSettings): SentenceGeneration[] {
  const now = Date.now();
  const results: SentenceGeneration[] = [];

  for (const def of job.definitions) {
    const count = Math.max(1, Math.floor(def.count || 1));
    for (let i = 0; i < count; i += 1) {
      const notes = applyTemplate(settings.notesTemplate, {
        word: job.word,
        meaning: def.text,
        defIndex: String(def.index),
        reading: job.reading ?? "",
        difficulty: job.difficulty,
      });
      results.push({
        id: `mock-${def.index}-${i}-${now}`,
        defIndex: def.index,
        defSubIndex: i,
        jp: job.word
          ? `${job.word}の例文（仮）`
          : `単語の例文（仮）`,
        en: def.text
          ? `Sample sentence for “${def.text}”.`
          : "Sample sentence for the provided definition.",
        notes,
        createdAt: now,
        difficulty: job.difficulty,
      });
    }
  }

  return results;
}
