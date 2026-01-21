import type { Difficulty, DifficultyProfile } from "./sentenceGenTypes"
import introGuidelines from "./prompts/difficultyIntro.txt?raw";
import easyGuidelines from "./prompts/difficultyEasy.txt?raw";
import mediumGuidelines from "./prompts/difficultyMedium.txt?raw";
import nativeGuidelines from "./prompts/difficultyNative.txt?raw";
import writtenNarrativeGuidelines from "./prompts/difficultyWrittenNarrative.txt?raw";
import ultraLiteraryGuidelines from "./prompts/difficultyUltraLiterary.txt?raw";

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  "intro": {
    label: "Intro Level",
    shortLabel: "Intro Level",
    shortHelp: "Very short, very explicit sentences for first exposure.",
    maxJapaneseChars: 35,
    promptGuidelines: { block: introGuidelines },
  },
  "beginner": {
    label: "Beginner",
    shortLabel: "Beginner",
    shortHelp: "Natural but simple sentences a learner can parse comfortably.",
    maxJapaneseChars: 55,
    promptGuidelines: { block: easyGuidelines },
  },
  "intermediate": {
    label: "Intermediate",
    shortLabel: "Intermediate",
    shortHelp: "Natural Japanese with clauses, ellipsis, and common idioms.",
    maxJapaneseChars: 80,
    promptGuidelines: { block: mediumGuidelines },
  },
  "native-like": {
    label: "Native-like",
    shortLabel: "Native-like",
    shortHelp: "Fully natural Japanese, including cultural assumptions.",
    maxJapaneseChars: 110,
    promptGuidelines: { block: nativeGuidelines },
    // promptGuidelines: [
    //   "Write as a native speaker would, with no simplification.",
    //   "Use natural omission/ellipsis, idioms, and culturally normal phrasing.",
    //   "Optimize for authenticity and nuance over clarity for learners.",
    // ].join("\n"),
  },
  "written-narrative": {
    label: "Written Narrative",
    shortLabel: "Written Narrative",
    shortHelp: "Written sentences similar to novel narration; denser than everyday speech.",
    maxJapaneseChars: 140,
    promptGuidelines: { block: writtenNarrativeGuidelines },
  },
  "ultra-literary": {
    label: "Ultra-Literary (⚠️)",
    shortLabel: "Ultra-Literary",
    shortHelp: "Dense, abstract, literary Japanese intended to be difficult.",
    maxJapaneseChars: 200,
    promptGuidelines: { block: ultraLiteraryGuidelines },
  },
};
