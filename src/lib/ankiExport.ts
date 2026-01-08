import type { AppSettings, AnkiFieldSource, Job, SentenceItem } from "../state/types";
import { DIFFICULTY_PROFILES } from "../state/difficulty";

export function resolveSentenceFieldValue(source: AnkiFieldSource, job: Job, sentence: SentenceItem): string {
  switch (source) {
    case "word":
      return job.word;
    case "reading":
      return job.reading ?? "";
    case "meaning":
      return sentence.definitionSnapshot?.text ?? "";
    case "meaningNumber":
      return sentence.definitionSnapshot?.index ?? "";
    case "sentenceJp":
      return sentence.jp;
    case "sentenceEn":
      return sentence.en;
    case "difficulty": {
      const difficultyKey = sentence.difficulty ?? "";
      const profile = DIFFICULTY_PROFILES[difficultyKey];
      return profile?.shortLabel ?? profile?.label ?? difficultyKey;
    }
    case "notes":
      return sentence.notes;
    case "":
    default:
      return "";
  }
}

export function buildAnkiFieldPayload(
  fieldNames: string[],
  mapping: Record<string, AnkiFieldSource>,
  job: Job,
  sentence: SentenceItem
): Record<string, string> {
  return fieldNames.reduce<Record<string, string>>((acc, fieldName) => {
    const source = mapping[fieldName] ?? "";
    acc[fieldName] = resolveSentenceFieldValue(source, job, sentence);
    return acc;
  }, {});
}

export function buildAnkiTags(settings: AppSettings, job: Job, sentence: SentenceItem): string[] {
  const baseTags = settings.ankiTags
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  const tags = [...baseTags];

  if (settings.ankiIncludeDifficultyTag) {
    const difficultyKey = sentence.difficulty ?? job.difficulty;
    if (difficultyKey) {
      tags.push(`difficulty-${difficultyKey}`);
    }
  }

  return Array.from(new Set(tags));
}
