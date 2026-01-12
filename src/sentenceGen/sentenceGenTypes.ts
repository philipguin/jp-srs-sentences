import type { KuroshiroCache } from "../kuroshiro/kuroshiroTypes";

export type Difficulty = "intro" | "beginner" | "intermediate" | "native-like" | "written-narrative" | "ultra-literary";

export type DifficultyProfile = {
  // UI-facing:
  label: string;
  shortLabel: string;
  shortHelp: string;

  // Prompt-facing:
  promptGuidelines: string;
  maxJapaneseChars: number;
};

export type SentenceExportStatus = "new" | "exported" | "failed";

export interface SentenceItem {
  id: string;
  jp: string;
  en: string;
  notes: string;
  source: "generated" | "edited";
  createdAt: number;
  exportEnabled: boolean;
  exportStatus: SentenceExportStatus;
  furiganaCache?: KuroshiroCache;
  generationId?: string;
  batchId?: number;
  definitionSnapshot?: {
    index: number;
    text: string;
  };
  difficulty?: Difficulty;
}

export interface SentenceGeneration {
  id: string;
  defIndex: number;
  defSubIndex: number;
  jp: string;
  en: string;
  notes: string;
  createdAt: number;
  difficulty: Difficulty;
}

export interface GenerationBatchDefinition {
  index: number;
  text: string;
  count: number;
}

export interface GenerationBatch {
  id: number;
  createdAt: number;
  difficulty: Difficulty;
  definitions: GenerationBatchDefinition[];
}
