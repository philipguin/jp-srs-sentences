export type Difficulty = "intro" | "beginner" | "intermediate" | "native-like" | "written-narrative" | "ultra-literary";

export type DifficultyProfile = {
  // UI-facing:
  label: string;
  shortHelp: string;

  // Prompt-facing:
  promptGuidelines: string;
  maxJapaneseChars: number;
};

export type JobStatus = "draft" | "generating" | "ready" | "error";

export interface DefinitionSpec {
  index: number;
  text: string;
  count: number;
}

export interface GenerationBatch {
  id: number;
  createdAt: number;
  definitions: DefinitionSpec[];
}

export interface SentenceItem {
  id: string;
  jp: string;
  en: string;
  notes: string;
  source: "generated" | "edited";
  createdAt: number;
  exportEnabled: boolean;
  exportStatus: SentenceExportStatus;
  generationId?: string;
  batchId?: number;
  definitionSnapshot?: {
    index: number;
    text: string;
  };
}

export type SentenceExportStatus = "new" | "exported" | "failed";

export interface Job {
  id: string;
  word: string;
  reading?: string;
  difficulty: Difficulty;
  definitionsRaw: string;
  definitions: DefinitionSpec[];
  generations: SentenceGeneration[];
  generationBatches: GenerationBatch[];
  sentences: SentenceItem[];
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
}

export interface AppSettings {
  apiKey: string;
  rememberApiKey: boolean;
  model: string;

  notesTemplate: string;

  defaultDifficulty: Difficulty;
  defaultCountPreset: string;

  // We'll add prompt templates + AnkiConnect later.
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
