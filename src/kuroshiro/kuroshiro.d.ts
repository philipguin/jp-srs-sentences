declare module "kuroshiro" {
  type ConvertMode = "normal" | "furigana";
  type ConvertTo = "hiragana" | "katakana";

  interface ConvertOptions {
    to: ConvertTo;
    mode: ConvertMode;
  }

  class Kuroshiro {
    init(analyzer: unknown): Promise<void>;
    convert(text: string, options: ConvertOptions): Promise<string>;
  }

  export default Kuroshiro;
}
