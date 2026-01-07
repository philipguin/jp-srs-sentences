import type { AppSettings, Difficulty } from "../state/types";
import { DIFFICULTY_PROFILES } from "../state/difficulty";

export function SettingsModal(props: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  onClose: () => void;
}) {
  const { settings, onChange, onClose } = props;

  function patch(p: Partial<AppSettings>) {
    onChange({ ...settings, ...p });
  }

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
