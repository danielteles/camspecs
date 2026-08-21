import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  experimental: {
    // app/[locale]/layout.tsx is the root layout and uses a top-level
    // dynamic segment, so Next.js can't reliably compose a 404 page from
    // nested not-found.tsx files for entirely unmatched routes (see
    // node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md).
    // global-not-found.tsx handles that case; app/[locale]/not-found.tsx
    // still handles notFound() calls thrown from within matched routes.
    globalNotFound: true,
  },
};

export default withNextIntl(nextConfig);
