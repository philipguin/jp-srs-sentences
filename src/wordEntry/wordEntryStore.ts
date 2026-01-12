import type { Difficulty } from "../sentenceGen/sentenceGenTypes";
import type { Job } from "./wordEntryTypes";

export function uid(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function createEmptyJob(opts?: { difficulty?: Difficulty }): Job {
  const now = Date.now();
  return {
    id: uid(),
    word: "",
    reading: "",
    difficulty: opts?.difficulty ?? "beginner",
    definitionsRaw: "",
    definitions: [],
    generations: [],
    generationBatches: [],
    sentences: [],
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function touch(job: Job): Job {
  return { ...job, updatedAt: Date.now() };
}

export function normalizeJob(job: Job): Job {
  return {
    ...job,
    definitions: job.definitions ?? [],
    generations: job.generations ?? [],
    generationBatches: job.generationBatches ?? [],
    sentences: (job.sentences ?? []).map((sentence) => ({
      ...sentence,
      exportEnabled: sentence.exportEnabled ?? true,
      exportStatus: sentence.exportStatus ?? "new",
    })),
  };
}
