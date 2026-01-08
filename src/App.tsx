import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { WordListPane } from "./components/WordListPane";
import { WordSetupPane } from "./components/WordSetupPane";
import { GenerationsPane } from "./components/GenerationsPane";
import { SettingsModal } from "./components/SettingsModal";
import { createEmptyJob, normalizeJob } from "./state/store";
import type { Job, AppSettings } from "./state/types";
import { defaultSettings } from "./state/defaults";
import { loadPersistedState, savePersistedState } from "./state/persistence";

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

export default function App() {
  const initial = useMemo(() => pickInitialState(), []);
  const [jobs, setJobs] = useState<Job[]>(initial.jobs);
  const [selectedJobId, setSelectedJobId] = useState<string>(initial.selectedJobId);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
            <WordSetupPane job={selectedJob} settings={settings} onChange={onUpdateJob} />
          ) : (
            <div className="empty">No word selected.</div>
          )}
        </section>

        <section className="pane">
          {selectedJob ? (
            <GenerationsPane job={selectedJob} settings={settings} onChange={onUpdateJob} />
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
