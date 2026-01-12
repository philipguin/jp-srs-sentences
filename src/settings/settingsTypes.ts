import type { AnkiFieldSource } from "../anki/ankiTypes";
import type { Difficulty } from "../sentenceGen/sentenceGenTypes";
export type KanaMode = "hiragana" | "katakana";


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
  furiganaKanaMode: KanaMode;
}
