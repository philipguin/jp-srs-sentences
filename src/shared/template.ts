export type TemplateVars = Record<string, string | number | undefined | null>;

const TEMPLATE_MACRO_REGEX = /\{([a-zA-Z0-9_]+)\}/g;

export function extractTemplateMacros(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(TEMPLATE_MACRO_REGEX)) {
    if (match[1]) seen.add(match[1]);
  }
  return Array.from(seen);
}

export function validateTemplateMacros(template: string, allowlist: string[]) {
  const macros = extractTemplateMacros(template);
  const unknown = macros.filter((macro) => !allowlist.includes(macro) && macro !== "notes");
  const hasForbiddenNotes = macros.includes("notes");
  return { unknown, hasForbiddenNotes };
}

/**
 * Simple template replacement:
 * - Replaces occurrences of "{key}" with the stringified value.
 * - Unknown keys are left as-is (so you can notice typos).
 * - Null/undefined become "".
 */
export function applyTemplate(template: string, vars: TemplateVars): string {
  return template.replace(TEMPLATE_MACRO_REGEX, (match, key) => {
    if (!(key in vars)) return match;
    const v = vars[key];
    if (v === null || v === undefined) return "";
    return String(v);
  });
}
