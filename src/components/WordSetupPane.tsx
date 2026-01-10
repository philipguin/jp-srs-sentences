import { useState } from "react";
import type { Job, Difficulty, DifficultyProfile, DefinitionSpec, AppSettings } from "../state/types";
import { DIFFICULTY_PROFILES } from "../state/difficulty";
import { touch } from "../state/store";
import { applyCountPreset, mergeCounts, parseDefinitions } from "../lib/parseDefinitions";
import { applyTemplate } from "../lib/template";

export function WordSetupPane(props: {
  job: Job;
  settings: AppSettings;
  busy: boolean;
  onGenerate: () => void;
  onChange: (job: Job) => void;
}) {
  const { job, settings, busy, onGenerate, onChange } = props;
  const [definitionsLoading, setDefinitionsLoading] = useState(false);

  function setDefinitionsRaw(raw: string) {
    const parsed = parseDefinitions(raw);
    const withPreset = applyCountPreset(parsed, settings.defaultCountPreset);
    const merged = mergeCounts(withPreset, job.definitions);

    onChange(
      touch({
        ...job,
        definitionsRaw: raw,
        definitions: merged,
        generations: [],
        status: "draft",
      })
    );
  }

  function setDefCount(defIndex: number, count: number) {
    const next: DefinitionSpec[] = job.definitions.map((d) =>
      d.index === defIndex ? { ...d, count } : d
    );
    onChange(touch({ ...job, definitions: next }));
  }

  async function populateFromJpdb() {
    const keyword = job.word.trim();
    if (!keyword) return;
    if (!settings.jpdbApiKey) {
      console.error("Missing JPDB API key (Settings → Dictionary).");
      return;
    }

    setDefinitionsLoading(true);
    try {
      const response = await fetch("https://jpdb.io/api/v1/lookup-vocabulary", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.jpdbApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          list: [[keyword, job.reading?.trim() || keyword]],
          fields: ["spelling", "reading", "meanings"],
        }),
      });

      if (!response.ok) {
        throw new Error(`JPDB request failed (${response.status})`);
      }

      const payload = (await response.json()) as {
        vocabulary_info?: [string, string, string[]][];
      };
      const meanings = payload.vocabulary_info?.[0]?.[2] ?? [];
      const lines = meanings.map((meaning, index) => `${index + 1}. ${meaning}`);

      setDefinitionsRaw(lines.join("\n"));
    } catch (error) {
      console.error("Failed to load definitions from JPDB.", error);
    } finally {
      setDefinitionsLoading(false);
    }
  }

  return (
    <div className="paneInner">
      <div className="paneHeader">
        <div className="paneTitle">Word Setup</div>
        <div className="badge">dictionary form + definitions</div>
      </div>

      <div className="paneBody" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="row">
          <input
            className="input"
            placeholder="Word (dictionary form)"
            value={job.word}
            onChange={(e) => onChange(touch({ ...job, word: e.target.value }))}
          />
        </div>

        <div className="row">
          <input
            className="input"
            placeholder="Reading (optional)"
            value={job.reading ?? ""}
            onChange={(e) => onChange(touch({ ...job, reading: e.target.value }))}
          />
        </div>

        <div className="row">
          <select
            className="select"
            value={job.difficulty}
            onChange={(e) => onChange(touch({ ...job, difficulty: e.target.value as Difficulty }))}
          >
            {(Object.entries(DIFFICULTY_PROFILES) as [Difficulty, DifficultyProfile][])
              .map(([diff, profile]) => (
                <option key={diff} value={diff} title={profile.shortHelp}>
                  {profile.label}
                </option>
              ))
            }
          </select>
        </div>

        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="muted">Definitions (paste numbered lines like “1. …” “2. …”)</div>
          <button
            className="btn secondary"
            type="button"
            onClick={populateFromJpdb}
            disabled={definitionsLoading || job.word.trim().length === 0}
            style={{ padding: "4px 8px" }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {definitionsLoading ? <span className="spinner" /> : null}
              {definitionsLoading ? "Fetching…" : "Fetch from JPDB"}
            </span>
          </button>
        </div>
        <textarea
          className="textarea"
          value={job.definitionsRaw}
          onChange={(e) => setDefinitionsRaw(e.target.value)}
          placeholder={"1. to ...\n2. to ...\n3. ..."}
          style={{ minHeight: 42, height: 100, resize: "vertical" }}
        />

        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="muted">Parsed definitions</div>
          <div className="small">Count preset: {settings.defaultCountPreset}</div>
        </div>

        {job.definitions.length === 0 ? (
          <div className="muted">Paste definitions above to populate this list.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {job.definitions.map((d) => (
              <div
                key={d.index}
                style={{
                  border: "1px solid #242834",
                  borderRadius: 10,
                  padding: 6,
                  background: "#0f1115",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    paddingLeft: 10,
                    textAlign: "right",
                    opacity: 0.7,
                    fontWeight: 650,
                    flexShrink: 0,
                  }}
                >
                  #{d.index}
                </div>

                <div
                  style={{
                    flex: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={
                    d.text +
                    "\n" +
                    applyTemplate(settings.notesTemplate, {
                      word: job.word,
                      reading: job.reading,
                      difficulty: job.difficulty,
                      defIndex: d.index,
                      meaning: d.text,
                    })
                  }
                >
                  {d.text}
                </div>

                <input
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  value={d.count}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setDefCount(d.index, Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1);
                  }}
                  style={{
                    maxWidth: 32,
                    textAlign: "center",
                    flexShrink: 0,
                    padding: 2,
                    borderRadius: 8,
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
          <button className="btn" onClick={onGenerate} disabled={busy}>
            {busy ? "Generating…" : "Generate Sentences"}
          </button>
        </div>
      </div>
    </div>
  );
}
