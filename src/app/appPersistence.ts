import type { AppSettings } from "../settings/settingsTypes";
import type { Difficulty } from "../sentenceGen/sentenceGenTypes";
import type { WordEntry } from "../wordEntry/wordEntryTypes";

const STORAGE_KEY = "jp-srs-sentences:v2";

export interface PersistedStateV2 {
  version: 2;
  selectedWordEntryId?: string;
  wordEntries: WordEntry[];
  settings: AppSettings;
  sentenceGenDifficulty: Difficulty;
}

export function loadPersistedState(): PersistedStateV2 | null {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as PersistedStateV2 & {
        jobs?: WordEntry[];
        selectedJobId?: string;
        sentenceGenDifficulty?: Difficulty;
        settings?: AppSettings & { defaultDifficulty?: Difficulty };
      };
      if (parsed?.version === 2 && parsed.settings) {
        const sentenceGenDifficulty =
          parsed.sentenceGenDifficulty ?? parsed.settings.defaultDifficulty ?? "beginner";
        const { defaultDifficulty: _legacyDefaultDifficulty, ...settings } = parsed.settings;
        if (Array.isArray(parsed.wordEntries)) {
          return { ...parsed, sentenceGenDifficulty, settings };
        }
        if (Array.isArray(parsed.jobs)) {
          const wordEntries = parsed.jobs;
          return {
            version: 2,
            wordEntries,
            selectedWordEntryId: parsed.selectedJobId,
            settings,
            sentenceGenDifficulty,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function savePersistedState(state: PersistedStateV2): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode errors
  }
}

export function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
