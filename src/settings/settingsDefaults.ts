import type { AppSettings } from "./settingsTypes";

export function defaultSettings(): AppSettings {
  return {
    apiKey: "",
    rememberApiKey: false,
    model: "gpt-5.2-chat-latest",

    jpdbApiKey: "",
    rememberJpdbApiKey: false,
    jpdbDeckId: 0,
    jpdbDeckName: "",

    notesTemplate: "{word} here means “{meaning}”.",

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
