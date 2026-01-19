export type KuroshiroStatus = "idle" | "loading" | "ready" | "error";

export type KuroshiroCache = {
  key: string;
  kana?: string;
  rubyHtml?: string;
  anki?: string;
};
