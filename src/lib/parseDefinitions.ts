import type { DefinitionSpec } from "../state/types";

/**
 * Parses numbered definitions like:
 * 1. foo
 * 2. bar
 *
 * Returns consecutive indices starting at 1 (based on what it sees).
 */
export function parseDefinitions(raw: string): Array<{ index: number; text: string }> {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const out: Array<{ index: number; text: string }> = [];

  // Matches:
  // "1. blah", "2) blah", "3: blah", "4．blah"
  const re = /^(\d{1,3})\s*[.)：:\uFF0E]\s*(.+)$/;

  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const index = Number(m[1]);
    const text = m[2].trim();
    if (!Number.isFinite(index) || text.length === 0) continue;
    out.push({ index, text });
  }

  // If user pasted weird numbering (e.g., 1,3,4), keep as-is;
  // UI can still show it. We'll sort by index to be predictable.
  out.sort((a, b) => a.index - b.index);

  return out;
}

/**
 * Applies a preset like "1/2/3" across def indices in order.
 * If there are more defs than preset entries, use the last entry.
 */
export function applyCountPreset(
  parsed: Array<{ index: number; text: string }>,
  preset: string
): DefinitionSpec[] {
  const parts = preset
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => Number(p));

  const fallback = parts.length > 0 && Number.isFinite(parts[parts.length - 1])
    ? parts[parts.length - 1]
    : 1;

  return parsed.map((d, i) => {
    const c = parts[i] ?? fallback;
    const count = Number.isFinite(c) && c > 0 ? Math.floor(c) : 1;
    return { index: d.index, text: d.text, count };
  });
}

/**
 * When re-parsing raw definitions, try to preserve existing per-definition counts
 * by matching on index.
 */
export function mergeCounts(
  nextDefs: DefinitionSpec[],
  prevDefs: DefinitionSpec[]
): DefinitionSpec[] {
  const prevByIndex = new Map<number, DefinitionSpec>();
  for (const d of prevDefs) prevByIndex.set(d.index, d);

  return nextDefs.map((d) => {
    const prev = prevByIndex.get(d.index);
    return {
      ...d,
      count: prev?.count ?? d.count,
      validity: prev?.validity,
      studyPriority: prev?.studyPriority,
      comment: prev?.comment,
      colocations: prev?.colocations,
    };
  });
}
