import type { AnkiFieldSource } from "./ankiTypes";
import type { AppSettings } from "../settings/settingsTypes";
import type { SentenceItem } from "../sentenceGen/sentenceGenTypes";
import type { WordEntry } from "../wordEntry/wordEntryTypes";
import { DIFFICULTY_PROFILES } from "../sentenceGen/sentenceGenDifficulty";
import { buildKuroshiroCacheKey, ensureKuroshiroCacheEntry } from "../kuroshiro/kuroshiroService";

async function resolveFuriganaValue(
  text: string,
  cacheKeyMode: AppSettings["furiganaKanaMode"],
  field: "kana" | "rubyHtml" | "anki",
  existing: SentenceItem["furiganaCache"] | WordEntry["furiganaCache"],
): Promise<{ value: string; cache: SentenceItem["furiganaCache"] | WordEntry["furiganaCache"] }> {
  const key = buildKuroshiroCacheKey(text, cacheKeyMode);
  const normalized = existing?.key === key ? existing : { key };
  if (normalized?.[field]) {
    return { value: normalized[field] ?? text, cache: normalized };
  }
  const next = await ensureKuroshiroCacheEntry(text, cacheKeyMode, normalized, field);
  return { value: next[field] ?? text, cache: next };
}

export async function resolveSentenceFieldValue(
  source: AnkiFieldSource,
  wordEntry: WordEntry,
  sentence: SentenceItem,
  settings: AppSettings,
  furiganaAvailable: boolean,
  caches: { wordEntryCache?: WordEntry["furiganaCache"]; sentenceCache?: SentenceItem["furiganaCache"] },
): Promise<{ value: string; wordEntryCache?: WordEntry["furiganaCache"]; sentenceCache?: SentenceItem["furiganaCache"] }> {
  switch (source) {
    case "word":
      return { value: wordEntry.word };
    case "wordKana":
    case "reading": {
      if (wordEntry.reading) return { value: wordEntry.reading };
      if (!furiganaAvailable || !wordEntry.word.trim()) return { value: wordEntry.word };
      const result = await resolveFuriganaValue(
        wordEntry.word,
        settings.furiganaKanaMode,
        "kana",
        caches.wordEntryCache
      );
      return { value: result.value, wordEntryCache: result.cache };
    }
    case "wordFuri": {
      if (!furiganaAvailable || !wordEntry.word.trim()) return { value: wordEntry.word };
      const result = await resolveFuriganaValue(
        wordEntry.word,
        settings.furiganaKanaMode,
        "anki",
        caches.wordEntryCache
      );
      return { value: result.value, wordEntryCache: result.cache };
    }
    case "wordFuriHtml": {
      if (!furiganaAvailable || !wordEntry.word.trim()) return { value: wordEntry.word };
      const result = await resolveFuriganaValue(
        wordEntry.word,
        settings.furiganaKanaMode,
        "rubyHtml",
        caches.wordEntryCache
      );
      return { value: result.value, wordEntryCache: result.cache };
    }
    case "meaning":
      return { value: sentence.definitionSnapshot?.text ?? "" };
    case "meaningNumber":
      return { value: sentence.definitionSnapshot?.index?.toString() ?? "" };
    case "sentenceJp":
      return { value: sentence.jp };
    case "sentenceJpKana": {
      if (!furiganaAvailable || !sentence.jp.trim()) return { value: sentence.jp };
      const result = await resolveFuriganaValue(sentence.jp, settings.furiganaKanaMode, "kana", caches.sentenceCache);
      return { value: result.value, sentenceCache: result.cache };
    }
    case "sentenceJpFuri": {
      if (!furiganaAvailable || !sentence.jp.trim()) return { value: sentence.jp };
      const result = await resolveFuriganaValue(sentence.jp, settings.furiganaKanaMode, "anki", caches.sentenceCache);
      return { value: result.value, sentenceCache: result.cache };
    }
    case "sentenceJpFuriHtml": {
      if (!furiganaAvailable || !sentence.jp.trim()) return { value: sentence.jp };
      const result = await resolveFuriganaValue(sentence.jp, settings.furiganaKanaMode, "rubyHtml", caches.sentenceCache);
      return { value: result.value, sentenceCache: result.cache };
    }
    case "sentenceEn":
      return { value: sentence.en };
    case "difficulty": {
      const difficultyKey = sentence.difficulty;
      if (difficultyKey) {
        const profile = DIFFICULTY_PROFILES[difficultyKey];
        return { value: profile?.shortLabel ?? profile?.label ?? difficultyKey };
      } else {
        return { value: "" };
      }
    }
    case "notes":
      return { value: sentence.notes };
    case "":
    default:
      return { value: "" };
  }
}

export async function buildAnkiFieldPayload(
  fieldNames: string[],
  mapping: Record<string, AnkiFieldSource>,
  wordEntry: WordEntry,
  sentence: SentenceItem,
  settings: AppSettings,
  furiganaAvailable: boolean,
): Promise<{
  fields: Record<string, string>;
  wordEntryCache?: WordEntry["furiganaCache"];
  sentenceCache?: SentenceItem["furiganaCache"];
}> {
  let wordEntryCache = wordEntry.furiganaCache;
  let sentenceCache = sentence.furiganaCache;

  const fields: Record<string, string> = {};

  for (const fieldName of fieldNames) {
    const source = mapping[fieldName] ?? "";
    const result = await resolveSentenceFieldValue(source, wordEntry, sentence, settings, furiganaAvailable, {
      wordEntryCache,
      sentenceCache,
    });
    fields[fieldName] = result.value;
    if (result.wordEntryCache) wordEntryCache = result.wordEntryCache;
    if (result.sentenceCache) sentenceCache = result.sentenceCache;
  }

  return { fields, wordEntryCache, sentenceCache };
}

export function buildAnkiTags(
  settings: AppSettings,
  sentence: SentenceItem,
  fallbackDifficulty: SentenceItem["difficulty"],
): string[] {
  const baseTags = settings.ankiTags
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  const tags = [...baseTags];

  if (settings.ankiIncludeDifficultyTag) {
    const difficultyKey = sentence.difficulty ?? fallbackDifficulty;
    if (difficultyKey) {
      tags.push(`difficulty-${difficultyKey}`);
    }
  }

  return Array.from(new Set(tags));
}
