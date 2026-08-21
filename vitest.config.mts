import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
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
