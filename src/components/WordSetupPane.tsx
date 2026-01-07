import type { Job, Difficulty, DifficultyProfile, DefinitionSpec, AppSettings } from "../state/types";
import { DIFFICULTY_PROFILES } from "../state/difficulty";
import { touch } from "../state/store";
import { applyCountPreset, mergeCounts, parseDefinitions } from "../lib/parseDefinitions";
import { applyTemplate } from "../lib/template";

export function WordSetupPane(props: {
  job: Job;
  settings: AppSettings;
  onChange: (job: Job) => void;
}) {
  const { job, settings, onChange } = props;

  function setDefinitionsRaw(raw: string) {
    const parsed = parseDefinitions(raw);
    const withPreset = applyCountPreset(parsed, settings.defaultCountPreset);
    const merged = mergeCounts(withPreset, job.definitions);

    onChange(
      touch({
        ...job,
        definitionsRaw: raw,
        definitions: merged,
      })
    );
  }

  function setDefCount(defIndex: number, count: number) {
    const next: DefinitionSpec[] = job.definitions.map((d) =>
      d.index === defIndex ? { ...d, count } : d
    );
    onChange(touch({ ...job, definitions: next }));
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

        <div className="muted">Definitions (paste numbered lines like “1. …” “2. …”)</div>
        <textarea
          className="textarea"
          value={job.definitionsRaw}
          onChange={(e) => setDefinitionsRaw(e.target.value)}
          placeholder={"1. to ...\n2. to ...\n3. ..."}
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
                  padding: "6px 10px",
                  background: "#0f1115",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 32,
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
                      meaning: d.text,
                      defIndex: d.index,
                      reading: job.reading,
                      difficulty: job.difficulty,
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
                    width: 64,
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
