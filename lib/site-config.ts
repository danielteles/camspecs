/**
 * Base URL used to resolve absolute URLs for metadata (Open Graph images,
 * canonical/alternate links). Defaults to localhost for local development;
 * set NEXT_PUBLIC_SITE_URL once a production domain exists.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
