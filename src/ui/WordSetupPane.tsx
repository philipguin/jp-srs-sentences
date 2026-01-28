import { useState } from "react";
import type { AppSettings } from "../settings/settingsTypes";
import type { SentenceGenState, Difficulty, DifficultyProfile } from "../sentenceGen/sentenceGenTypes";
import type { WordEntries, DefinitionStudyPriority, DefinitionValidity, WordEntry } from "../wordEntry/wordEntryTypes";
import { DIFFICULTY_PROFILES } from "../sentenceGen/sentenceGenDifficulty";
import { applyCountPreset, mergeCounts, parseDefinitions } from "../wordEntry/wordEntryDefinitions";
import { applyTemplate } from "../shared/template";
import { jpdbParse, jpdbAddVocabulary } from "../jpdb/jpdbApi";

export function WordSetupPane(props: {
  wordEntry: WordEntry;
  settings: AppSettings;
  sentenceGenState: SentenceGenState;
  wordEntries: WordEntries;
}) {
  const { wordEntry, settings, sentenceGenState, wordEntries } = props;
  const {
    difficulty: sentenceGenDifficulty,
    generationBusy,
    analysisBusy: analyzeBusy,
    generate,
    analyze,
    setDifficulty,
  } = sentenceGenState;

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

  function setDefCount(defIndex: number, count: number) {
    wordEntries.update(wordEntry.id, (prev) => ({
      ...prev,
      definitions: prev.definitions.map((d) =>
        d.index === defIndex ? { ...d, count } : d
      ),
    }));
  }

  function startEditingDefinitions() {
    wordEntries.update(wordEntry.id, (prev) => ({ ...prev, definitionsEditing: true }));
  }
  //function cancelEditingDefinitions() {
  //  wordEntries.update(wordEntry.id, (prev) => ({ ...prev, definitionsEditing: false }));
  //}
  function finishEditingDefinitions() {

    const parsed = parseDefinitions(wordEntry.definitionsRaw);
    const withPreset = applyCountPreset(parsed, settings.defaultCountPreset);

    wordEntries.update(wordEntry.id, (prev) => ({
      ...prev,
      definitionsEditing: false,
      definitions: mergeCounts(withPreset, prev.definitions),
      generations: [],
      status: "draft",
    }));
  }

  async function populateFromJpdb() {
    const keyword = wordEntry.word.trim();
    if (!keyword) return;
    if (!settings.jpdbApiKey) {
      console.error("Missing JPDB API key (Settings → jpdb.io).");
      return;
    }
    setDefinitionsLoading(true);
    try {
      // Note: "lookup-vocabulary" endpoint expects an sid and vid,
      // which we don't have yet. So we "parse" instead.
      
      const { vocabulary } = await jpdbParse(
        settings.jpdbApiKey, keyword, [],
        ["vid", "sid", "reading", "frequency_rank", "meanings", "card_level", "card_state"],
      );
      const item = vocabulary[0]
      if (!item) throw new Error("Parse returned nothing");

      const meanings = item["meanings"] as string[] ?? [];
      const lines = meanings.map((meaning: string, index: number) => `${index + 1}. ${meaning}`);
      const newDefsRaw = lines.join("\n");

      wordEntries.update(wordEntry.id, (prev) => ({
        ...prev,
        reading: item["reading"] as string,
        definitionsRaw: newDefsRaw,
        jpdb: {
          vid: item["vid"] as number,
          sid: item["sid"] as number,
          frequencyRank: item["frequency_rank"] as number,
          cardLevel: item["card_level"] as number,
          cardState: item["card_state"] as string,
        },
      }));
    } catch (error) {
      console.error("Failed to load definitions from JPDB.", error);
    } finally {
      setDefinitionsLoading(false);
    }
  }

  async function addToJpdbDeck() {
    const wordJpdb = wordEntry.jpdb;
    if (!wordJpdb) return;
    if (!settings.jpdbApiKey) {
      console.error("Missing JPDB API key (Settings → jpdb.io).");
      return;
    }
    if (!settings.jpdbDeckId) {
      console.error("Missing JPDB Deck (Settings → jpdb.io).");
      return;
    }
    setDefinitionsLoading(true);
    try {
      await jpdbAddVocabulary(settings.jpdbApiKey, settings.jpdbDeckId, [[wordJpdb.vid, wordJpdb.sid]])
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
        <input
          className="input"
          placeholder="Word (dictionary form)"
          value={wordEntry.word}
          onChange={(e) => wordEntries.update(wordEntry.id, (prev) => ({ ...prev, word: e.target.value }))}
        />
        <input
          className="input"
          placeholder="Reading (optional)"
          value={wordEntry.reading ?? ""}
          onChange={(e) => wordEntries.update(wordEntry.id, (prev) => ({ ...prev, reading: e.target.value }))}
        />

        <div className="row" style={{ justifyContent: "end" }}>
          <button
            className="btn secondary"
            onClick={addToJpdbDeck}
            disabled={!settings.jpdbApiKey || !wordEntry.jpdb || definitionsLoading}
          >
            <span title="Adds to jpdb.io deck (must be configured in settings)">
              {definitionsLoading ? <span className="spinner" /> : null}
              {definitionsLoading ? "Adding…" : "Add to jpdb"}
            </span>
          </button>
        </div>

        {wordEntry.definitionsEditing ? (
          <div>
            <div className="muted">Definitions (paste numbered lines like “1. …” “2. …”)</div>
            <textarea
              className="textarea"
              value={wordEntry.definitionsRaw}
              onChange={(e) => wordEntries.update(wordEntry.id, (prev) => ({ ...prev, definitionsRaw: e.target.value }))}
              placeholder={"1. to ...\n2. to ...\n3. ..."}
              style={{ width: "100%", minHeight: 42, height: 100, resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
              <button
                className="btn secondary"
                onClick={populateFromJpdb}
                disabled={!settings.jpdbApiKey || definitionsLoading || wordEntry.word.trim().length === 0}
              >
                <span title="Retrieves definitions from jpdb.io (must be configured in settings)">
                  {definitionsLoading ? <span className="spinner" /> : null}
                  {definitionsLoading ? "Fetching…" : "Fetch from jpdb"}
                </span>
              </button>
              <button
                className="btn secondary"
                onClick={finishEditingDefinitions}
                disabled={analyzeBusy || generationBusy || !wordEntry?.definitionsRaw}
              >
                <span title="Finalizes the definitions before analysis and sentence generation">
                  Parse
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="muted">Parsed definitions</div>
            </div>
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
                        difficulty: sentenceGenDifficulty,
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
              <button
                className="btn secondary"
                onClick={startEditingDefinitions}
                disabled={analyzeBusy || generationBusy || !wordEntry.word || wordEntry.definitions.length === 0}
              >
                Edit
              </button>
              <button
                className="btn secondary"
                onClick={analyze}
                disabled={analyzeBusy || generationBusy || !wordEntry.word || wordEntry.definitions.length === 0}
                title="Analyzes definitions for study recommendations using the configured LLM."
              >
                {analyzeBusy && "Analyzing…"}
                {!analyzeBusy && !wordEntry.definitions?.[0]?.studyPriority && "Analyze"}
                {!analyzeBusy && wordEntry.definitions?.[0]?.studyPriority && "Reanalyze"}
              </button>
            </div>
          </div>
        )}

        <div className="muted">Sentence Generation</div>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, paddingTop: 0 }}>
          <label className="muted">Style</label>
          <select
            className="select"
            value={sentenceGenDifficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
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
            onClick={generate}
            disabled={generationBusy || analyzeBusy || !wordEntry.word}
            title="Generates sentences for the above definitions and adds them to the right. Uses the LLM configured in Settings."
          >
            {generationBusy ? "Generating…" : "Generate"}
          </button>
        </div>

        <div className="muted" style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start" }}>
          {wordEntry.jpdb ? "jpdb associated · VID: " + wordEntry.jpdb.vid + ", SID: " + wordEntry.jpdb.sid : "jpdb unassociated"}
        </div>
      </div>
    </div>
  );
}
