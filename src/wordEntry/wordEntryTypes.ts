import type { KuroshiroCache } from "../kuroshiro/kuroshiroTypes";
import type { GenerationBatch, SentenceGeneration, SentenceItem } from "../sentenceGen/sentenceGenTypes";

export type WordEntryStatus = "draft" | "generating" | "ready" | "error";

export type DefinitionValidity = "valid" | "dubious" | "not_a_sense";
export type DefinitionStudyPriority = "recall" | "recognize" | "ignore_for_now";

export type DefinitionSpec = {
  index: number;
  text: string;
  count: number;
  validity?: DefinitionValidity;
  studyPriority?: DefinitionStudyPriority;
  comment?: string;
  colocations?: string[];
}

export type WordEntryJpdb = {
  vid: number;
  sid: number;
  frequencyRank: number;
  cardState: string;
  cardLevel: number;
};

export type WordEntry = {
  id: string;
  word: string;
  reading?: string;
  definitionsEditing: boolean;
  definitionsRaw: string;
  definitions: DefinitionSpec[];
  generations: SentenceGeneration[];
  generationBatches: GenerationBatch[];
  sentences: SentenceItem[];
  furiganaCache?: KuroshiroCache;
  status: WordEntryStatus;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
  jpdb?: WordEntryJpdb;
}

export type WordEntries = {
  list: WordEntry[];
  selectedId: string;
  selected?: WordEntry;

  get: (id: string) => WordEntry | undefined;
  select: (id: string) => void;
  create: () => void;
  remove: (id: string) => void;
  update: (id: string, updater: (current: WordEntry) => WordEntry) => void;
  updateAll: (updater: (current: WordEntry) => WordEntry) => void;
}