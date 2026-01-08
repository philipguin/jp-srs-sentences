import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { WordListPane } from "./components/WordListPane";
import { WordSetupPane } from "./components/WordSetupPane";
import { GenerationsPane } from "./components/GenerationsPane";
import { SettingsModal } from "./components/SettingsModal";
import { createEmptyJob, normalizeJob, touch, uid } from "./state/store";
import type { AppSettings, GenerationBatch, Job, SentenceGeneration, SentenceItem } from "./state/types";
import { defaultSettings } from "./state/defaults";
import { loadPersistedState, savePersistedState } from "./state/persistence";
import { generateSentences } from "./lib/openaiResponses";
import { buildMockGenerations } from "./lib/mockGeneration";
import { addNotes, fetchModelFieldNames } from "./lib/ankiConnect";
import { buildAnkiFieldPayload, buildAnkiTags } from "./lib/ankiExport";
import { initFurigana, isFuriganaReady } from "./lib/furigana";

function pickInitialState(): { jobs: Job[]; selectedJobId: string; settings: AppSettings } {
  const persisted = loadPersistedState();
  if (persisted && persisted.jobs.length > 0) {
    const defaults = defaultSettings();
    const selected =
      persisted.selectedJobId && persisted.jobs.some((j) => j.id === persisted.selectedJobId)
        ? persisted.selectedJobId
        : persisted.jobs[0].id;

    const settings: AppSettings = {
      ...defaults,
      ...persisted.settings,
      ankiFieldMappings: {
        ...defaults.ankiFieldMappings,
        ...persisted.settings.ankiFieldMappings,
      },
    };

    return { jobs: persisted.jobs.map(normalizeJob), selectedJobId: selected, settings };
  }
  const settings = defaultSettings();
  const first = createEmptyJob({ difficulty: settings.defaultDifficulty });
  return { jobs: [first], selectedJobId: first.id, settings };
}

function buildSentenceItem(job: Job, generation: SentenceGeneration, batchId: number): SentenceItem {
  const definition = job.definitions.find((item) => item.index === generation.defIndex);
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
  const [jobs, setJobs] = useState<Job[]>(initial.jobs);
  const [selectedJobId, setSelectedJobId] = useState<string>(initial.selectedJobId);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [generationErr, setGenerationErr] = useState<string | null>(null);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const [furiganaStatus, setFuriganaStatus] = useState<"idle" | "loading" | "ready" | "error">(
    isFuriganaReady() ? "ready" : "idle",
  );
  const furiganaAvailable = settings.enableFurigana && furiganaStatus === "ready";

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) ?? jobs[0],
    [jobs, selectedJobId]
  );

  // Persist whenever jobs or selection changes
  useEffect(() => {
    const toSave: AppSettings = settings.rememberApiKey
      ? settings
      : { ...settings, apiKey: "" }; // don’t persist key unless opted in

    savePersistedState({
      version: 2,
      jobs,
      selectedJobId,
      settings: toSave,
    });
  }, [jobs, selectedJobId, settings]);

  useEffect(() => {
    if (!settings.enableFurigana) {
      setFuriganaStatus(isFuriganaReady() ? "ready" : "idle");
      return;
    }

    if (isFuriganaReady()) {
      setFuriganaStatus("ready");
      return;
    }

    let cancelled = false;
    setFuriganaStatus("loading");
    initFurigana()
      .then(() => {
        if (!cancelled) setFuriganaStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setFuriganaStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [settings.enableFurigana]);


  function onNewJob() {
    const job = createEmptyJob({ difficulty: settings.defaultDifficulty });
    setJobs((prev) => [job, ...prev]);
    setSelectedJobId(job.id);
  }

  function onDeleteJob(id: string) {
    setJobs((prev) => {
      const next = prev.filter((j) => j.id !== id);

      // If we deleted the selected job, choose a new selection.
      if (selectedJobId === id) {
        setSelectedJobId(next[0]?.id ?? "");
      }

      // Always keep at least one job around.
      if (next.length === 0) {
        const created = createEmptyJob({ difficulty: settings.defaultDifficulty });
        setSelectedJobId(created.id);
        return [created];
      }

      return next;
    });
  }

  function onUpdateJob(updated: Job) {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  }

  async function onGenerate() {
    if (!selectedJob) return;
    setGenerationErr(null);
    setGenerationNotice(null);
    setGenerationBusy(true);
    try {
      onUpdateJob(touch({ ...selectedJob, status: "generating" }));

      const results: SentenceGeneration[] = settings.apiKey
        ? await generateSentences(selectedJob, settings)
        : buildMockGenerations(selectedJob, settings);

      if (!settings.apiKey) {
        setGenerationNotice("No API key set — using mock results.");
      }

      const batchId = nextBatchId(selectedJob.generationBatches);
      const batchCreatedAt = results[0]?.createdAt ?? Date.now();
      const batch: GenerationBatch = {
        id: batchId,
        createdAt: batchCreatedAt,
        difficulty: selectedJob.difficulty,
        definitions: selectedJob.definitions.map((definition) => ({ ...definition })),
      };
      const nextItems = results.map((generation) => buildSentenceItem(selectedJob, generation, batchId));
      onUpdateJob(
        touch({
          ...selectedJob,
          generations: results,
          generationBatches: [...selectedJob.generationBatches, batch],
          sentences: [...selectedJob.sentences, ...nextItems],
          status: "ready",
        })
      );
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setGenerationErr(msg);
      onUpdateJob(touch({ ...selectedJob, status: "error" }));
    } finally {
      setGenerationBusy(false);
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

    const exportTargets = jobs.flatMap((job) =>
      job.sentences
        .filter((sentence) => sentence.exportEnabled)
        .map((sentence) => ({ job, sentence }))
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
      const jobCacheUpdates = new Map<string, Job["furiganaCache"]>();
      const sentenceCacheUpdates = new Map<string, SentenceItem["furiganaCache"]>();

      const notes = await Promise.all(
        exportTargets.map(async ({ job, sentence }) => {
          const payload = await buildAnkiFieldPayload(
            fieldNames,
            fieldMapping,
            job,
            sentence,
            settings,
            furiganaAvailable,
          );
          if (payload.jobCache && payload.jobCache !== job.furiganaCache) {
            jobCacheUpdates.set(job.id, payload.jobCache);
          }
          if (payload.sentenceCache && payload.sentenceCache !== sentence.furiganaCache) {
            sentenceCacheUpdates.set(sentence.id, payload.sentenceCache);
          }
          return {
            deckName: settings.ankiDeckName,
            modelName: settings.ankiModelName,
            fields: payload.fields,
            tags: buildAnkiTags(settings, job, sentence),
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

      setJobs((prev) =>
        prev.map((job) => {
          let touched = false;
          const nextSentences = job.sentences.map((sentence) => {
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
          const jobCache = jobCacheUpdates.get(job.id);
          if (!touched && !jobCache) return job;
          return touch({
            ...job,
            sentences: nextSentences,
            furiganaCache: jobCache ?? job.furiganaCache,
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
        <div className="title">JP SRS Sentence Builder</div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn secondary" onClick={onExport} disabled={exportBusy}>
            {exportBusy ? "Exporting…" : "Export"}
          </button>
          <button className="btn" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="pane">
          <WordListPane
            jobs={jobs}
            selectedJobId={selectedJobId}
            onSelect={setSelectedJobId}
            onNewJob={onNewJob}
            onDeleteJob={onDeleteJob}
            onUpdateJob={onUpdateJob}
            settings={settings}
            furiganaAvailable={furiganaAvailable}
            furiganaStatus={furiganaStatus}
          />
        </section>

        <section className="pane">
          {selectedJob ? (
            <WordSetupPane
              job={selectedJob}
              settings={settings}
              busy={generationBusy}
              onGenerate={onGenerate}
              onChange={onUpdateJob}
            />
          ) : (
            <div className="empty">No word selected.</div>
          )}
        </section>

        <section className="pane">
          {selectedJob ? (
            <GenerationsPane
              job={selectedJob}
              settings={settings}
              busy={generationBusy || exportBusy}
              err={generationErr}
              notice={generationNotice}
              onClearMessages={onClearMessages}
              onChange={onUpdateJob}
              furiganaAvailable={furiganaAvailable}
              furiganaStatus={furiganaStatus}
            />
          ) : (
            <div className="empty">No word selected.</div>
          )}
        </section>
      </main>

      <footer className="footer">
        <div className="muted">Saved automatically to your browser (i.e. locally)</div>
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
