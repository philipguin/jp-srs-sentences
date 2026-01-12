import type { AnkiFieldSource } from "../anki/ankiTypes";
import type { Difficulty } from "../sentenceGen/sentenceGenTypes";
import type { FuriganaMode } from "../furigana/furiganaTypes";

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
