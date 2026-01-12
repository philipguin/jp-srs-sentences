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

export type JobStatus = "draft" | "generating" | "ready" | "error";

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

export interface GenerationBatch {
  id: number;
  createdAt: number;
  difficulty: Difficulty;
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
  furiganaCache?: FuriganaCache;
  generationId?: string;
  batchId?: number;
  definitionSnapshot?: {
    index: number;
    text: string;
  };
  difficulty?: Difficulty;
}

export type SentenceExportStatus = "new" | "exported" | "failed";

export type AnkiFieldSource =
  | ""
  | "word"
  | "wordKana"
  | "wordFuri"
  | "wordFuriHtml"
  | "meaning"
  | "meaningNumber"
  | "sentenceJp"
  | "sentenceJpKana"
  | "sentenceJpFuri"
  | "sentenceJpFuriHtml"
  | "sentenceEn"
  | "difficulty"
  | "notes"
  | "reading";

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
  furiganaCache?: FuriganaCache;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
}

export interface FuriganaCache {
  key: string;
  kana?: string;
  rubyHtml?: string;
  anki?: string;
}

export type FuriganaMode = "hiragana" | "katakana";

export interface AppSettings {
  apiKey: string;
  rememberApiKey: boolean;
  model: string;

  jpdbApiKey: string;
  rememberJpdbApiKey: boolean;

  notesTemplate: string;

  defaultDifficulty: Difficulty;
  defaultCountPreset: string;

  ankiDeckName: string;
  ankiModelName: string;
  ankiFieldMappings: Record<string, Record<string, AnkiFieldSource>>;
  ankiTags: string;
  ankiIncludeDifficultyTag: boolean;

  enableFurigana: boolean;
  furiganaKanaMode: FuriganaMode;
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
