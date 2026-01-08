import { useState } from "react";
import type { AppSettings, Job, SentenceGeneration, SentenceItem } from "../state/types";
import { DIFFICULTY_PROFILES } from "../state/difficulty";
import { touch, uid } from "../state/store";
import { generateSentences } from "../lib/openaiResponses";
import { buildMockGenerations } from "../lib/mockGeneration";

export function GenerationsPane(props: {
  job: Job;
  settings: AppSettings;
  onChange: (job: Job) => void;
}) {
  const { job, settings, onChange } = props;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function buildSentenceItem(generation: SentenceGeneration): SentenceItem {
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
      definitionSnapshot: definition
        ? {
            index: definition.index,
            text: definition.text,
          }
        : undefined,
    };
  }

  function onRemove(sentenceId: string) {
    onChange(touch({ ...job, sentences: job.sentences.filter((sentence) => sentence.id !== sentenceId) }));
  }

  function onToggleExport(sentenceId: string) {
    onChange(
      touch({
        ...job,
        sentences: job.sentences.map((sentence) =>
          sentence.id === sentenceId
            ? { ...sentence, exportEnabled: !sentence.exportEnabled }
            : sentence
        ),
      })
    );
  }

  async function onGenerate() {
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      onChange(touch({ ...job, status: "generating" }));

      const results: SentenceGeneration[] = settings.apiKey
        ? await generateSentences(job, settings)
        : buildMockGenerations(job, settings);
      if (!settings.apiKey) {
        setNotice("No API key set — using mock results.");
      }

      const nextItems = results.map((generation) => buildSentenceItem(generation));
      onChange(
        touch({
          ...job,
          generations: results,
          sentences: [...job.sentences, ...nextItems],
          status: "ready",
        })
      );
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setErr(msg);
      onChange(touch({ ...job, status: "error" }));
    } finally {
      setBusy(false);
    }
  }

  function onClear() {
    onChange(touch({ ...job, generations: [], sentences: [], status: "draft" }));
    setErr(null);
  }

  return (
    <div className="paneInner">
      <div className="paneHeader">
        <div className="paneTitle">Generations</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn secondary" onClick={onClear} disabled={busy || !(job?.sentences?.length)}>
            Clear
          </button>
          <button className="btn" onClick={onGenerate} disabled={busy}>
            {busy ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>

      <div className="paneBody" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {err && (
          <div style={{ border: "1px solid #3a1f1f", background: "#1a0f0f", padding: 10, borderRadius: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
            <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{err}</div>
          </div>
        )}
        {notice && (
          <div style={{ border: "1px solid #2a2f3a", background: "#11151c", padding: 10, borderRadius: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Info</div>
            <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{notice}</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {job.sentences.length === 0 ? (
            <div className="muted">No sentences yet. Click Generate.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {job.sentences.map((sentence) => (
                <div
                  key={sentence.id}
                  style={{
                    border: "1px solid #263026",
                    borderRadius: 10,
                    padding: 10,
                    background: "#0f1510",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 700 }}>
                      {sentence.definitionSnapshot
                        ? `#${sentence.definitionSnapshot.index}`
                        : "Sentence"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {sentence.exportStatus === "new" && "New"}
                        {sentence.exportStatus === "exported" && "Exported"}
                        {sentence.exportStatus === "failed" && "Failed"}
                      </div>
                      <label className="muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={sentence.exportEnabled}
                          onChange={() => onToggleExport(sentence.id)}
                          disabled={busy}
                        />
                        Export
                      </label>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {new Date(sentence.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap", display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>{sentence.jp}</div>
                    <div className="muted">{DIFFICULTY_PROFILES[job.difficulty].label}</div>
                  </div>
                  <div className="muted">{sentence.en}</div>
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="muted" style={{ fontSize: 12, whiteSpace: "pre-wrap", flex: 1 }}>
                      {sentence.notes}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexShrink: 0 }}>
                      <button
                        className="btn secondary"
                        onClick={() => onRemove(sentence.id)}
                        disabled={busy}
                        title="Remove"
                        aria-label="Remove"
                        style={{ padding: "4px 8px", fontSize: 12 }}
                      >
                        🗑️
                      </button>
                      <button
                        className="btn secondary"
                        disabled
                        title="Edit (coming soon)"
                        aria-label="Edit (coming soon)"
                        style={{ padding: "4px 8px", fontSize: 12 }}
                      >
                        ✎
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Note: OpenAI recommends keeping API keys out of client-side code; for GitHub Pages we should add a small proxy later.
        </div>
      </div>
    </div>
  );
}
