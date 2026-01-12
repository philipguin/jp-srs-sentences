import type { AnkiFieldSource } from "./ankiTypes";

export const ANKI_FIELD_OPTIONS: Array<{ value: AnkiFieldSource; label: string }> = [
  { value: "", label: "(Nothing)" },
  { value: "word", label: "Word" },
  { value: "wordFuri", label: "Word (Furigana)" },
  { value: "wordFuriHtml", label: "Word (Furigana HTML)" },
  { value: "wordKana", label: "Word (Kana)" },
  { value: "meaning", label: "Word Meaning" },
  { value: "sentenceJp", label: "Sentence (JP)" },
  { value: "sentenceJpFuri", label: "Sentence (JP Furigana)" },
  { value: "sentenceJpFuriHtml", label: "Sentence (JP Furigana HTML)" },
  { value: "sentenceJpKana", label: "Sentence (JP Kana)" },
  { value: "sentenceEn", label: "Sentence (EN)" },
  { value: "difficulty", label: "Difficulty" },
  { value: "notes", label: "Notes" },
];
