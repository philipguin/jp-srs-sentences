import type { WordEntry } from "./wordEntryTypes";
import { uid } from "../shared/common";

export function createEmptyWordEntry(): WordEntry {
  const now = Date.now();
  return {
    id: uid(),
    word: "",
    reading: "",
    definitionsEditing: true,
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

export function normalizeWordEntry(wordEntry: WordEntry): WordEntry {
  return {
    ...wordEntry,
    definitionsEditing: wordEntry.definitionsEditing ?? (!wordEntry.definitions || wordEntry.definitions.length == 0),
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
