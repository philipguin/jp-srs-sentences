import type { Difficulty, Job } from "./types";

function uid(): string {
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
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function touch(job: Job): Job {
  return { ...job, updatedAt: Date.now() };
}
