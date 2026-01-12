import type { AppSettings } from "./settingsTypes";

export function defaultSettings(): AppSettings {
  return {
    apiKey: "",
    rememberApiKey: false,
    model: "gpt-5-chat-latest",

    jpdbApiKey: "",
    rememberJpdbApiKey: false,

    notesTemplate: "{word} here means “{meaning}”.",

    defaultDifficulty: "beginner",
    defaultCountPreset: "1",

    ankiDeckName: "",
    ankiModelName: "",
    ankiFieldMappings: {},
    ankiTags: "",
    ankiIncludeDifficultyTag: false,

    enableFurigana: false,
    furiganaKanaMode: "hiragana",
  };
}
