import type { AppSettings } from "../settings/settingsTypes";
import type { AnkiExportState } from "../anki/ankiTypes";
import type { useAnkiStatus } from "../anki/ankiHooks";
import type { WordEntries } from "../wordEntry/wordEntryTypes";
import type { SentenceGenState } from "../sentenceGen/sentenceGenTypes";

export type AppMessages = {
  generationErr: string | null;
  generationNotice: string | null;
  setGenerationErr: (s: string | null) => void;
  setGenerationNotice: (s: string | null) => void;
  clear: () => void;
};

export type FuriganaState = {
  status: "idle" | "loading" | "ready" | "error";
  available: boolean;
};

export type UseAppLogicReturn = {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  ankiStatus: ReturnType<typeof useAnkiStatus>;
  wordEntries: WordEntries;
  sentenceGenState: SentenceGenState;
  ankiExportState: AnkiExportState;
  furiganaState: FuriganaState;
  doSettingsNeedAttention: () => boolean;
};
