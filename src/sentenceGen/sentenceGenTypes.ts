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

export type SentenceItem = {
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

export type SentenceGeneration = {
  id: string;
  defIndex: number;
  defSubIndex: number;
  jp: string;
  en: string;
  notes: string;
  createdAt: number;
  difficulty: Difficulty;
}

export type GenerationBatchDefinition = {
  index: number;
  text: string;
  count: number;
}

export type GenerationBatch = {
  id: number;
  createdAt: number;
  difficulty: Difficulty;
  definitions: GenerationBatchDefinition[];
}

export type SentenceGenState = {
  difficulty: Difficulty;
  generationBusy: boolean;
  analysisBusy: boolean;
  generationErr: string | null;
  generationNotice: string | null;

  generate: () => Promise<void>;
  analyze: () => Promise<void>;
  clearMessages: () => void;
  setDifficulty: (difficulty: Difficulty) => void;
}