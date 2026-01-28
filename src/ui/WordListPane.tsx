import { useEffect, useMemo, useState } from "react";
import type { FuriganaState } from "../app/appTypes";
import type { AppSettings } from "../settings/settingsTypes";
import type { WordEntries, WordEntry } from "../wordEntry/wordEntryTypes";
import { buildKuroshiroCacheKey, ensureKuroshiroCacheEntry } from "../kuroshiro/kuroshiroService";

type DisplayMode = "natural" | "furigana" | "kana";

function WordEntryTitle(props: {
  wordEntry: WordEntry;
  displayMode: DisplayMode;
  furiganaAvailable: boolean;
  kanaMode: AppSettings["furiganaKanaMode"];
  updateWordEntry: (id: string, updater: (wordEntry: WordEntry) => WordEntry) => void;
}) {
  const { wordEntry, displayMode, furiganaAvailable, kanaMode, updateWordEntry } = props;
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
        updateWordEntry(wordEntry.id, (prev) => ({ ...prev, furiganaCache: nextCache }));
      } catch {
        // Ignore and fall back to plain text.
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [cache, displayMode, furiganaAvailable, wordEntry, kanaMode, updateWordEntry]);

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
  wordEntries: WordEntries;
  settings: AppSettings;
  furiganaState: FuriganaState;
}) {
  const { wordEntries, settings, furiganaState } = props;
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
        <div className="row">
          {settings.enableFurigana && furiganaStatus === "loading" ? (
            <span className="badge">Loading…</span>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span className="muted" style={{ fontSize: 14 }}>
                Display
              </span>
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
          </div>
          )}
        </div>
      </div>

      <div className="paneBody">
        <div className="list">
          <button className="btn secondary" onClick={wordEntries.create}>
            + New
          </button>
          {wordEntries.list.map((wordEntry) => {
            const selected = wordEntry.id === wordEntries.selectedId;
            const title = wordEntry.word.trim() ? wordEntry.word.trim() : "(untitled)";
            const jpdb = wordEntry.jpdb;

            return (
              <div
                key={wordEntry.id}
                className={"item" + (selected ? " selected" : "")}
                onClick={() => wordEntries.select(wordEntry.id)}
                role="button"
                tabIndex={0}
                style={{
                  display: "flex", 
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "start", gap: 0 }}>
                  <div style={{ fontWeight: 650 }}>
                    {title === "(untitled)" ? (
                      title
                    ) : (
                      <WordEntryTitle
                        wordEntry={wordEntry}
                        displayMode={displayMode}
                        furiganaAvailable={furiganaAvailable}
                        kanaMode={settings.furiganaKanaMode}
                        updateWordEntry={wordEntries.update}
                      />
                    )}
                  </div>
                  <div className="small">
                    {jpdb &&
                      <span>
                        top {jpdb.frequencyRank} · {jpdb.cardState}{jpdb.cardLevel != null && " · lvl " + jpdb.cardLevel}
                      </span>
                    }
                  </div>
                </div>
                <button
                  className="btn danger"
                  style={{ padding: "2px 6px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    wordEntries.remove(wordEntry.id);
                  }}
                  title="Delete word entry"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {wordEntries.list.length === 0 && <div className="muted">No word entries yet.</div>}
      </div>
    </div>
  );
}
