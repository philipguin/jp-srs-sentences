import { useEffect, useMemo, useState } from "react";
import type { AppSettings } from "../settings/settingsTypes";
import type { Job } from "../wordEntry/wordEntryTypes";
import { buildFuriganaCacheKey, ensureFuriganaCacheEntry } from "../furigana/furiganaService";

type DisplayMode = "natural" | "furigana" | "kana";

function JobTitle(props: {
  job: Job;
  displayMode: DisplayMode;
  furiganaAvailable: boolean;
  kanaMode: AppSettings["furiganaKanaMode"];
  onUpdateJob: (job: Job) => void;
}) {
  const { job, displayMode, furiganaAvailable, kanaMode, onUpdateJob } = props;
  const cacheKey = useMemo(() => buildFuriganaCacheKey(job.word, kanaMode), [job.word, kanaMode]);
  const cache = job.furiganaCache?.key === cacheKey ? job.furiganaCache : undefined;

  useEffect(() => {
    if (!furiganaAvailable) return;
    if (!job.word.trim()) return;
    if (displayMode === "natural") return;
    const field = displayMode === "kana" ? "kana" : "rubyHtml";
    if (cache?.[field]) return;
    let cancelled = false;

    async function load() {
      try {
        const nextCache = await ensureFuriganaCacheEntry(job.word, kanaMode, cache, field);
        if (cancelled) return;
        if (nextCache.key === cache?.key && nextCache[field] === cache?.[field]) return;
        onUpdateJob({ ...job, furiganaCache: nextCache });
      } catch {
        // Ignore and fall back to plain text.
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [cache, displayMode, furiganaAvailable, job, kanaMode, onUpdateJob]);

  if (displayMode === "kana") {
    if (furiganaAvailable && cache?.kana) {
      return <span>{cache.kana}</span>;
    }
    return <span>{job.reading || job.word}</span>;
  }

  if (displayMode === "furigana" && furiganaAvailable && cache?.rubyHtml) {
    return <span dangerouslySetInnerHTML={{ __html: cache.rubyHtml }} />;
  }

  return <span>{job.word}</span>;
}

export function WordListPane(props: {
  jobs: Job[];
  selectedJobId: string;
  onSelect: (id: string) => void;
  onNewJob: () => void;
  onDeleteJob: (id: string) => void;
  onUpdateJob: (job: Job) => void;
  settings: AppSettings;
  furiganaAvailable: boolean;
  furiganaStatus: "idle" | "loading" | "ready" | "error";
}) {
  const {
    jobs,
    selectedJobId,
    onSelect,
    onNewJob,
    onDeleteJob,
    onUpdateJob,
    settings,
    furiganaAvailable,
    furiganaStatus,
  } = props;
  const [displayMode, setDisplayMode] = useState<DisplayMode>("natural");

  useEffect(() => {
    if (!furiganaAvailable && displayMode === "furigana") {
      setDisplayMode("natural");
    }
  }, [displayMode, furiganaAvailable]);

  return (
    <div className="paneInner">
      <div className="paneHeader">
        <div className="paneTitle">Word List</div>
        <div className="row" style={{ gap: 8 }}>
          {settings.enableFurigana && furiganaStatus === "loading" ? (
            <span className="badge">Loading…</span>
          ) : null}
          <select
            className="select"
            value={displayMode}
            onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
            style={{ padding: "4px 8px" }}
          >
            <option value="natural">Naturally</option>
            {furiganaAvailable ? <option value="furigana">With furigana</option> : null}
            <option value="kana">As kana</option>
          </select>
          <button className="btn secondary" onClick={onNewJob} style={{ flexShrink: 0, padding: "2px 8px" }}>
            + New
          </button>
        </div>
      </div>

      <div className="paneBody">
        <div className="list">
          {jobs.map((job) => {
            const selected = job.id === selectedJobId;
            const title = job.word.trim() ? job.word.trim() : "(untitled)";
            const defs = job.definitions.length;
            const res = job.sentences.length;

            return (
              <div
                key={job.id}
                className={"item" + (selected ? " selected" : "")}
                onClick={() => onSelect(job.id)}
                role="button"
                tabIndex={0}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontWeight: 650 }}>
                    {title === "(untitled)" ? (
                      title
                    ) : (
                      <JobTitle
                        job={job}
                        displayMode={displayMode}
                        furiganaAvailable={furiganaAvailable}
                        kanaMode={settings.furiganaKanaMode}
                        onUpdateJob={onUpdateJob}
                      />
                    )}
                  </div>
                  <div className="small">
                    defs: {defs} · sentences: {res} · {job.status}
                  </div>
                </div>

                <button
                  className="btn danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteJob(job.id);
                  }}
                  title="Delete job"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {jobs.length === 0 && <div className="muted">No jobs yet.</div>}
      </div>
    </div>
  );
}
