import { useEffect, useMemo, useState } from "react";
import type { AppSettings } from "../settings/settingsTypes";
import type { WordEntry } from "../wordEntry/wordEntryTypes";
import type { FuriganaState, WordEntryState } from "../app/AppLogic";
import { buildKuroshiroCacheKey, ensureKuroshiroCacheEntry } from "../kuroshiro/kuroshiroService";

type DisplayMode = "natural" | "furigana" | "kana";

function WordEntryTitle(props: {
  wordEntry: WordEntry;
  displayMode: DisplayMode;
  furiganaAvailable: boolean;
  kanaMode: AppSettings["furiganaKanaMode"];
  onUpdateWordEntry: (wordEntry: WordEntry) => void;
}) {
  const { wordEntry, displayMode, furiganaAvailable, kanaMode, onUpdateWordEntry } = props;
  const cacheKey = useMemo(() => buildKuroshiroCacheKey(wordEntry.word, kanaMode), [wordEntry.word, kanaMode]);
  const cache = wordEntry.furiganaCache?.key === cacheKey ? wordEntry.furiganaCache : undefined;

  useEffect(() => {
    if (!furiganaAvailable) return;
    if (!wordEntry.word.trim()) return;
    if (displayMode === "natural") return;
    const field = displayMode === "kana" ? "kana" : "rubyHtml";
    if (cache?.[field]) return;
    let cancelled = false;

    async function load() {
      try {
        const nextCache = await ensureKuroshiroCacheEntry(wordEntry.word, kanaMode, cache, field);
        if (cancelled) return;
        if (nextCache.key === cache?.key && nextCache[field] === cache?.[field]) return;
        onUpdateWordEntry({ ...wordEntry, furiganaCache: nextCache });
      } catch {
        // Ignore and fall back to plain text.
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [cache, displayMode, furiganaAvailable, wordEntry, kanaMode, onUpdateWordEntry]);

  if (displayMode === "kana") {
    if (furiganaAvailable && cache?.kana) {
      return <span>{cache.kana}</span>;
    }
    return <span>{wordEntry.reading || wordEntry.word}</span>;
  }

  if (displayMode === "furigana" && furiganaAvailable && cache?.rubyHtml) {
    return <span dangerouslySetInnerHTML={{ __html: cache.rubyHtml }} />;
  }

  return <span>{wordEntry.word}</span>;
}

export function WordListPane(props: {
  wordEntryState: WordEntryState;
  settings: AppSettings;
  furiganaState: FuriganaState;
}) {
  const { wordEntryState, settings, furiganaState } = props;
  const {
    wordEntries,
    selectedWordEntryId,
    onSelect,
    onNewWordEntry,
    onDeleteWordEntry,
    onUpdateWordEntry,
  } = wordEntryState;
  const { available: furiganaAvailable, status: furiganaStatus } = furiganaState;
  const [displayMode, setDisplayMode] = useState<DisplayMode>("natural");

  useEffect(() => {
    if (!furiganaAvailable && displayMode === "furigana") {
      setDisplayMode("natural");
    }
  }, [displayMode, furiganaAvailable]);

  return (
    <div className="paneInner">
      <div className="paneHeader">
        <div className="paneTitle">Word List</div>
        <div className="row" style={{ gap: 8 }}>
          {settings.enableFurigana && furiganaStatus === "loading" ? (
            <span className="badge">Loading…</span>
          ) : null}
          <select
            className="select"
            value={displayMode}
            onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
            style={{ padding: "4px 8px" }}
          >
            <option value="natural">Naturally</option>
            {furiganaAvailable ? <option value="furigana">With furigana</option> : null}
            <option value="kana">As kana</option>
          </select>
          <button className="btn secondary" onClick={onNewWordEntry} style={{ flexShrink: 0, padding: "2px 8px" }}>
            + New
          </button>
        </div>
      </div>

      <div className="paneBody">
        <div className="list">
          {wordEntries.map((wordEntry) => {
            const selected = wordEntry.id === selectedWordEntryId;
            const title = wordEntry.word.trim() ? wordEntry.word.trim() : "(untitled)";
            const defs = wordEntry.definitions.length;
            const res = wordEntry.sentences.length;

            return (
              <div
                key={wordEntry.id}
                className={"item" + (selected ? " selected" : "")}
                onClick={() => onSelect(wordEntry.id)}
                role="button"
                tabIndex={0}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontWeight: 650 }}>
                    {title === "(untitled)" ? (
                      title
                    ) : (
                      <WordEntryTitle
                        wordEntry={wordEntry}
                        displayMode={displayMode}
                        furiganaAvailable={furiganaAvailable}
                        kanaMode={settings.furiganaKanaMode}
                        onUpdateWordEntry={onUpdateWordEntry}
                      />
                    )}
                  </div>
                  <div className="small">
                    defs: {defs} · sentences: {res} · {wordEntry.status}
                  </div>
                </div>

                <button
                  className="btn danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteWordEntry(wordEntry.id);
                  }}
                  title="Delete word entry"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {wordEntries.length === 0 && <div className="muted">No word entries yet.</div>}
      </div>
    </div>
  );
}
