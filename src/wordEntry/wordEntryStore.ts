import type { Difficulty } from "../sentenceGen/sentenceGenTypes";
import type { WordEntry } from "./wordEntryTypes";

export function uid(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function createEmptyWordEntry(opts?: { sentenceGenDifficulty?: Difficulty }): WordEntry {
  const now = Date.now();
  return {
    id: uid(),
    word: "",
    reading: "",
    sentenceGenDifficulty: opts?.sentenceGenDifficulty ?? "beginner",
    definitionsRaw: "",
    definitions: [],
    generations: [],
    generationBatches: [],
    sentences: [],
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function touch(wordEntry: WordEntry): WordEntry {
  return { ...wordEntry, updatedAt: Date.now() };
}

export function normalizeWordEntry(wordEntry: WordEntry): WordEntry {
  const { difficulty: legacyDifficulty, ...rest } = wordEntry as WordEntry & { difficulty?: Difficulty };
  return {
    ...rest,
    sentenceGenDifficulty: wordEntry.sentenceGenDifficulty ?? legacyDifficulty ?? "beginner",
    definitions: wordEntry.definitions ?? [],
    generations: wordEntry.generations ?? [],
    generationBatches: wordEntry.generationBatches ?? [],
    sentences: (wordEntry.sentences ?? []).map((sentence) => ({
      ...sentence,
      exportEnabled: sentence.exportEnabled ?? true,
      exportStatus: sentence.exportStatus ?? "new",
    })),
  };
}
