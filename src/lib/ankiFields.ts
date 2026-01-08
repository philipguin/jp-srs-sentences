import type { AnkiFieldSource } from "../state/types";

export const ANKI_FIELD_OPTIONS: Array<{ value: AnkiFieldSource; label: string }> = [
  { value: "", label: "(Nothing)" },
  { value: "word", label: "Word" },
  { value: "reading", label: "Word Reading" },
  { value: "meaning", label: "Word Meaning" },
  { value: "sentenceJp", label: "Sentence (JP)" },
  { value: "sentenceEn", label: "Sentence (EN)" },
  { value: "difficulty", label: "Difficulty" },
  { value: "notes", label: "Notes" },
];
