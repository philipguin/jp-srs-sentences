import { useEffect, useMemo, useState } from "react";
import type { AnkiFieldSource, AppSettings, Difficulty } from "../state/types";
import { DIFFICULTY_PROFILES } from "../state/difficulty";
import { ANKI_FIELD_OPTIONS } from "../lib/ankiFields";
import { fetchDeckNames, fetchModelFieldNames, fetchModelNames } from "../lib/ankiConnect";

function SectionTitle(props: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 6,
      }}
    >
      <div style={{ fontWeight: 650, opacity: 0.92 }}>{props.children}</div>
      {props.right}
    </div>
  );
}

function Field(props: {
  label: string;
  help?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 13, opacity: 0.92, fontWeight: 600 }}>{props.label}</div>
        {props.required ? (
          <span className="badge" style={{ opacity: 0.85 }}>
            required
          </span>
        ) : null}
      </div>
      {props.help ? <div className="small">{props.help}</div> : null}
      {props.children}
    </div>
  );
}

function Callout(props: {
  tone?: "danger" | "warn" | "info";
  title?: string;
  children: React.ReactNode;
}) {
  const tone = props.tone ?? "info";
  const styles =
    tone === "danger"
      ? { border: "1px solid #3a1f1f", background: "#1a0f0f" }
      : tone === "warn"
        ? { border: "1px solid #3a3320", background: "#14120a" }
        : { border: "1px solid #242834", background: "#0f1115" };

  return (
    <div style={{ ...styles, padding: 10, borderRadius: 10 }}>
      {props.title ? <div style={{ fontWeight: 700, marginBottom: 6 }}>{props.title}</div> : null}
      <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
        {props.children}
      </div>
    </div>
  );
}

export function SettingsModal(props: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  onClose: () => void;
}) {
  const { settings, onChange, onClose } = props;
  const [ankiDecks, setAnkiDecks] = useState<string[]>([]);
  const [ankiModels, setAnkiModels] = useState<string[]>([]);
  const [ankiFields, setAnkiFields] = useState<string[]>([]);
  const [ankiError, setAnkiError] = useState<string | null>(null);
  const [ankiFieldsError, setAnkiFieldsError] = useState<string | null>(null);
  const [ankiLoading, setAnkiLoading] = useState(false);
  const [ankiFieldsLoading, setAnkiFieldsLoading] = useState(false);

  function patch(p: Partial<AppSettings>) {
    onChange({ ...settings, ...p });
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setAnkiLoading(true);
      setAnkiError(null);
      try {
        const [decks, models] = await Promise.all([fetchDeckNames(), fetchModelNames()]);
        if (cancelled) return;
        setAnkiDecks(decks);
        setAnkiModels(models);
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setAnkiError(message);
      } finally {
        if (!cancelled) setAnkiLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadFields() {
      if (!settings.ankiModelName) {
        setAnkiFields([]);
        setAnkiFieldsError(null);
        return;
      }
      setAnkiFieldsLoading(true);
      setAnkiFieldsError(null);
      try {
        const fields = await fetchModelFieldNames(settings.ankiModelName);
        if (cancelled) return;
        setAnkiFields(fields);
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setAnkiFieldsError(message);
        setAnkiFields([]);
      } finally {
        if (!cancelled) setAnkiFieldsLoading(false);
      }
    }
    loadFields();
    return () => {
      cancelled = true;
    };
  }, [settings.ankiModelName]);

  const currentFieldMapping = useMemo(() => {
    if (!settings.ankiModelName) return {};
    return settings.ankiFieldMappings[settings.ankiModelName] ?? {};
  }, [settings.ankiFieldMappings, settings.ankiModelName]);

  function updateFieldMapping(fieldName: string, value: AnkiFieldSource) {
    if (!settings.ankiModelName) return;
    const nextModelMapping = { ...currentFieldMapping, [fieldName]: value };
    patch({
      ankiFieldMappings: {
        ...settings.ankiFieldMappings,
        [settings.ankiModelName]: nextModelMapping,
      },
    });
  }

  function ensureOption(list: string[], current: string): string[] {
    if (!current || list.includes(current)) return list;
    return [current, ...list];
  }

  const deckOptions = ensureOption(ankiDecks, settings.ankiDeckName);
  const modelOptions = ensureOption(ankiModels, settings.ankiModelName);

  const missingDeck = settings.ankiDeckName && ankiDecks.length > 0 && !ankiDecks.includes(settings.ankiDeckName);
  const missingModel = settings.ankiModelName && ankiModels.length > 0 && !ankiModels.includes(settings.ankiModelName);
  const hasJpField = Object.values(currentFieldMapping).includes("sentenceJp");
  const hasEnField = Object.values(currentFieldMapping).includes("sentenceEn");

  const ankiConfigured = !!settings.ankiDeckName || !!settings.ankiModelName;
  const ankiHasProblem = !!ankiError || !!ankiFieldsError || missingDeck || missingModel;
  const ankiDefaultOpen = ankiConfigured || ankiHasProblem;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflow: "hidden",
      }}
      onClick={onClose}
    >
      <div
        className="pane"
        style={{
          width: 760,
          maxWidth: "100%",
          maxHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="paneHeader" style={{ flex: "0 0 auto" }}>
          <div className="paneTitle">Settings</div>
          <button className="btn danger" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <div
          className="paneBody"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            flex: "1 1 auto",
            overflowY: "auto",
            minHeight: 0,
            paddingRight: 4,
          }}
        >
          <SectionTitle>LLM</SectionTitle>

          <Field
            label="Model"
            required
            help="OpenAI model ID your app will call."
          >
            <input
              className="input"
              value={settings.model}
              onChange={(e) => patch({ model: e.target.value })}
              placeholder="gpt-5-mini, gpt-5.2, etc."
            />
          </Field>

          <Field
            label="API key"
            help="Optional if you proxy requests; required if the browser calls the API directly."
          >
            <input
              className="input"
              value={settings.apiKey}
              onChange={(e) => patch({ apiKey: e.target.value })}
              type="password"
              placeholder="sk-…"
              autoComplete="off"
            />
          </Field>

          <label className="row" style={{ gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={settings.rememberApiKey}
              onChange={(e) => patch({ rememberApiKey: e.target.checked })}
              style={{ marginTop: 2 }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.92 }}>Remember API key</div>
              <div className="small">Stores the key in localStorage on this device.</div>
            </div>
          </label>

          {!settings.rememberApiKey && settings.apiKey.length > 0 ? (
            <Callout tone="warn" title="Heads up">
              API key will not be saved; it will clear on refresh unless you enable “Remember”.
            </Callout>
          ) : null}

          <SectionTitle>Defaults</SectionTitle>

          <Field label="Default difficulty" help="Used when creating new cards / prompts.">
            <select
              className="select"
              value={settings.defaultDifficulty}
              onChange={(e) => patch({ defaultDifficulty: e.target.value as Difficulty })}
            >
              {Object.keys(DIFFICULTY_PROFILES).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Default sentence counts" help="Your preset string (e.g. 1/2/3).">
            <input
              className="input"
              value={settings.defaultCountPreset}
              onChange={(e) => patch({ defaultCountPreset: e.target.value })}
              placeholder="1/2/3"
            />
          </Field>

          {/* AnkiConnect collapsible */}
          <details open={ankiDefaultOpen} style={{ marginTop: 4 }}>
            <summary
              style={{
                cursor: "pointer",
                listStyle: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 10px",
                border: "1px solid #242834",
                borderRadius: 12,
                background: "#0f1115",
                userSelect: "none",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontWeight: 650, opacity: 0.92 }}>AnkiConnect</div>
                <div className="small">
                  Deck + note type + field mapping for exports.
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {ankiLoading ? <span className="badge">loading…</span> : null}
                {ankiHasProblem ? <span className="badge" style={{ borderColor: "#3a1f1f" }}>needs attention</span> : null}
                {ankiConfigured && !ankiHasProblem ? <span className="badge">configured</span> : null}
              </div>
            </summary>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12 }}>
              {ankiError ? (
                <Callout tone="danger" title="AnkiConnect Error">
                  {ankiError}
                </Callout>
              ) : null}

              <Field label="Deck" required help="Where new notes will be added.">
                <select
                  className="select"
                  value={settings.ankiDeckName}
                  onChange={(e) => patch({ ankiDeckName: e.target.value })}
                >
                  <option value="">Select a deck…</option>
                  {deckOptions.map((deck) => (
                    <option key={deck} value={deck}>
                      {deck}
                    </option>
                  ))}
                </select>
                {missingDeck ? (
                  <div className="small" style={{ color: "#f2a2a2", marginTop: 6 }}>
                    Selected deck isn’t available in Anki. Re-select a deck or fix it in Anki.
                  </div>
                ) : null}
              </Field>

              <Field label="Note type" required help="Anki note type used for the exported notes.">
                <select
                  className="select"
                  value={settings.ankiModelName}
                  onChange={(e) => patch({ ankiModelName: e.target.value })}
                >
                  <option value="">Select a note type…</option>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                {missingModel ? (
                  <div className="small" style={{ color: "#f2a2a2", marginTop: 6 }}>
                    Selected note type isn’t available in Anki. Re-select a note type or fix it in Anki.
                  </div>
                ) : null}
              </Field>

              {ankiFieldsError ? (
                <Callout tone="danger" title="Failed to load fields">
                  {ankiFieldsError}
                </Callout>
              ) : null}

              {settings.ankiModelName ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <SectionTitle
                    right={
                      <span className="small" style={{ opacity: 0.75 }}>
                        {ankiFieldsLoading ? "Loading fields…" : ankiFields.length ? `${ankiFields.length} fields` : ""}
                      </span>
                    }
                  >
                    Field mapping
                  </SectionTitle>

                  <div className="small">
                    Map Anki fields (left) to your app’s data (right).
                  </div>

                  {ankiFields.length === 0 && !ankiFieldsLoading ? (
                    <div className="muted">No fields loaded yet.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {/* header row */}
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          padding: "6px 8px",
                          border: "1px solid #242834",
                          borderRadius: 10,
                          background: "#121521",
                        }}
                      >
                        <div className="small" style={{ width: 180, fontWeight: 700, opacity: 0.85 }}>
                          Anki field
                        </div>
                        <div className="small" style={{ flex: 1, fontWeight: 700, opacity: 0.85 }}>
                          Maps to
                        </div>
                      </div>

                      <div style={{
                          border: "1px solid #242834",
                          borderRadius: 10,
                          background: "#0f111c",
                      }}>
                        {ankiFields.map((field) => (
                          <div
                            key={field}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "4px 8px",
                            }}
                          >
                            <div style={{ width: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {field}
                            </div>
                            <select
                              className="select"
                              value={currentFieldMapping[field] ?? ""}
                              onChange={(e) => updateFieldMapping(field, e.target.value as AnkiFieldSource)}
                              style={{
                                padding: "4px 0px 4px 0px",
                                color: currentFieldMapping[field] ? "" : "#777"
                              }}
                            >
                              {ANKI_FIELD_OPTIONS.map((option) => (
                                <option key={`${field}-${option.value}`} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!hasJpField || !hasEnField ? (
                    <Callout tone="warn" title="Recommended mapping">
                      Map both JP and EN sentence sources to avoid blank cards.
                    </Callout>
                  ) : null}
                </div>
              ) : null}

              <SectionTitle>Export formatting</SectionTitle>

              <Field
                label="Notes template"
                help='Supported macros: {word}, {reading}, {difficulty}, {meaning}, {meaningNumber}, {sentenceJp}, {sentenceEn}'
              >
                <input
                  className="input"
                  value={settings.notesTemplate}
                  onChange={(e) => patch({ notesTemplate: e.target.value })}
                  placeholder="{word} here means “{meaning}”."
                />
              </Field>

              <Field label="Tags" help="Space-delimited. Will be added to exported notes.">
                <input
                  className="input"
                  value={settings.ankiTags}
                  onChange={(e) => patch({ ankiTags: e.target.value })}
                  placeholder="japanese jpdb_sup"
                />
              </Field>

              <label className="row" style={{ gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={settings.ankiIncludeDifficultyTag}
                  onChange={(e) => patch({ ankiIncludeDifficultyTag: e.target.checked })}
                  style={{ marginTop: 2 }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.92 }}>Include difficulty tags</div>
                  <div className="small">Adds tags like "difficulty-beginner" to exports.</div>
                </div>
              </label>
            </div>
          </details>

          <div className="row" style={{ justifyContent: "flex-end", marginTop: 4 }}>
            <button className="btn secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
