/* eslint-env node */
// Legacy ESLint config (v8). Hosts the custom rpgfc plugin rules:
//   - rpgfc/no-numbers-in-player-facing
//   - rpgfc/no-hidden-in-routes
// Both rules back the Walking Skeleton doctrine gates (Story 00 AC-03/04/05).
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  env: {
    node: true,
    es2022: true,
    browser: true,
  },
  plugins: ["@typescript-eslint", "rpgfc"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  ignorePatterns: [
    "node_modules",
    "dist",
    "build",
    "coverage",
    "playwright-report",
    "test-results",
    "saves",
    "packages/web/src/routeTree.gen.ts",
    "packages/*/dist",
    // Fixtures are only linted by `pnpm lint:fixtures` (a dedicated script
    // that points eslint at this directory explicitly). Keeping them out of
    // the default sweep means the deliberate violations don't turn the main
    // `pnpm lint` red.
    "tests/fixtures/eslint/violations",
  ],
  rules: {
    "rpgfc/no-numbers-in-player-facing": "error",
    "rpgfc/no-hidden-in-routes": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
  },
  overrides: [
    {
      files: ["packages/web/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["*/hidden*", "@rpgfc/shared/**/hidden*"],
                message:
                  "The web package may not import hidden-state types. Only RenderedPlayer and friends cross the boundary.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["**/*.cjs"],
      env: { node: true },
      rules: {
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-require-imports": "off",
      },
    },
  ],
};
