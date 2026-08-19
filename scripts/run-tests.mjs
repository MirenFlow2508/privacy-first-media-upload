import { spawnSync } from "node:child_process";

const args = process.argv.slice(2).flatMap((argument) =>
  argument === "--runInBand"
    ? ["--maxWorkers=1", "--no-file-parallelism"]
    : [argument],
);

const result = spawnSync(
  process.execPath,
  ["./node_modules/vitest/vitest.mjs", "run", ...args],
  { stdio: "inherit" },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
