import "../styles.css";
import { WordListPane } from "../ui/WordListPane";
import { WordSetupPane } from "../ui/WordSetupPane";
import { GenerationsPane } from "../ui/GenerationsPane";
import { SettingsModal } from "../ui/SettingsModal";
import { useAppLogic } from "../app/AppLogic";

export default function App() {
  const {
    settings,
    setSettings,
    settingsOpen,
    setSettingsOpen,
    ankiStatus,
    wordEntryState,
    sentenceGenState,
    ankiExportState,
    furiganaState,
    doSettingsNeedAttention,
  } = useAppLogic();
  const selectedWordEntry = wordEntryState.selectedWordEntry;

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">
          JP SRS Sentence Builder
        </div>
        <div className="muted">
          ① Add a word → ② Review meanings → ③ Generate sentences → ④ Export to Anki
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn secondary" onClick={() => setSettingsOpen(true)}>
            Settings{ doSettingsNeedAttention() ? " ⚠️" : "" }
          </button>
          <button className="btn" onClick={ankiExportState.onExport} disabled={ankiExportState.exportBusy}>
            {ankiExportState.exportBusy ? "Exporting…" : "Export"}
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="pane">
          <WordListPane
            wordEntryState={wordEntryState}
            settings={settings}
            furiganaState={furiganaState}
          />
        </section>

        <section className="pane">
          {selectedWordEntry ? (
            <WordSetupPane
              wordEntry={selectedWordEntry}
              settings={settings}
              sentenceGenState={sentenceGenState}
              wordEntryState={wordEntryState}
            />
          ) : (
            <div className="empty">No word selected.</div>
          )}
        </section>

        <section className="pane">
          {selectedWordEntry ? (
            <GenerationsPane
              wordEntry={selectedWordEntry}
              settings={settings}
              wordEntryState={wordEntryState}
              sentenceGenState={sentenceGenState}
              ankiExportState={ankiExportState}
              furiganaState={furiganaState}
            />
          ) : (
            <div className="empty">No word selected.</div>
          )}
        </section>
      </main>

      <footer className="footer" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div className="muted">Saved automatically to your browser</div>
        <div className="muted">
          {ankiStatus.kind == "checking" && "Connecting to Anki..."}
          {ankiStatus.kind == "online"   && "Anki connected"}
          {ankiStatus.kind == "outdated" && "⚠️ AnkiConnect update required"}
          {ankiStatus.kind == "offline"  && "⚠️ Anki not connected"}
        </div>
      </footer>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          furiganaStatus={furiganaState.status}
        />
      )}
    </div>
  );
}
