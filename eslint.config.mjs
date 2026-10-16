import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import { DEFAULT_BRANDS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js";
import globals from "globals";

// The sources are fully typed TypeScript, so the plugin's recommended (type-aware)
// rules — including the @typescript-eslint/no-unsafe-* family — run at their
// default severity. Any new `any` leak fails `npm run lint` (and therefore CI).
export default defineConfig([
  { ignores: ["main.js", "node_modules/**", "*.mjs"] },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: { "obsidianmd/ui/sentence-case": ["warn", { enforceCamelCaseLower: true, brands: [...DEFAULT_BRANDS, "Substack"] }] },
  },
]);
