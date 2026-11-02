import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import jsxA11y from "eslint-plugin-jsx-a11y";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

// Same reason as jsx-a11y below: eslint-config-next already registers the
// @typescript-eslint plugin, so merge in just the type-aware rules.
const typeCheckedRules = Object.assign(
  {},
  ...tseslint.configs.recommendedTypeCheckedOnly.map((c) => c.rules ?? {}),
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next already registers the jsx-a11y plugin; only merge in
  // the stricter rule set here instead of the full preset (which would try
  // to redefine the plugin and error).
  { rules: jsxA11y.flatConfigs.strict.rules },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...typeCheckedRules,
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  eslintConfigPrettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    // Python ETL pipeline: not JS/TS, and its venv bundles vendored JS
    // (e.g. Playwright's driver assets) that isn't ours to lint.
    "scripts/scraper/**",
  ]),
]);

export default eslintConfig;
