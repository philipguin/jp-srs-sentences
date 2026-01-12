import type { Difficulty, DifficultyProfile } from "./sentenceGenTypes"

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  "intro": {
    label: "Intro Level",
    shortLabel: "Intro Level",
    shortHelp: "Very short, very explicit sentences for first exposure.",
    maxJapaneseChars: 35,
    promptGuidelines: [
      "Use short sentences with one main clause.",
      "Use very common grammar and high-frequency everyday vocabulary.",
      "Avoid idioms, slang, and heavy ellipsis (keep subjects/objects explicit).",
      "Prefer kana for uncommon kanji; keep wording simple and concrete.",
    ].join("\n"),
  },

  "beginner": {
    label: "Beginner",
    shortLabel: "Beginner",
    shortHelp: "Natural but simple sentences a learner can parse comfortably.",
    maxJapaneseChars: 55,
    promptGuidelines: [
      "Use short sentences, but allow basic subordinate clauses (because/if/when).",
      "Use common spoken grammar; keep phrasing natural but still explicit.",
      "Allow light ellipsis only when it doesn’t create ambiguity.",
      "Idioms only if extremely common; avoid niche slang.",
    ].join("\n"),
  },

  "intermediate": {
    label: "Intermediate",
    shortLabel: "Intermediate",
    shortHelp: "Natural Japanese with clauses, ellipsis, and common idioms.",
    maxJapaneseChars: 80,
    promptGuidelines: [
      "Use natural sentence flow with multiple clauses when appropriate.",
      "Allow common ellipsis (dropping obvious subjects).",
      "Include common collocations and idioms if they fit naturally.",
      "Avoid overly academic or technical vocabulary unless necessary.",
    ].join("\n"),
  },

  "native-like": {
    label: "Native-like",
    shortLabel: "Native-like",
    shortHelp: "Fully natural Japanese, including cultural assumptions.",
    maxJapaneseChars: 110,
    promptGuidelines: [
      "Write as a native speaker would, with no simplification.",
      "Use natural omission/ellipsis, idioms, and culturally normal phrasing.",
      "Optimize for authenticity and nuance over clarity for learners.",
    ].join("\n"),
  },

  "written-narrative": {
    label: "Written Narrative",
    shortLabel: "Written Narrative",
    shortHelp: "Written sentences similar to novel narration; denser than everyday speech.",
    maxJapaneseChars: 140,
    promptGuidelines: [
      "Write in a written or narrational style rather than everyday conversation.",
      "Allow abstract phrasing and internal states, but avoid overtly essayistic or experimental prose.",
      "Use longer sentences and denser clause structures than native-like speech.",
      "The sentence should resemble narration from a novel or descriptive prose.",
      "Do not aim for stylistic flourish; clarity still matters.",
    ].join("\n"),
  },

  "ultra-literary": {
    label: "Ultra-Literary (⚠️)",
    shortLabel: "Ultra-Literary",
    shortHelp: "Dense, abstract, literary Japanese intended to be difficult.",
    maxJapaneseChars: 200,
    promptGuidelines: [
      "Write in an overtly literary, abstract, or essayistic style.",
      "Prioritize nuance, metaphor, and psychological or conceptual depth over clarity.",
      "Allow long sentences with multiple clauses and embedded structures.",
      "Use literary or intellectual vocabulary where natural, even if uncommon.",
      "Ellipsis and implicit subjects are encouraged.",
      "The sentence should feel closer to a novel, essay, or literary narration than everyday speech.",
      "Do not simplify for learners; assume a highly literate native reader.",
      "If the sentence feels slightly exhausting to read, that is correct.",
    ].join("\n"),
  },
};
