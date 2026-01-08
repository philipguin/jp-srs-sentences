import type { Job, AppSettings } from "./types";

const STORAGE_KEY = "jp-srs-sentences:v2";

export interface PersistedStateV2 {
  version: 2;
  selectedJobId?: string;
  jobs: Job[];
  settings: AppSettings;
}

export function loadPersistedState(): PersistedStateV2 | null {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as PersistedStateV2;
      if (parsed?.version === 2 && Array.isArray(parsed.jobs) && parsed.settings) {
        return parsed;
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
