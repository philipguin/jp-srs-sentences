import { useEffect, useMemo, useState } from "react";
import { createEmptyWordEntry, normalizeWordEntry, touch } from "../wordEntry/wordEntryStore";
import type { AppSettings } from "../settings/settingsTypes";
import type { Difficulty, GenerationBatch, SentenceGeneration } from "../sentenceGen/sentenceGenTypes";
import type { WordEntry } from "../wordEntry/wordEntryTypes";
import { defaultSettings } from "../settings/settingsDefaults";
import { loadPersistedState, savePersistedState } from "./appPersistence";
import { openAiClient } from "../llm/openAiClient";
import { buildSentenceItem, generateSentences, nextBatchId } from "../sentenceGen/sentenceGenWorkflow";
import { analyzeMeanings } from "../wordEntry/wordEntryMeaningAnalysis";
import { buildMockGenerations } from "../sentenceGen/sentenceGenMock";
import { fetchModelFieldNames, addNotes } from "../anki/ankiConnect";
import { buildAnkiFieldPayload, buildAnkiTags } from "../anki/ankiExport";
import { useAnkiStatus } from "../anki/ankiInit";
import { useFuriganaStatus } from "../kuroshiro/kuroshiroInit";

export type WordEntryState = {
  wordEntries: WordEntry[];
  selectedWordEntryId: string;
  selectedWordEntry?: WordEntry;
  onSelect: (id: string) => void;
  onNewWordEntry: () => void;
  onDeleteWordEntry: (id: string) => void;
  onUpdateWordEntry: (wordEntry: WordEntry) => void;
};

export type SentenceGenState = {
  difficulty: Difficulty;
  generationBusy: boolean;
  analysisBusy: boolean;
  generationErr: string | null;
  generationNotice: string | null;
  onGenerate: () => Promise<void>;
  onAnalyze: () => Promise<void>;
  onClearMessages: () => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
};

export type AnkiExportState = {
  exportBusy: boolean;
  onExport: () => Promise<void>;
};

export type FuriganaState = {
  status: "idle" | "loading" | "ready" | "error";
  available: boolean;
};

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
      persisted.selectedWordEntryId && persisted.wordEntries.some((entry) => entry.id === persisted.selectedWordEntryId)
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

export function useAppLogic(): {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  ankiStatus: ReturnType<typeof useAnkiStatus>;
  wordEntryState: WordEntryState;
  sentenceGenState: SentenceGenState;
  ankiExportState: AnkiExportState;
  furiganaState: FuriganaState;
  doSettingsNeedAttention: () => boolean;
} {
  const llmClient = openAiClient;
  const initial = useMemo(() => pickInitialState(), []);
  const [wordEntries, setWordEntries] = useState<WordEntry[]>(initial.wordEntries);
  const [selectedWordEntryId, setSelectedWordEntryId] = useState<string>(initial.selectedWordEntryId);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [sentenceGenDifficulty, setSentenceGenDifficulty] = useState<Difficulty>(initial.sentenceGenDifficulty);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [generationErr, setGenerationErr] = useState<string | null>(null);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const furiganaStatus = useFuriganaStatus(settings.enableFurigana);
  const furiganaAvailable = settings.enableFurigana && furiganaStatus === "ready";

  const selectedWordEntry = useMemo(
    () => wordEntries.find((entry) => entry.id === selectedWordEntryId) ?? wordEntries[0],
    [wordEntries, selectedWordEntryId],
  );

  useEffect(() => {
    const toSave: AppSettings = {
      ...settings,
      apiKey: settings.rememberApiKey ? settings.apiKey : "",
      jpdbApiKey: settings.rememberJpdbApiKey ? settings.jpdbApiKey : "",
    };

    savePersistedState({
      version: 2,
      wordEntries,
      selectedWordEntryId,
      settings: toSave,
      sentenceGenDifficulty,
    });
  }, [wordEntries, selectedWordEntryId, settings, sentenceGenDifficulty]);

  const ankiStatus = useAnkiStatus();

  function doSettingsNeedAttention(): boolean {
    return !settings.apiKey || !settings.model || !settings.ankiDeckName || !settings.ankiModelName;
  }

  function onNewWordEntry() {
    const wordEntry = createEmptyWordEntry();
    setWordEntries((prev) => [wordEntry, ...prev]);
    setSelectedWordEntryId(wordEntry.id);
  }

  function onDeleteWordEntry(id: string) {
    setWordEntries((prev) => {
      const next = prev.filter((entry) => entry.id !== id);

      if (selectedWordEntryId === id) {
        setSelectedWordEntryId(next[0]?.id ?? "");
      }

      if (next.length === 0) {
        const created = createEmptyWordEntry();
        setSelectedWordEntryId(created.id);
        return [created];
      }

      return next;
    });
  }

  function onUpdateWordEntry(updated: WordEntry) {
    setWordEntries((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
  }

  async function onGenerate() {
    if (!selectedWordEntry) return;
    setGenerationErr(null);
    setGenerationNotice(null);
    setGenerationBusy(true);
    try {
      onUpdateWordEntry(touch({ ...selectedWordEntry, status: "generating" }));

      const results: SentenceGeneration[] = settings.apiKey
        ? await generateSentences(llmClient, selectedWordEntry, settings, sentenceGenDifficulty)
        : buildMockGenerations(selectedWordEntry, settings, sentenceGenDifficulty);

      if (!settings.apiKey) {
        setGenerationNotice("No API key set — using mock results.");
      }

      const batchId = nextBatchId(selectedWordEntry.generationBatches);
      const batchCreatedAt = results[0]?.createdAt ?? Date.now();
      const batch: GenerationBatch = {
        id: batchId,
        createdAt: batchCreatedAt,
        difficulty: sentenceGenDifficulty,
        definitions: selectedWordEntry.definitions.map((definition) => ({ ...definition })),
      };
      const nextItems = results.map((generation) => buildSentenceItem(selectedWordEntry, generation, batchId));
      onUpdateWordEntry(
        touch({
          ...selectedWordEntry,
          generations: results,
          generationBatches: [...selectedWordEntry.generationBatches, batch],
          sentences: [...selectedWordEntry.sentences, ...nextItems],
          status: "ready",
        })
      );
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setGenerationErr(msg);
      onUpdateWordEntry(touch({ ...selectedWordEntry, status: "error" }));
    } finally {
      setGenerationBusy(false);
    }
  }

  async function onAnalyze() {
    if (!selectedWordEntry) return;
    setGenerationErr(null);
    setGenerationNotice(null);
    setAnalysisBusy(true);
    try {
      const results = await analyzeMeanings(llmClient, selectedWordEntry, settings);
      const resultsByIndex = new Map(results.map((result) => [result.meaningIndex, result]));
      const nextDefinitions = selectedWordEntry.definitions.map((definition) => {
        const analysis = resultsByIndex.get(definition.index);
        if (!analysis) return definition;
        return {
          ...definition,
          validity: analysis.validity,
          studyPriority: analysis.studyPriority,
          comment: analysis.comment,
          colocations: analysis.colocations,
          count: definition.count,
        };
      });

      onUpdateWordEntry(
        touch({
          ...selectedWordEntry,
          definitions: nextDefinitions,
        })
      );
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setGenerationErr(msg);
    } finally {
      setAnalysisBusy(false);
    }
  }

  function onClearMessages() {
    setGenerationErr(null);
    setGenerationNotice(null);
  }

  async function onExport() {
    setGenerationErr(null);
    setGenerationNotice(null);

    if (!settings.ankiDeckName || !settings.ankiModelName) {
      setGenerationErr("Missing deck or note type (Settings → AnkiConnect).");
      return;
    }

    const exportTargets = wordEntries.flatMap((wordEntry) =>
      wordEntry.sentences
        .filter((sentence) => sentence.exportEnabled)
        .map((sentence) => ({ wordEntry, sentence }))
    );

    if (exportTargets.length === 0) {
      setGenerationErr("No sentences selected for export. Use the Export checkbox on sentences first.");
      return;
    }

    setExportBusy(true);
    try {
      const fieldNames = await fetchModelFieldNames(settings.ankiModelName);
      if (fieldNames.length === 0) {
        setGenerationErr("Selected note type has no fields. Check Settings → AnkiConnect.");
        return;
      }

      const fieldMapping = settings.ankiFieldMappings[settings.ankiModelName] ?? {};
      const wordEntryCacheUpdates = new Map<string, WordEntry["furiganaCache"]>();
      const sentenceCacheUpdates = new Map<string, WordEntry["sentences"][number]["furiganaCache"]>();

      const notes = await Promise.all(
        exportTargets.map(async ({ wordEntry, sentence }) => {
          const payload = await buildAnkiFieldPayload(
            fieldNames,
            fieldMapping,
            wordEntry,
            sentence,
            settings,
            furiganaAvailable,
          );
          if (payload.wordEntryCache && payload.wordEntryCache !== wordEntry.furiganaCache) {
            wordEntryCacheUpdates.set(wordEntry.id, payload.wordEntryCache);
          }
          if (payload.sentenceCache && payload.sentenceCache !== sentence.furiganaCache) {
            sentenceCacheUpdates.set(sentence.id, payload.sentenceCache);
          }
          return {
            deckName: settings.ankiDeckName,
            modelName: settings.ankiModelName,
            fields: payload.fields,
            tags: buildAnkiTags(settings, sentence, sentenceGenDifficulty),
          };
        }),
      );

      const results = await addNotes(notes);
      const updates = new Map<string, { status: "exported" | "failed"; enabled: boolean }>();
      let successCount = 0;
      let failureCount = 0;

      results.forEach((result, index) => {
        const { sentence } = exportTargets[index];
        if (result) {
          successCount += 1;
          updates.set(sentence.id, { status: "exported", enabled: false });
        } else {
          failureCount += 1;
          updates.set(sentence.id, { status: "failed", enabled: true });
        }
      });

      setWordEntries((prev) =>
        prev.map((wordEntry) => {
          let touched = false;
          const nextSentences = wordEntry.sentences.map((sentence) => {
            const update = updates.get(sentence.id);
            const cacheUpdate = sentenceCacheUpdates.get(sentence.id);
            if (!update && !cacheUpdate) return sentence;
            touched = true;
            return {
              ...sentence,
              exportStatus: update?.status ?? sentence.exportStatus,
              exportEnabled: update?.enabled ?? sentence.exportEnabled,
              furiganaCache: cacheUpdate ?? sentence.furiganaCache,
            };
          });
          const wordEntryCache = wordEntryCacheUpdates.get(wordEntry.id);
          if (!touched && !wordEntryCache) return wordEntry;
          return touch({
            ...wordEntry,
            sentences: nextSentences,
            furiganaCache: wordEntryCache ?? wordEntry.furiganaCache,
          });
        })
      );

      if (failureCount > 0) {
        setGenerationErr(`Exported ${successCount} sentences, but ${failureCount} failed. Check AnkiConnect or field mappings.`);
      } else {
        setGenerationNotice(`Success! Exported ${successCount} sentences to Anki.`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setGenerationErr(`Could not export via AnkiConnect: ${message}`);
    } finally {
      setExportBusy(false);
    }
  }

  return {
    settings,
    setSettings,
    settingsOpen,
    setSettingsOpen,
    ankiStatus,
    wordEntryState: {
      wordEntries,
      selectedWordEntryId,
      selectedWordEntry,
      onSelect: setSelectedWordEntryId,
      onNewWordEntry,
      onDeleteWordEntry,
      onUpdateWordEntry,
    },
    sentenceGenState: {
      difficulty: sentenceGenDifficulty,
      generationBusy,
      analysisBusy,
      generationErr,
      generationNotice,
      onGenerate,
      onAnalyze,
      onClearMessages,
      onDifficultyChange: setSentenceGenDifficulty,
    },
    ankiExportState: {
      exportBusy,
      onExport,
    },
    furiganaState: {
      status: furiganaStatus,
      available: furiganaAvailable,
    },
    doSettingsNeedAttention,
  };
}
