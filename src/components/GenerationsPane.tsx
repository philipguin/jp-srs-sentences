import { useMemo, useState } from "react";
import type { Job, SentenceItem } from "../state/types";
import { DIFFICULTY_PROFILES } from "../state/difficulty";
import { touch } from "../state/store";

export function GenerationsPane(props: {
  job: Job;
  busy: boolean;
  err: string | null;
  notice: string | null;
  onClearMessages: () => void;
  onChange: (job: Job) => void;
}) {
  const { job, busy, err, notice, onClearMessages, onChange } = props;
  const [groupBy, setGroupBy] = useState<"definition" | "batch">("definition");

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

  function onClear() {
    if (!job.sentences.length) return;
    const confirmed = window.confirm("Clear all sentences for this word?");
    if (!confirmed) return;
    onChange(touch({ ...job, generations: [], generationBatches: [], sentences: [], status: "draft" }));
    onClearMessages();
  }

  function onToggleAllExports() {
    if (!job.sentences.length) return;
    const allChecked = job.sentences.every((sentence) => sentence.exportEnabled);
    onChange(
      touch({
        ...job,
        sentences: job.sentences.map((sentence) => ({
          ...sentence,
          exportEnabled: !allChecked,
        })),
      })
    );
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

  const hasSentences = job.sentences.length > 0;
  const allExportsEnabled = hasSentences && job.sentences.every((sentence) => sentence.exportEnabled);

  return (
    <div className="paneInner">
      <div className="paneHeader">
        <div className="paneTitle">Generations</div>
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
            <div className="muted">No sentences yet. Click Generate Sentences.</div>
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
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px" }}>
        <button
          className="btn secondary"
          onClick={onToggleAllExports}
          disabled={busy || !hasSentences}
        >
          {allExportsEnabled ? "Uncheck All Exports" : "Check All Exports"}
        </button>
        <button className="btn secondary" onClick={onClear} disabled={busy || !hasSentences}>
          Clear All
        </button>
      </div>
    </div>
  );
}
