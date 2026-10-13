import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  { ignores: ["main.js", "node_modules/**"] },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { projectService: { allowDefaultProject: ["eslint.config.mjs", "esbuild.config.mjs"] }, tsconfigRootDir: import.meta.dirname },
    },
  },
]);
