import { useEffect, useMemo, useState } from "react";
import "../styles.css";
import { WordListPane } from "../ui/WordListPane";
import { WordSetupPane } from "../ui/WordSetupPane";
import { GenerationsPane } from "../ui/GenerationsPane";
import { SettingsModal } from "../ui/SettingsModal";
import { createEmptyWordEntry, normalizeWordEntry, touch, uid } from "../wordEntry/wordEntryStore";
import type { AppSettings } from "../settings/settingsTypes";
import type { GenerationBatch, SentenceGeneration, SentenceItem } from "../sentenceGen/sentenceGenTypes";
import type { WordEntry } from "../wordEntry/wordEntryTypes";
import { defaultSettings } from "../settings/settingsDefaults";
import { loadPersistedState, savePersistedState } from "../app/appPersistence";
import { analyzeMeanings, generateSentences } from "../llm/llmResponses";
import { buildMockGenerations } from "../sentenceGen/sentenceGenMock";
import { useAnkiConnectStatus, fetchModelFieldNames, addNotes } from "../anki/ankiConnect";
import { buildAnkiFieldPayload, buildAnkiTags } from "../anki/ankiExport";
import { initKuroshiro, isKuroshiroReady } from "../kuroshiro/kuroshiroService";

function pickInitialState(): { wordEntries: WordEntry[]; selectedWordEntryId: string; settings: AppSettings } {
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

    return { wordEntries: persisted.wordEntries.map(normalizeWordEntry), selectedWordEntryId: selected, settings };
  }
  const settings = defaultSettings();
  const first = createEmptyWordEntry({ difficulty: settings.defaultDifficulty });
  return { wordEntries: [first], selectedWordEntryId: first.id, settings };
}

function buildSentenceItem(wordEntry: WordEntry, generation: SentenceGeneration, batchId: number): SentenceItem {
  const definition = wordEntry.definitions.find((item) => item.index === generation.defIndex);
  return {
    id: uid(),
    jp: generation.jp,
    en: generation.en,
    notes: generation.notes,
    source: "generated",
    createdAt: generation.createdAt,
    exportEnabled: true,
    exportStatus: "new",
    generationId: generation.id,
    batchId,
    difficulty: generation.difficulty,
    definitionSnapshot: definition
      ? {
          index: definition.index,
          text: definition.text,
        }
      : undefined,
  };
}

function nextBatchId(batches: GenerationBatch[]): number {
  if (batches.length === 0) return 1;
  return Math.max(...batches.map((batch) => batch.id)) + 1;
}

export default function App() {
  const initial = useMemo(() => pickInitialState(), []);
  const [wordEntries, setWordEntries] = useState<WordEntry[]>(initial.wordEntries);
  const [selectedWordEntryId, setSelectedWordEntryId] = useState<string>(initial.selectedWordEntryId);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [generationErr, setGenerationErr] = useState<string | null>(null);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const [furiganaStatus, setFuriganaStatus] = useState<"idle" | "loading" | "ready" | "error">(
    isKuroshiroReady() ? "ready" : "idle",
  );
  const furiganaAvailable = settings.enableFurigana && furiganaStatus === "ready";

  const selectedWordEntry = useMemo(
    () => wordEntries.find((entry) => entry.id === selectedWordEntryId) ?? wordEntries[0],
    [wordEntries, selectedWordEntryId]
  );

  // Persist whenever word entries or selection changes
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
    });
  }, [wordEntries, selectedWordEntryId, settings]);

  useEffect(() => {
    if (!settings.enableFurigana) {
      setFuriganaStatus(isKuroshiroReady() ? "ready" : "idle");
      return;
    }

    if (isKuroshiroReady()) {
      setFuriganaStatus("ready");
      return;
    }

    let cancelled = false;
    setFuriganaStatus("loading");
    initKuroshiro()
      .then(() => {
        if (!cancelled) setFuriganaStatus("ready");
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setFuriganaStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [settings.enableFurigana]);

  const anki = useAnkiConnectStatus({
    enabled: true, // or "settings modal open"
    onlineIntervalMs: 5000,
    offlineIntervalMs: 3000,
  });

  function doSettingsNeedAttention(): boolean {
    return !settings.apiKey || !settings.model || !settings.ankiDeckName || !settings.ankiModelName;
  }

  function onNewWordEntry() {
    const wordEntry = createEmptyWordEntry({ difficulty: settings.defaultDifficulty });
    setWordEntries((prev) => [wordEntry, ...prev]);
    setSelectedWordEntryId(wordEntry.id);
  }

  function onDeleteWordEntry(id: string) {
    setWordEntries((prev) => {
      const next = prev.filter((entry) => entry.id !== id);

      // If we deleted the selected word entry, choose a new selection.
      if (selectedWordEntryId === id) {
        setSelectedWordEntryId(next[0]?.id ?? "");
      }

      // Always keep at least one word entry around.
      if (next.length === 0) {
        const created = createEmptyWordEntry({ difficulty: settings.defaultDifficulty });
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
        ? await generateSentences(selectedWordEntry, settings)
        : buildMockGenerations(selectedWordEntry, settings);

      if (!settings.apiKey) {
        setGenerationNotice("No API key set — using mock results.");
      }

      const batchId = nextBatchId(selectedWordEntry.generationBatches);
      const batchCreatedAt = results[0]?.createdAt ?? Date.now();
      const batch: GenerationBatch = {
        id: batchId,
        createdAt: batchCreatedAt,
        difficulty: selectedWordEntry.difficulty,
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

  async function onAnalyzeDefinitions() {
    if (!selectedWordEntry) return;
    setGenerationErr(null);
    setGenerationNotice(null);
    setAnalysisBusy(true);
    try {
      const results = await analyzeMeanings(selectedWordEntry, settings);
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
      const sentenceCacheUpdates = new Map<string, SentenceItem["furiganaCache"]>();

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
            tags: buildAnkiTags(settings, wordEntry, sentence),
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">
          JP SRS Sentence Builder
        </div>
        <div className="muted">
          ① Add a word → ② Review meanings → ③ Generate sentences → ④ Export to Anki
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn secondary" onClick={() => setSettingsOpen(true)}>
            Settings{ doSettingsNeedAttention() ? " ⚠️" : "" }
          </button>
          <button className="btn" onClick={onExport} disabled={exportBusy}>
            {exportBusy ? "Exporting…" : "Export"}
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="pane">
          <WordListPane
            wordEntries={wordEntries}
            selectedWordEntryId={selectedWordEntryId}
            onSelect={setSelectedWordEntryId}
            onNewWordEntry={onNewWordEntry}
            onDeleteWordEntry={onDeleteWordEntry}
            onUpdateWordEntry={onUpdateWordEntry}
            settings={settings}
            furiganaAvailable={furiganaAvailable}
            furiganaStatus={furiganaStatus}
          />
        </section>

        <section className="pane">
          {selectedWordEntry ? (
            <WordSetupPane
              wordEntry={selectedWordEntry}
              settings={settings}
              generateBusy={generationBusy}
              analyzeBusy={analysisBusy}
              onGenerate={onGenerate}
              onAnalyze={onAnalyzeDefinitions}
              onUpdateWordEntry={onUpdateWordEntry}
            />
          ) : (
            <div className="empty">No word selected.</div>
          )}
        </section>

        <section className="pane">
          {selectedWordEntry ? (
            <GenerationsPane
              wordEntry={selectedWordEntry}
              settings={settings}
              busy={generationBusy || exportBusy}
              err={generationErr}
              notice={generationNotice}
              onClearMessages={onClearMessages}
              onUpdateWordEntry={onUpdateWordEntry}
              furiganaAvailable={furiganaAvailable}
              furiganaStatus={furiganaStatus}
            />
          ) : (
            <div className="empty">No word selected.</div>
          )}
        </section>
      </main>

      <footer className="footer" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div className="muted">Saved automatically to your browser</div>
        <div className="muted">
          {anki.kind == "checking" && "Connecting to Anki..."}
          {anki.kind == "online"   && "Anki connected"}
          {anki.kind == "outdated" && "⚠️ AnkiConnect update required"}
          {anki.kind == "offline"  && "⚠️ Anki not connected"}
        </div>
      </footer>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          furiganaStatus={furiganaStatus}
        />
      )}
    </div>
  );
}
