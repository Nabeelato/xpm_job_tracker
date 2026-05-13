const controlCharacters = /[\u0000-\u001F\u007F]/g;

export function sanitizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(controlCharacters, " ").replace(/\s+/g, " ").trim();
}

export function optionalText(value: unknown): string | null {
  const sanitized = sanitizeText(value);
  return sanitized.length > 0 ? sanitized : null;
}

export function normalizeClientName(value: unknown): string {
  return sanitizeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,'`"’‘“”()[\]{}_/\\|:;]+/g, " ")
    .replace(/&/g, " and ")
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeHeader(value: unknown): string {
  return sanitizeText(value).toLowerCase().replace(/\s+/g, " ");
}
