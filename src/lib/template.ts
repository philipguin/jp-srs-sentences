export type TemplateVars = Record<string, string | number | undefined | null>;

/**
 * Simple template replacement:
 * - Replaces occurrences of "{key}" with the stringified value.
 * - Unknown keys are left as-is (so you can notice typos).
 * - Null/undefined become "".
 */
export function applyTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (!(key in vars)) return match;
    const v = vars[key];
    if (v === null || v === undefined) return "";
    return String(v);
  });
}
