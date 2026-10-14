// `npm test`: bundle the sources, then run every tests/*.test.cjs with Node's built-in test runner.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const build = spawnSync(process.execPath, ["tests/build.mjs"], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const only = process.argv.slice(2);
const files = readdirSync("tests")
  .filter((f) => f.endsWith(".test.cjs") && (!only.length || only.some((o) => f.includes(o))))
  .sort()
  .map((f) => "tests/" + f);
const run = spawnSync(process.execPath, ["--enable-source-maps", "--require", "./tests/support/setup.cjs", "--test", ...files], { stdio: "inherit" });
process.exit(run.status ?? 1);
