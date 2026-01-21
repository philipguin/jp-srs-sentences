import type { AppSettings } from "../settings/settingsTypes";
import type { Difficulty, SentenceGeneration } from "./sentenceGenTypes";
import type { WordEntry } from "../wordEntry/wordEntryTypes";
import { applyTemplate } from "../shared/template";

export function buildMockGenerations(
  wordEntry: WordEntry,
  settings: AppSettings,
  difficulty: Difficulty,
): SentenceGeneration[] {
  
  const now = Date.now();
  const results: SentenceGeneration[] = [];

  for (const def of wordEntry.definitions) {
    const count = Math.max(1, Math.floor(def.count || 1));
    for (let i = 0; i < count; i += 1) {
      const notes = applyTemplate(settings.notesTemplate, {
        word: wordEntry.word,
        meaning: def.text,
        defIndex: String(def.index),
        reading: wordEntry.reading ?? "",
        difficulty,
      });
      results.push({
        id: `mock-${def.index}-${i}-${now}`,
        defIndex: def.index,
        defSubIndex: i,
        jp: wordEntry.word
          ? `${wordEntry.word}の例文（仮）`
          : `単語の例文（仮）`,
        en: def.text
          ? `Sample sentence for “${def.text}”.`
          : "Sample sentence for the provided definition.",
        notes,
        createdAt: now,
        difficulty,
      });
    }
  }

  return results;
}
