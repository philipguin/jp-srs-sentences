import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "@sglkc/kuroshiro-analyzer-kuromoji";
import type { KanaMode } from "../settings/settingsTypes";
import type { KuroshiroCache } from "./kuroshiroTypes";

const PARSER_ID = "kuroshiro+kuromoji-ipadic";
const PARSER_VERSION = "1";

let kuroshiro: Kuroshiro | null = null;
let initPromise: Promise<void> | null = null;
let initError: string | null = null;

export function buildKuroshiroCacheKey(text: string, mode: KanaMode): string {
  return [PARSER_ID, PARSER_VERSION, mode, text].join("|");
}

export function getKuroshiroInitError(): string | null {
  return initError;
}

export function isKuroshiroReady(): boolean {
  return !!kuroshiro;
}

export async function initKuroshiro(): Promise<void> {
  if (kuroshiro) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const instance = new Kuroshiro();
    const dictPath = `${import.meta.env.BASE_URL}_kuromoji_dict/`;
    const analyzer = new KuromojiAnalyzer({ dictPath });
    await instance.init(analyzer);
    kuroshiro = instance;
    initError = null;
  })().catch((err) => {
    initError = err instanceof Error ? err.message : String(err);
    throw err;
  });

  return initPromise;
}

async function ensureKuroshiro(): Promise<Kuroshiro> {
  await initKuroshiro();
  if (!kuroshiro) {
    throw new Error("Kuroshiro engine failed to initialize.");
  }
  return kuroshiro;
}

export async function toKana(text: string, mode: KanaMode): Promise<string> {
  const engine = await ensureKuroshiro();
  return engine.convert(text, { to: mode, mode: "normal" });
}

export async function toRubyHtml(text: string, mode: KanaMode): Promise<string> {
  const engine = await ensureKuroshiro();
  return engine.convert(text, { to: mode, mode: "furigana" });
}

function rubyHtmlToAnki(rubyHtml: string): string {
  const cleaned = rubyHtml.replace(/<rp>.*?<\/rp>/g, "");
  const rubyRegex = /<ruby>(.*?)<rt>(.*?)<\/rt>.*?<\/ruby>/g;
  let result = "";
  let lastIndex = 0;

  const needsSpaceBeforeKanji = (prevChar: string | undefined) => {
    if (!prevChar || prevChar == " ") return false;
    //if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~、。・！？「」（）『』【】]/.test(prevChar)) return false;
    return true;
  };

  const hasKanji = (text: string) => /[\u4e00-\u9faf]/.test(text);

  for (const match of cleaned.matchAll(rubyRegex)) {
    const index = match.index ?? 0;
    result += cleaned.slice(lastIndex, index);
    const base = match[1] ?? "";
    const reading = match[2] ?? "";
    const prevChar = result.slice(-1);
    const prefix = hasKanji(base) && needsSpaceBeforeKanji(prevChar) ? " " : "";
    result += `${prefix}${base}[${reading}]`;
    lastIndex = index + match[0].length;
  }

  result += cleaned.slice(lastIndex);
  return result;
}

export async function toAnkiBracket(text: string, mode: KanaMode): Promise<string> {
  const rubyHtml = await toRubyHtml(text, mode);
  return rubyHtmlToAnki(rubyHtml);
}

export async function ensureKuroshiroCacheEntry(
  text: string,
  mode: KanaMode,
  existing: KuroshiroCache | undefined,
  field: keyof Omit<KuroshiroCache, "key">,
): Promise<KuroshiroCache> {
  const key = buildKuroshiroCacheKey(text, mode);
  const cache: KuroshiroCache = existing?.key === key ? { ...existing } : { key };

  if (cache[field]) return cache;

  if (field === "kana") {
    cache.kana = await toKana(text, mode);
  } else if (field === "rubyHtml") {
    cache.rubyHtml = await toRubyHtml(text, mode);
  } else if (field === "anki") {
    cache.anki = await toAnkiBracket(text, mode);
  }

  return cache;
}
