import { parseHttpsUrl } from "@/lib/site-config";

/**
 * Affiliate "where to buy" links. Each retailer links to its own search
 * results for the product name rather than a hand-curated product URL, so
 * every catalog item gets links with no per-item data to maintain. A
 * retailer with no affiliate config set renders no link at all — we never
 * show an untracked retailer link that looks like a recommendation.
 */

export type RetailerId = "amazon" | "bh" | "mpb";

export interface RetailerLink {
  retailerId: RetailerId;
  name: string;
  href: string;
}

type AmazonMarketplace = "us" | "br";

export interface AffiliateConfig {
  /** Associates tracking ID per marketplace — each marketplace issues its own. */
  readonly amazonTags: Readonly<
    Partial<Record<AmazonMarketplace, string | undefined>>
  >;
  /**
   * Affiliate-network deep-link templates (Impact, Awin, CJ, …). `{url}` is
   * replaced with the URL-encoded retailer search URL, e.g.
   * "https://network.example/c/123?u={url}".
   */
  readonly bhLinkTemplate?: string | undefined;
  readonly mpbLinkTemplate?: string | undefined;
}

const URL_PLACEHOLDER = "{url}";

const AMAZON_HOSTS: Record<AmazonMarketplace, string> = {
  us: "www.amazon.com",
  br: "www.amazon.com.br",
};

interface LocaleMarket {
  amazonMarketplace: AmazonMarketplace;
  /** Retailers worth showing this audience, in display order. */
  retailers: readonly RetailerId[];
}

// Keyed by the app's locale ids (i18n/routing.ts), standing in for where
// the reader likely shops. A locale with no entry gets no links, rather
// than links to stores that may not ship there.
const MARKET_BY_LOCALE: Record<string, LocaleMarket> = {
  en: { amazonMarketplace: "us", retailers: ["amazon", "bh", "mpb"] },
  // Mostly Latin American readers, not Spain: Amazon US and B&H ship to
  // the region, while amazon.es and MPB's US store don't serve it.
  es: { amazonMarketplace: "us", retailers: ["amazon", "bh"] },
  // Brazilian import duty makes US stores a poor deal for these readers,
  // so only the local Amazon store.
  "pt-BR": { amazonMarketplace: "br", retailers: ["amazon"] },
};

/** Reads affiliate config from the server env. Unset values disable a retailer. */
export function getAffiliateConfig(): AffiliateConfig {
  return {
    amazonTags: {
      us: process.env.AFFILIATE_AMAZON_TAG_US,
      br: process.env.AFFILIATE_AMAZON_TAG_BR,
    },
    bhLinkTemplate: process.env.AFFILIATE_BH_LINK_TEMPLATE,
    mpbLinkTemplate: process.env.AFFILIATE_MPB_LINK_TEMPLATE,
  };
}

function buildAmazonLink(
  query: string,
  config: AffiliateConfig,
  market: LocaleMarket,
): RetailerLink | undefined {
  const marketplace = market.amazonMarketplace;
  const tag = config.amazonTags[marketplace];
  if (!tag) {
    return undefined;
  }
  const url = new URL(`https://${AMAZON_HOSTS[marketplace]}/s`);
  url.searchParams.set("k", query);
  url.searchParams.set("tag", tag);
  return { retailerId: "amazon", name: "Amazon", href: url.toString() };
}

function buildDeepLink(
  template: string | undefined,
  targetUrl: string,
): string | undefined {
  if (!template?.includes(URL_PLACEHOLDER) || !parseHttpsUrl(template)) {
    return undefined;
  }
  return template.replace(URL_PLACEHOLDER, encodeURIComponent(targetUrl));
}

function buildBhLink(
  query: string,
  config: AffiliateConfig,
): RetailerLink | undefined {
  const searchUrl = new URL("https://www.bhphotovideo.com/c/search");
  searchUrl.searchParams.set("q", query);
  const href = buildDeepLink(config.bhLinkTemplate, searchUrl.toString());
  return href ? { retailerId: "bh", name: "B&H Photo", href } : undefined;
}

function buildMpbLink(
  query: string,
  config: AffiliateConfig,
): RetailerLink | undefined {
  const searchUrl = new URL("https://www.mpb.com/en-us/search");
  searchUrl.searchParams.set("q", query);
  const href = buildDeepLink(config.mpbLinkTemplate, searchUrl.toString());
  return href ? { retailerId: "mpb", name: "MPB (used)", href } : undefined;
}

const LINK_BUILDERS: Record<
  RetailerId,
  (
    query: string,
    config: AffiliateConfig,
    market: LocaleMarket,
  ) => RetailerLink | undefined
> = {
  amazon: buildAmazonLink,
  bh: buildBhLink,
  mpb: buildMpbLink,
};

/** Affiliate links for `query` (a product name) suited to `locale`'s readers, in display order. */
export function buildRetailerLinks(
  query: string,
  locale: string,
  config: AffiliateConfig,
): RetailerLink[] {
  const market = MARKET_BY_LOCALE[locale];
  if (!market) {
    return [];
  }
  return market.retailers
    .map((retailerId) => LINK_BUILDERS[retailerId](query, config, market))
    .filter((link): link is RetailerLink => link !== undefined);
}
