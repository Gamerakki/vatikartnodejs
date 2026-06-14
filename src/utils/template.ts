export function compileTemplate(templateStr: string, varsObject: Record<string, string | number | null | undefined>): string {
  if (!templateStr) return '';

  return templateStr.replace(/\{([^}]+)\}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    const value = varsObject[key];
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  });
}
