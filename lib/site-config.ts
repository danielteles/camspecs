/**
 * Base URL used to resolve absolute URLs for metadata (Open Graph images,
 * canonical/alternate links). Defaults to localhost for local development;
 * set NEXT_PUBLIC_SITE_URL once a production domain exists.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * `value` if it parses as an absolute https: URL, otherwise undefined. Used
 * to validate outbound links that come from env config, so a typo'd or
 * `javascript:` value never reaches an `href`.
 */
export function parseHttpsUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The tip-jar page (Ko-fi, Buy Me a Coffee, …) set via
 * NEXT_PUBLIC_SUPPORT_URL. Read per call rather than at module load so
 * tests can stub the env. Undefined hides every support link.
 */
export function getSupportUrl(): string | undefined {
  const value = process.env.NEXT_PUBLIC_SUPPORT_URL;
  const url = parseHttpsUrl(value);
  if (value && !url) {
    console.warn(
      "[site-config] NEXT_PUBLIC_SUPPORT_URL is not an https URL — hiding support links.",
    );
  }
  return url;
}
