import { useCallback, useState } from "react";
import type { AppSettings } from "../settings/settingsTypes";
import type { Difficulty } from "../sentenceGen/sentenceGenTypes";
import type { WordEntry, WordEntries } from "../wordEntry/wordEntryTypes";
import type { AnkiExportState } from "./ankiTypes";
import { useAnkiConnectStatus, fetchModelFieldNames, addNotes } from "./ankiConnect";
import { buildAnkiFieldPayload, buildAnkiTags } from "./ankiExport";

export function useAnkiStatus() {
  return useAnkiConnectStatus({
    enabled: true,
    onlineIntervalMs: 5000,
    offlineIntervalMs: 3000,
  });
}

export function useAnkiExport(args: {
  wordEntries: WordEntries;
  settings: AppSettings;
  difficulty: Difficulty;
  furiganaAvailable: boolean;
  messages: {
    setGenerationErr: (s: string | null) => void;
    setGenerationNotice: (s: string | null) => void;
  };
}): AnkiExportState {

  const { wordEntries, settings, difficulty, furiganaAvailable, messages } = args;
  const [exportBusy, setExportBusy] = useState(false);

  const onExport = useCallback(async () => {
    messages.setGenerationErr(null);
    messages.setGenerationNotice(null);

    if (!settings.ankiDeckName || !settings.ankiModelName) {
      messages.setGenerationErr("Missing deck or note type (Settings → AnkiConnect).");
      return;
    }

    const exportTargets = wordEntries.list.flatMap((wordEntry) =>
      wordEntry.sentences
        .filter((sentence) => sentence.exportEnabled)
        .map((sentence) => ({ wordEntry, sentence })),
    );

    if (exportTargets.length === 0) {
      messages.setGenerationErr("No sentences selected for export. Use the Export checkbox on sentences first.");
      return;
    }

    setExportBusy(true);
    try {
      const fieldNames = await fetchModelFieldNames(settings.ankiModelName);
      if (fieldNames.length === 0) {
        messages.setGenerationErr("Selected note type has no fields. Check Settings → AnkiConnect.");
        return;
      }
      const fieldMapping = settings.ankiFieldMappings[settings.ankiModelName] ?? {};
      const wordEntryCacheUpdates = new Map<string, WordEntry["furiganaCache"]>();
      const sentenceCacheUpdates = new Map<string, WordEntry["sentences"][number]["furiganaCache"]>();

      const notes = await Promise.all(
        exportTargets.map(async ({ wordEntry, sentence }) => {
          const payload = await buildAnkiFieldPayload(
            fieldNames,
            fieldMapping,
            wordEntry,
            sentence,
            settings,
            furiganaAvailable,
          );
          if (payload.wordEntryCache && payload.wordEntryCache !== wordEntry.furiganaCache) {
            wordEntryCacheUpdates.set(wordEntry.id, payload.wordEntryCache);
          }
          if (payload.sentenceCache && payload.sentenceCache !== sentence.furiganaCache) {
            sentenceCacheUpdates.set(sentence.id, payload.sentenceCache);
          }
          return {
            deckName: settings.ankiDeckName,
            modelName: settings.ankiModelName,
            fields: payload.fields,
            tags: buildAnkiTags(settings, sentence, difficulty),
          };
        }),
      );

      const results = await addNotes(notes);

      const updates = new Map<string, { status: "exported" | "failed"; enabled: boolean }>();
      let successCount = 0;
      let failureCount = 0;

      results.forEach((result, index) => {
        const { sentence } = exportTargets[index];
        if (result) {
          successCount += 1;
          updates.set(sentence.id, { status: "exported", enabled: false });
        } else {
          failureCount += 1;
          updates.set(sentence.id, { status: "failed", enabled: true });
        }
      });

      wordEntries.updateAll((prev) => {
        let touchedEntry = false;

        const nextSentences = prev.sentences.map((sentence) => {
          const update = updates.get(sentence.id);
          const cacheUpdate = sentenceCacheUpdates.get(sentence.id);
          if (!update && !cacheUpdate) return sentence;
          touchedEntry = true;
          return {
            ...sentence,
            exportStatus: update?.status ?? sentence.exportStatus,
            exportEnabled: update?.enabled ?? sentence.exportEnabled,
            furiganaCache: cacheUpdate ?? sentence.furiganaCache,
          };
        });

        const wordEntryCache = wordEntryCacheUpdates.get(prev.id);
        if (!touchedEntry && !wordEntryCache) return prev;

        return {
          ...prev,
          sentences: nextSentences,
          furiganaCache: wordEntryCache ?? prev.furiganaCache,
        };
      });

      if (failureCount > 0) {
        messages.setGenerationErr(
          `Exported ${successCount} sentences, but ${failureCount} failed. Check AnkiConnect or field mappings.`,
        );
      } else {
        messages.setGenerationNotice(`Success! Exported ${successCount} sentences to Anki.`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      messages.setGenerationErr(`Could not export via AnkiConnect: ${message}`);
    } finally {
      setExportBusy(false);
    }
  }, [messages, settings, wordEntries.list, difficulty, furiganaAvailable]);

  return { exportBusy, onExport };
}
