import { useMemo, useState } from "react";
import type { AppSettings, GenerationBatch, Job, SentenceGeneration, SentenceItem } from "../state/types";
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
  const [groupBy, setGroupBy] = useState<"definition" | "batch">("definition");

  function buildSentenceItem(generation: SentenceGeneration, batchId: number): SentenceItem {
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

      const batchId = nextBatchId(job.generationBatches);
      const batchCreatedAt = results[0]?.createdAt ?? Date.now();
      const batch: GenerationBatch = {
        id: batchId,
        createdAt: batchCreatedAt,
        difficulty: job.difficulty,
        definitions: job.definitions.map((definition) => ({ ...definition })),
      };
      const nextItems = results.map((generation) => buildSentenceItem(generation, batchId));
      onChange(
        touch({
          ...job,
          generations: results,
          generationBatches: [...job.generationBatches, batch],
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
    onChange(touch({ ...job, generations: [], generationBatches: [], sentences: [], status: "draft" }));
    setErr(null);
  }

  const groupedByBatch = useMemo(() => {
    const grouped = new Map<number, SentenceItem[]>();
    for (const sentence of job.sentences) {
      const key = sentence.batchId ?? -1;
      const existing = grouped.get(key) ?? [];
      existing.push(sentence);
      grouped.set(key, existing);
    }

    const ordered = [...job.generationBatches].sort((a, b) => b.id - a.id);
    const groups = ordered
      .map((batch) => ({
        key: batch.id,
        batch,
        sentences: grouped.get(batch.id) ?? [],
      }))
      .filter((group) => group.sentences.length > 0);

    if (grouped.has(-1)) {
      groups.push({ key: -1, batch: undefined, sentences: grouped.get(-1) ?? [] });
    }

    return groups;
  }, [job.generationBatches, job.sentences]);

  const groupedByDefinition = useMemo(() => {

    const grouped = new Map<number, {
      definition?: SentenceItem["definitionSnapshot"];
      sentences: SentenceItem[];
    }>();

    for (const sentence of job.sentences) {
      const def = sentence.definitionSnapshot;
      const key = def?.index ?? -1;
      const existing = grouped.get(key) ?? { definition: def, sentences: [] };
      existing.sentences.push(sentence);
      grouped.set(key, existing);
    }

    return [...grouped.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.key - b.key);
  }, [job.sentences]);

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 12px 0px 12px" }}>
        <div className="muted" style={{ fontSize: 12 }}>Group by</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className={`btn secondary ${groupBy === "definition" ? "active" : ""}`}
            onClick={() => setGroupBy("definition")}
            disabled={busy}
            style={{ padding: "4px 8px", fontSize: 12 }}
          >
            Definition
          </button>
          <button
            className={`btn secondary ${groupBy === "batch" ? "active" : ""}`}
            onClick={() => setGroupBy("batch")}
            disabled={busy}
            style={{ padding: "4px 8px", fontSize: 12 }}
          >
            Batch
          </button>
        </div>
      </div>

      <div className="paneBody" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {job.sentences.length === 0 ? (
            <div className="muted">No sentences yet. Click Generate.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groupBy === "batch"
                ? groupedByBatch.map((group) => {
                    const batch = group.batch;
                    const date = new Date(batch.createdAt);
                    const difficulty = DIFFICULTY_PROFILES[batch.difficulty];
                    return (
                      <div key={group.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontWeight: 600, fontStyle: "italic" }}>
                            {batch ? `Batch ${batch.id}` : "Unbatched Sentences"}
                          </div>
                          {batch && (
                            <div className="muted" style={{ fontSize: 12 }}>
                              {date.toLocaleString()} · {difficulty.shortLabel ?? difficulty.label}
                            </div>
                          )}
                        </div>
                        {group.sentences.map((sentence) => (
                          <div
                            key={sentence.id}
                            style={{
                              border: "1px solid #263026",
                              borderRadius: 10,
                              padding: 8,
                              background: "#0f1510",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                              <div style={{ flex: 1, minWidth: 0, fontWeight: 400, lineHeight: 1.3 }}>
                                {sentence.jp}
                              </div>
                              <div style={{ flexShrink: 0, whitespace: "nowrap", display: "flex", alignItems: "start", gap: 10 }}>
                                <div className="muted" style={{ fontSize: 12 }}>
                                  {sentence.definitionSnapshot && "D" + sentence.definitionSnapshot.index}
                                  {sentence.definitionSnapshot && sentence.exportStatus && " · "}
                                  {sentence.exportStatus === "new" && "New"}
                                  {sentence.exportStatus === "exported" && "Exported"}
                                  {sentence.exportStatus === "failed" && "Failed"}
                                </div>
                              </div>
                            </div>
                            <div style={{ marginTop: 4, display: "flex", alignItems: "end", gap: 8 }}>
                              <div className="muted" style={{ whiteSpace: "pre-wrap", flex: 1 }}>
                                {sentence.en}
                              </div>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexShrink: 0 }}>
                                <button
                                  className="btn secondary"
                                  onClick={() => onRemove(sentence.id)}
                                  disabled={busy}
                                  title="Remove"
                                  aria-label="Remove"
                                  style={{ padding: "0px 4px", fontSize: 12 }}
                                >
                                  🗑️
                                </button>
                                <button
                                  className="btn secondary"
                                  disabled
                                  title="Edit (coming soon)"
                                  aria-label="Edit (coming soon)"
                                  style={{ padding: "0px 4px", fontSize: 12 }}
                                >
                                  ✎
                                </button>
                                <label className="muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 2 }}>
                                  <input
                                    type="checkbox"
                                    checked={sentence.exportEnabled}
                                    onChange={() => onToggleExport(sentence.id)}
                                    disabled={busy}
                                  />
                                  Export
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })
                : groupedByDefinition.map((group) => (
                    <div key={group.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontWeight: 600, marginTop: 6, fontStyle: "italic" }}>
                        {group.definition
                          ? `${group.definition.index}. ${group.definition.text}`
                          : "Definition"}
                      </div>
                      {group.sentences.map((sentence) => {
                        const difficulty = DIFFICULTY_PROFILES[sentence.difficulty];
                        return (
                          <div
                            key={sentence.id}
                            style={{
                              border: "1px solid #263026",
                              borderRadius: 10,
                              padding: 8,
                              background: "#0f1510",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                              <div style={{ flex: 1, minWidth: 0, fontWeight: 400, lineHeight: 1.3 }}>
                                {sentence.jp}
                              </div>
                              <div className="muted" style={{ fontSize: 12, flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "start", gap: 10 }}>
                                {sentence.batchId && "B" + sentence.batchId}
                                {sentence.batchId && sentence.difficulty && " · "}
                                {sentence.difficulty && (difficulty.shortLabel ?? difficulty.label)}
                                {(sentence.batchId || sentence.difficulty) && sentence.exportStatus && " · "}
                                {sentence.exportStatus === "new" && "New"}
                                {sentence.exportStatus === "exported" && "Exported"}
                                {sentence.exportStatus === "failed" && "Failed"}
                              </div>
                            </div>
                            <div style={{ marginTop: 4, display: "flex", alignItems: "end", gap: 8 }}>
                              <div className="muted" style={{ whiteSpace: "pre-wrap", flex: 1 }}>
                                {sentence.en}
                              </div>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexShrink: 0 }}>
                                <button
                                  className="btn secondary"
                                  onClick={() => onRemove(sentence.id)}
                                  disabled={busy}
                                  title="Remove"
                                  aria-label="Remove"
                                  style={{ padding: "0px 4px", fontSize: 12 }}
                                >
                                  🗑️
                                </button>
                                <button
                                  className="btn secondary"
                                  disabled
                                  title="Edit (coming soon)"
                                  aria-label="Edit (coming soon)"
                                  style={{ padding: "0px 4px", fontSize: 12 }}
                                >
                                  ✎
                                </button>
                                <label className="muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 2 }}>
                                  <input
                                    type="checkbox"
                                    checked={sentence.exportEnabled}
                                    onChange={() => onToggleExport(sentence.id)}
                                    disabled={busy}
                                  />
                                  Export
                                </label>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
