import { useEffect, useMemo, useState } from "react";
import type { AnkiFieldSource, AppSettings, Difficulty } from "../state/types";
import { DIFFICULTY_PROFILES } from "../state/difficulty";
import { ANKI_FIELD_OPTIONS } from "../lib/ankiFields";
import { fetchDeckNames, fetchModelFieldNames, fetchModelNames } from "../lib/ankiConnect";

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
        if (!cancelled) {
          setAnkiLoading(false);
        }
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
        if (!cancelled) {
          setAnkiFieldsLoading(false);
        }
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

  const missingDeck = settings.ankiDeckName && ankiDecks.length > 0 && !ankiDecks.includes(settings.ankiDeckName);
  const missingModel = settings.ankiModelName && ankiModels.length > 0 && !ankiModels.includes(settings.ankiModelName);
  const hasJpField = Object.values(currentFieldMapping).includes("sentenceJp");
  const hasEnField = Object.values(currentFieldMapping).includes("sentenceEn");

  function updateFieldMapping(fieldName: string, value: AnkiFieldSource) {
    if (!settings.ankiModelName) return;
    const nextModelMapping = {
      ...currentFieldMapping,
      [fieldName]: value,
    };
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
      }}
      onClick={onClose}
    >
      <div
        className="pane"
        style={{ width: 760, maxWidth: "100%", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="paneHeader">
          <div className="paneTitle">Settings</div>
          <button className="btn danger" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="paneBody" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="muted">LLM</div>

          <div className="row">
            <input
              className="input"
              placeholder="Model (e.g. gpt-4.1-mini)"
              value={settings.model}
              onChange={(e) => patch({ model: e.target.value })}
            />
          </div>

          <div className="row" style={{ gap: 10 }}>
            <input
              className="input"
              placeholder="API Key (optional)"
              value={settings.apiKey}
              onChange={(e) => patch({ apiKey: e.target.value })}
              type="password"
            />
          </div>

          <label className="row" style={{ gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.rememberApiKey}
              onChange={(e) => patch({ rememberApiKey: e.target.checked })}
            />
            <span className="muted">Remember API key in localStorage</span>
          </label>

          <div className="muted" style={{ marginTop: 6 }}>
            Defaults
          </div>

          <div className="row">
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
          </div>

          <div className="row">
            <input
              className="input"
              placeholder="Default count preset (e.g. 1/2/3)"
              value={settings.defaultCountPreset}
              onChange={(e) => patch({ defaultCountPreset: e.target.value })}
            />
          </div>

          <div className="muted" style={{ marginTop: 6 }}>
            Notes template (supports {"{word}"} and {"{meaning}"})
          </div>

          <div className="row">
            <input
              className="input"
              value={settings.notesTemplate}
              onChange={(e) => patch({ notesTemplate: e.target.value })}
            />
          </div>

          <div className="muted" style={{ marginTop: 6 }}>
            AnkiConnect (AC)
          </div>

          {ankiError && (
            <div style={{ border: "1px solid #3a1f1f", background: "#1a0f0f", padding: 10, borderRadius: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>AnkiConnect Error</div>
              <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{ankiError}</div>
            </div>
          )}

          <div className="row">
            <select
              className="select"
              value={settings.ankiDeckName}
              onChange={(e) => patch({ ankiDeckName: e.target.value })}
            >
              <option value="">(Select deck)</option>
              {deckOptions.map((deck) => (
                <option key={deck} value={deck}>
                  {deck}
                </option>
              ))}
            </select>
          </div>
          {missingDeck && (
            <div className="muted" style={{ color: "#f2a2a2" }}>
              Selected deck isn’t available in Anki. Re-select a deck or fix it in Anki.
            </div>
          )}

          <div className="row">
            <select
              className="select"
              value={settings.ankiModelName}
              onChange={(e) => patch({ ankiModelName: e.target.value })}
            >
              <option value="">(Select note type)</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
          {missingModel && (
            <div className="muted" style={{ color: "#f2a2a2" }}>
              Selected note type isn’t available in Anki. Re-select a note type or fix it in Anki.
            </div>
          )}

          {ankiFieldsError && (
            <div className="muted" style={{ color: "#f2a2a2" }}>
              Failed to load fields for this note type: {ankiFieldsError}
            </div>
          )}

          {settings.ankiModelName && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="muted">
                Field mapping {ankiFieldsLoading ? "· loading…" : ""}
              </div>
              {ankiFields.length === 0 && !ankiFieldsLoading ? (
                <div className="muted">No fields loaded yet.</div>
              ) : (
                ankiFields.map((field) => (
                  <div key={field} className="row">
                    <div style={{ width: 180 }}>{field}</div>
                    <select
                      className="select"
                      value={currentFieldMapping[field] ?? ""}
                      onChange={(e) => updateFieldMapping(field, e.target.value as AnkiFieldSource)}
                    >
                      {ANKI_FIELD_OPTIONS.map((option) => (
                        <option key={`${field}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
              {!hasJpField || !hasEnField ? (
                <div className="muted" style={{ color: "#f2d48a" }}>
                  Warning: JP and EN sentences should usually be mapped to avoid blank cards.
                </div>
              ) : null}
            </div>
          )}

          <div className="row">
            <input
              className="input"
              placeholder="Tags (space-delimited, optional)"
              value={settings.ankiTags}
              onChange={(e) => patch({ ankiTags: e.target.value })}
            />
          </div>
          <label className="row" style={{ gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.ankiIncludeDifficultyTag}
              onChange={(e) => patch({ ankiIncludeDifficultyTag: e.target.checked })}
            />
            <span className="muted">Include difficulty-* tags automatically</span>
          </label>

          {ankiLoading && (
            <div className="muted">Loading decks and note types from AnkiConnect…</div>
          )}

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn secondary" onClick={onClose}>
              Close
            </button>
          </div>

          {!settings.rememberApiKey && settings.apiKey.length > 0 && (
            <div className="muted">
              API key will NOT be saved; it will clear on refresh unless you enable “Remember”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
