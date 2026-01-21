import { useEffect, useMemo, useState } from "react";
import type { AppSettings } from "../settings/settingsTypes";
import type { Difficulty } from "../sentenceGen/sentenceGenTypes";
import type { WordEntry } from "../wordEntry/wordEntryTypes";
import { defaultSettings } from "../settings/settingsDefaults";
import { loadPersistedState, savePersistedState } from "./appPersistence";
import { createEmptyWordEntry, normalizeWordEntry } from "../wordEntry/wordEntryStore";

function pickInitialState(): {
  wordEntries: WordEntry[];
  selectedWordEntryId: string;
  settings: AppSettings;
  sentenceGenDifficulty: Difficulty;
} {
  const persisted = loadPersistedState();

  if (persisted && persisted.wordEntries.length > 0) {
    const defaults = defaultSettings();

    const selected =
      persisted.selectedWordEntryId &&
      persisted.wordEntries.some((entry) => entry.id === persisted.selectedWordEntryId)
        ? persisted.selectedWordEntryId
        : persisted.wordEntries[0].id;

    const settings: AppSettings = {
      ...defaults,
      ...persisted.settings,
      ankiFieldMappings: {
        ...defaults.ankiFieldMappings,
        ...persisted.settings.ankiFieldMappings,
      },
    };

    return {
      wordEntries: persisted.wordEntries.map(normalizeWordEntry),
      selectedWordEntryId: selected,
      settings,
      sentenceGenDifficulty: persisted.sentenceGenDifficulty,
    };
  }

  const settings = defaultSettings();
  const sentenceGenDifficulty: Difficulty = "beginner";
  const first = createEmptyWordEntry();
  return { wordEntries: [first], selectedWordEntryId: first.id, settings, sentenceGenDifficulty };
}

export function usePersistedAppState() {
  const initial = useMemo(() => pickInitialState(), []);

  const [wordEntryList, setWordEntryList] = useState<WordEntry[]>(initial.wordEntries);
  const [selectedWordEntryId, setSelectedWordEntryId] = useState<string>(initial.selectedWordEntryId);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [sentenceGenDifficulty, setSentenceGenDifficulty] = useState<Difficulty>(initial.sentenceGenDifficulty);

  useEffect(() => {
    const toSave: AppSettings = {
      ...settings,
      apiKey: settings.rememberApiKey ? settings.apiKey : "",
      jpdbApiKey: settings.rememberJpdbApiKey ? settings.jpdbApiKey : "",
    };

    savePersistedState({
      version: 2,
      wordEntries: wordEntryList,
      selectedWordEntryId,
      settings: toSave,
      sentenceGenDifficulty,
    });
  }, [wordEntryList, selectedWordEntryId, settings, sentenceGenDifficulty]);

  return {
    wordEntryList,
    setWordEntryList,
    selectedWordEntryId,
    setSelectedWordEntryId,
    settings,
    setSettings,
    sentenceGenDifficulty,
    setSentenceGenDifficulty,
  };
}
