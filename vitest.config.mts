import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Next.js resolves `server-only` from its own compiled copy, so it's
      // not a direct dependency. Tests exercise server modules directly
      // (outside the react-server condition), so map it to the no-op entry.
      "server-only": "next/dist/compiled/server-only/empty.js",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.tsx"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "components/**/*.tsx"],
      exclude: [
        "lib/**/*.test.ts",
        "lib/mock-data.ts",
        "lib/types.ts",
        "components/**/*.test.tsx",
        "components/ui/**",
      ],
    },
  },
});
