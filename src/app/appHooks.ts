import { useState, useCallback } from "react";
import { openAiClient } from "../llm/openAiClient";
import { useFuriganaStatus } from "../kuroshiro/kuroshiroHooks";
import { usePersistedAppState } from "./appPersistenceHooks";
import { useWordEntries } from "../wordEntry/wordEntryHooks";
import { useSentenceGeneration } from "../sentenceGen/sentenceGenHooks";
import { useAnkiStatus, useAnkiExport } from "../anki/ankiHooks";
import type { AppSettings } from "../settings/settingsTypes";
import type { AppMessages, UseAppLogicReturn } from "./appTypes";

export type { SentenceGenState } from "../sentenceGen/sentenceGenTypes";
export type { AnkiExportState } from "../anki/ankiTypes";

function useSettingsAttention(settings: AppSettings) {
  return useCallback(() => {
    return !settings.apiKey || !settings.model || !settings.ankiDeckName || !settings.ankiModelName;
  }, [settings.apiKey, settings.model, settings.ankiDeckName, settings.ankiModelName]);
}

function useAppMessages(): AppMessages {
  const [generationErr, setGenerationErr] = useState<string | null>(null);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);

  const clear = useCallback(() => {
    setGenerationErr(null);
    setGenerationNotice(null);
  }, []);

  return {
    generationErr,
    generationNotice,
    setGenerationErr,
    setGenerationNotice,
    clear,
  };
}

export function useAppLogic(): UseAppLogicReturn {
  const llmClient = openAiClient;

  const {
    wordEntryList,
    setWordEntryList,
    selectedWordEntryId,
    setSelectedWordEntryId,
    settings,
    setSettings,
    sentenceGenDifficulty,
    setSentenceGenDifficulty,
  } = usePersistedAppState();

  // UI-only state
  const [settingsOpen, setSettingsOpen] = useState(false);

  const messages = useAppMessages();

  const ankiStatus = useAnkiStatus();

  const furiganaStatus = useFuriganaStatus(settings.enableFurigana);
  const furiganaAvailable = settings.enableFurigana && furiganaStatus === "ready";

  const wordEntries = useWordEntries({
    list: wordEntryList,
    setList: setWordEntryList,
    selectedId: selectedWordEntryId,
    setSelectedId: setSelectedWordEntryId,
  });

  const sentenceGenState = useSentenceGeneration(
    {
      llmClient,
      settings,
      difficulty: sentenceGenDifficulty,
      setDifficulty: setSentenceGenDifficulty,
    }, 
    wordEntries,
    messages,
  );

  const ankiExportState = useAnkiExport({
    wordEntries,
    settings,
    difficulty: sentenceGenDifficulty,
    furiganaAvailable,
    messages,
  });

  const doSettingsNeedAttention = useSettingsAttention(settings);

  return {
    settings,
    setSettings,
    settingsOpen,
    setSettingsOpen,
    ankiStatus,
    wordEntries,
    sentenceGenState,
    ankiExportState,
    furiganaState: {
      status: furiganaStatus,
      available: furiganaAvailable,
    },
    doSettingsNeedAttention,
  };
}
