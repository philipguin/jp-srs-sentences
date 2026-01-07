import type { Job, AppSettings } from "./types";
import { defaultSettings } from "./defaults";

const STORAGE_KEY = "jp-srs-sentences:v2";

export interface PersistedStateV2 {
  version: 2;
  selectedJobId?: string;
  jobs: Job[];
  settings: AppSettings;
}

// Back-compat with your old persisted shape:
interface PersistedStateV1 {
  version: 1;
  selectedJobId?: string;
  jobs: Job[];
}

export function loadPersistedState(): PersistedStateV2 | null {
  try {
    // Try v2 first
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as PersistedStateV2;
      if (parsed?.version === 2 && Array.isArray(parsed.jobs) && parsed.settings) {
        return parsed;
      }
    }

    // Try old v1 key
    const rawV1 = localStorage.getItem("jp-srs-sentences:v1");
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as PersistedStateV1;
      if (parsed?.version === 1 && Array.isArray(parsed.jobs)) {
        return {
          version: 2,
          jobs: parsed.jobs,
          selectedJobId: parsed.selectedJobId,
          settings: defaultSettings(),
        };
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
