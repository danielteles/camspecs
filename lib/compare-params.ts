export const COMPARE_ITEMS_PARAM = "items";
export const MAX_COMPARE_ITEMS = 4;

/**
 * Parses the `items` search param into a deduplicated list of slugs, capped
 * at {@link MAX_COMPARE_ITEMS}. Defensive against manually-edited URLs
 * (duplicate or excess slugs).
 */
export function parseCompareItems(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  const seen = new Set<string>();
  const slugs: string[] = [];

  for (const raw of value.split(",")) {
    const slug = raw.trim();
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }
  }

  return slugs.slice(0, MAX_COMPARE_ITEMS);
}

export function serializeCompareItems(slugs: string[]): string {
  return slugs.join(",");
}
