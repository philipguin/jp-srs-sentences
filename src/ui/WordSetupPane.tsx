import { useState } from "react";
import type { AppSettings } from "../settings/settingsTypes";
import type { Difficulty, DifficultyProfile } from "../sentenceGen/sentenceGenTypes";
import type { DefinitionSpec, DefinitionStudyPriority, DefinitionValidity, WordEntry } from "../wordEntry/wordEntryTypes";
import { DIFFICULTY_PROFILES } from "../sentenceGen/sentenceGenDifficulty";
import { touch } from "../wordEntry/wordEntryStore";
import { applyCountPreset, mergeCounts, parseDefinitions } from "../wordEntry/wordEntryDefinitions";
import { applyTemplate } from "../shared/template";

export function WordSetupPane(props: {
  wordEntry: WordEntry;
  settings: AppSettings;
  generateBusy: boolean;
  analyzeBusy: boolean;
  onGenerate: () => void;
  onAnalyze: () => void;
  onUpdateWordEntry: (wordEntry: WordEntry) => void;
}) {
  const { wordEntry, settings, generateBusy, analyzeBusy, onGenerate, onAnalyze, onUpdateWordEntry } = props;
  const [definitionsLoading, setDefinitionsLoading] = useState(false);

  const validityColors: Record<DefinitionValidity, string> = { //"#aa00cc";//"#f85149";
    valid: "",
    dubious: "#c084fc",
    not_a_sense: "#f87171",
  };
  const studyPriorityColors: Record<DefinitionStudyPriority, string> = {
    recall: "#55d383",//"#4ade80",//"#3fb950",
    recognize: "#79b5ff",//"#e3b341",
    ignore_for_now: "#c5b975",//"#9ca3af",//"#866",
  };

  function setDefinitionsRaw(raw: string) {
    const parsed = parseDefinitions(raw);
    const withPreset = applyCountPreset(parsed, settings.defaultCountPreset);
    const merged = mergeCounts(withPreset, wordEntry.definitions);

    onUpdateWordEntry(
      touch({
        ...wordEntry,
        definitionsRaw: raw,
        definitions: merged,
        generations: [],
        status: "draft",
      })
    );
  }

  function setDefCount(defIndex: number, count: number) {
    const next: DefinitionSpec[] = wordEntry.definitions.map((d) =>
      d.index === defIndex ? { ...d, count } : d
    );
    onUpdateWordEntry(touch({ ...wordEntry, definitions: next }));
  }

  async function populateFromJpdb() {
    const keyword = wordEntry.word.trim();
    if (!keyword) return;
    if (!settings.jpdbApiKey) {
      console.error("Missing JPDB API key (Settings → Dictionary).");
      return;
    }

    setDefinitionsLoading(true);
    try {
      // Note: "lookup-vocabulary" endpoint expects an sid and vid,
      // which we don't have yet. So we "parse" instead.
      const response = await fetch("https://jpdb.io/api/v1/parse", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.jpdbApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: keyword,
          token_fields: [],
          vocabulary_fields: ["meanings"],
          position_length_encoding: "utf16"
        }),
      });

      if (!response.ok) {
        throw new Error(`JPDB request failed (${response.status})`);
      }

      const payload = (await response.json()) as {
        tokens?: number[];
        vocabulary: [string[]][];
      };
      const meanings = payload.vocabulary?.[0]?.[0] ?? [];
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
            value={wordEntry.word}
            onChange={(e) => onUpdateWordEntry(touch({ ...wordEntry, word: e.target.value }))}
          />
        </div>

        <div className="row">
          <input
            className="input"
            placeholder="Reading (optional)"
            value={wordEntry.reading ?? ""}
            onChange={(e) => onUpdateWordEntry(touch({ ...wordEntry, reading: e.target.value }))}
          />
        </div>

        <div className="row" style={{ justifyContent: "space-between", alignItems: "end" }}>
          <div className="muted">Definitions (paste numbered lines like “1. …” “2. …”)</div>
          <button
            className="btn secondary"
            type="button"
            onClick={populateFromJpdb}
            disabled={!settings.jpdbApiKey || definitionsLoading || wordEntry.word.trim().length === 0}
            style={{ padding: 0 }}
          >
            <span
              title="Retrieves definitions from jpdb.io (must be configured in settings)"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, padding: "4px 8px" }}
            >
              {definitionsLoading ? <span className="spinner" /> : null}
              {definitionsLoading ? "Fetching…" : "Fetch from jpdb.io"}
            </span>
          </button>
        </div>
        <textarea
          className="textarea"
          value={wordEntry.definitionsRaw}
          onChange={(e) => setDefinitionsRaw(e.target.value)}
          placeholder={"1. to ...\n2. to ...\n3. ..."}
          style={{ minHeight: 42, height: 100, resize: "vertical" }}
        />

        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="muted">Parsed definitions</div>
          <div className="small">Count preset: {settings.defaultCountPreset}</div>
        </div>

        {wordEntry.definitions.length === 0 ? (
          <div className="muted">Paste definitions above to populate this list.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {wordEntry.definitions.map((d) => (
              <div
                key={d.index}
                style={{
                  border: "1px solid #242834",
                  borderRadius: 10,
                  padding: 6,
                  background: "#0f1115",
                  display: "flex",
                  alignItems: "start",
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

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={
                      d.text +
                      "\n" +
                      applyTemplate(settings.notesTemplate, {
                        word: wordEntry.word,
                        reading: wordEntry.reading,
                        difficulty: wordEntry.sentenceGenDifficulty,
                        defIndex: d.index,
                        meaning: d.text,
                      })
                    }
                  >
                    {d.text}
                  </div>
                  {(d.validity && d.validity != "valid" || d.studyPriority || d.comment || (d.colocations?.length ?? 0) > 0) ? (
                    <div style={{ display: "flex", gap: "2px 8px", flexWrap: "wrap", fontSize: 12, marginTop: 2 }}>
                      {d.validity && d.validity != "valid" ? (
                        <span style={{
                          color: validityColors[d.validity as DefinitionValidity],
                          fontWeight: 600
                        }}>
                          {d.validity.replaceAll('_', ' ')}
                        </span>
                      ) : d.studyPriority ? (
                        <span style={{
                          color: studyPriorityColors[d.studyPriority as DefinitionStudyPriority],
                          fontWeight: 600
                        }}>
                          {d.studyPriority.replaceAll('_', ' ')}
                        </span>
                      ) : null}
                      {d.comment ? <span style={{ opacity: 0.7 }}>{d.comment}</span> : null}
                      {(d.colocations?.length ?? 0) > 0 ? (
                        <span style={{ opacity: 0.7 }}>
                          Colocations: {d.colocations?.join(", ")}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1}
                  value={d.count}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setDefCount(d.index, Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
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

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
          <button
            className="btn secondary"
            onClick={onAnalyze}
            disabled={analyzeBusy || generateBusy || !wordEntry.word || wordEntry.definitions.length === 0}
            title="Analyzes definitions for study recommendations using the configured LLM."
          >
            {analyzeBusy && "Analyzing…"}
            {!analyzeBusy && !wordEntry.definitions?.[0]?.studyPriority && "Analyze"}
            {!analyzeBusy && wordEntry.definitions?.[0]?.studyPriority && "Reanalyze"}
          </button>
        </div>

        <div className="muted">Sentence Generation</div>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, paddingTop: 0 }}>
          <label className="muted">Style</label>
          <select
            className="select"
            value={wordEntry.sentenceGenDifficulty}
            onChange={(e) =>
              onUpdateWordEntry(touch({ ...wordEntry, sentenceGenDifficulty: e.target.value as Difficulty }))
            }
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
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 0 }}>
          <button
            className="btn"
            onClick={onGenerate}
            disabled={generateBusy || analyzeBusy || !wordEntry.word}
            title="Generates sentences for the above definitions and adds them to the right. Uses the LLM configured in Settings."
          >
            {generateBusy ? "Generating…" : "Generate"}
          </button>
        </div>

      </div>
    </div>
  );
}
