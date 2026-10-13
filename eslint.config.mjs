import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

// The Obsidian directory scanner also runs the type-aware rules (including
// obsidianmd/no-unsupported-api) on JavaScript sources, so apply them here too.
const recommended = obsidianmd.configs.recommended;
const typeAware = recommended
  .filter((c) => JSON.stringify(c.files || "").includes("ts,cts,mts,tsx"))
  .map((c) => ({ ...c, files: ["src/**/*.js"] }));

export default defineConfig([
  { ignores: ["main.js", "node_modules/**"] },
  ...recommended,
  ...typeAware,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { projectService: { allowDefaultProject: ["eslint.config.mjs", "esbuild.config.mjs"] }, tsconfigRootDir: import.meta.dirname },
    },
    // The sources are untyped JavaScript, so these report every value as `any`;
    // the directory treats them as warnings too.
    rules: {
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
    },
  },
]);
