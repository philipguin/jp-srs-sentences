import type { AnkiFieldSource } from "../state/types";

export const ANKI_FIELD_OPTIONS: Array<{ value: AnkiFieldSource; label: string }> = [
  { value: "", label: "(Nothing)" },
  { value: "word", label: "Word" },
  { value: "meaning", label: "Meaning (EN)" },
  { value: "sentenceJp", label: "Sentence (JP)" },
  { value: "sentenceEn", label: "Sentence (EN)" },
  { value: "difficulty", label: "Difficulty" },
  { value: "notes", label: "Notes" },
];
