export type AnkiFieldSource =
  | ""
  | "word"
  | "wordKana"
  | "wordFuri"
  | "wordFuriHtml"
  | "meaning"
  | "meaningNumber"
  | "sentenceJp"
  | "sentenceJpKana"
  | "sentenceJpFuri"
  | "sentenceJpFuriHtml"
  | "sentenceEn"
  | "difficulty"
  | "notes"
  | "reading";

export type AnkiExportState = {
  exportBusy: boolean;
  onExport: () => Promise<void>;
};