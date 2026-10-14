// Bundles the plugin's sources for the tests. Obsidian is replaced by tests/support/obsidian-mock.cjs at
// run time; CodeMirror stays external so the tests and the plugin share one copy of it.
import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["tests/support/entry.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2020",
  external: ["obsidian", "@codemirror/*"],
  outfile: "tests/.build/toolbox.cjs",
  sourcemap: "inline",
  logLevel: "warning",
});
