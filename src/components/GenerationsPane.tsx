import { useState } from "react";
import type { AppSettings, Job, SentenceGeneration } from "../state/types";
import { DIFFICULTY_PROFILES } from "../state/difficulty";
import { touch } from "../state/store";
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

      onChange(
        touch({
          ...job,
          generations: results,
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
    onChange(touch({ ...job, generations: [], status: "draft" }));
    setErr(null);
  }

  return (
    <div className="paneInner">
      <div className="paneHeader">
        <div className="paneTitle">Generations</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn secondary" onClick={onClear} disabled={busy || !(job?.generations?.length)}>
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

        {!(job?.generations?.length) ? (
          <div className="muted">No results yet. Click Generate.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {job.generations.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid #242834",
                  borderRadius: 10,
                  padding: 10,
                  background: "#0f1115",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>
                    #{r.defIndex}{String.fromCharCode(97 + r.defSubIndex)}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ marginTop: 6, whiteSpace: "pre-wrap", display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    {r.jp}
                  </div>
                  <div className="muted">
                    {DIFFICULTY_PROFILES[r.difficulty].label}
                  </div>
                </div>
                <div className="muted">{r.en}</div>
                <div className="muted" style={{ marginTop: 6, fontSize: 12, whiteSpace: "pre-wrap" }}>
                  {r.notes}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Note: OpenAI recommends keeping API keys out of client-side code; for GitHub Pages we should add a small proxy later.
        </div>
      </div>
    </div>
  );
}
