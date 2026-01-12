import type { KuroshiroCache } from "../kuroshiro/kuroshiroTypes";
import type { Difficulty, GenerationBatch, SentenceGeneration, SentenceItem } from "../sentenceGen/sentenceGenTypes";

export type WordEntryStatus = "draft" | "generating" | "ready" | "error";

export type DefinitionValidity = "valid" | "dubious" | "not_a_sense";
export type DefinitionStudyPriority = "recall" | "recognize" | "ignore_for_now";

export interface DefinitionSpec {
  index: number;
  text: string;
  count: number;
  validity?: DefinitionValidity;
  studyPriority?: DefinitionStudyPriority;
  comment?: string;
  colocations?: string[];
}

export interface WordEntry {
  id: string;
  word: string;
  reading?: string;
  sentenceGenDifficulty: Difficulty;
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
}
