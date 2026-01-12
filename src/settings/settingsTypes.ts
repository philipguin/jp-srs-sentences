import type { AnkiFieldSource } from "../anki/ankiTypes";
export type KanaMode = "hiragana" | "katakana";


export interface AppSettings {
  apiKey: string;
  rememberApiKey: boolean;
  model: string;

  jpdbApiKey: string;
  rememberJpdbApiKey: boolean;

  notesTemplate: string;

  defaultCountPreset: string;

  ankiDeckName: string;
  ankiModelName: string;
  ankiFieldMappings: Record<string, Record<string, AnkiFieldSource>>;
  ankiTags: string;
  ankiIncludeDifficultyTag: boolean;

  enableFurigana: boolean;
  furiganaKanaMode: KanaMode;
}
