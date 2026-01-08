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

function pickInitialState(): { jobs: Job[]; selectedJobId: string; settings: AppSettings } {
  const persisted = loadPersistedState();
  if (persisted && persisted.jobs.length > 0) {
    const selected =
      persisted.selectedJobId && persisted.jobs.some((j) => j.id === persisted.selectedJobId)
        ? persisted.selectedJobId
        : persisted.jobs[0].id;

    return { jobs: persisted.jobs.map(normalizeJob), selectedJobId: selected, settings: persisted.settings };
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
  const [generationErr, setGenerationErr] = useState<string | null>(null);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);

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

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">JP SRS Sentence Builder</div>
        <button className="btn" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </header>

      <main className="grid">
        <section className="pane">
          <WordListPane
            jobs={jobs}
            selectedJobId={selectedJobId}
            onSelect={setSelectedJobId}
            onNewJob={onNewJob}
            onDeleteJob={onDeleteJob}
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
              busy={generationBusy}
              err={generationErr}
              notice={generationNotice}
              onClearMessages={onClearMessages}
              onChange={onUpdateJob}
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
        />
      )}
    </div>
  );
}
