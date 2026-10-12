import { existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, "client/src");
const temporaryConfig = join(projectRoot, ".tsconfig.client-shard.tmp.json");
const requestedShard = process.env.CHECK_CLIENT_SHARD;
const requestedFile = process.env.CHECK_CLIENT_FILE;

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory()
      ? walk(absolute)
      : absolute.endsWith(".ts") || absolute.endsWith(".tsx")
        ? [absolute]
        : [];
  });
}

function shardFor(file) {
  const path = relative(projectRoot, file).replaceAll("\\", "/");
  const segments = path.split("/");
  const filename = segments.at(-1) ?? "";
  if (path === "client/src/App.tsx" || path === "client/src/main.tsx")
    return "entrypoints";
  if (path.startsWith("client/src/pages/admin/")) return "pages-admin";
  if (path.startsWith("client/src/pages/"))
    return `pages-${filename.slice(0, 1).toLowerCase() || "other"}`;
  if (path.startsWith("client/src/components/")) {
    const directory = segments[3] ?? "";
    return directory.includes(".")
      ? `components-root-${filename.slice(0, 1).toLowerCase() || "other"}`
      : `components-${directory}`;
  }
  return `foundation-${filename.slice(0, 1).toLowerCase() || "other"}`;
}

const sourceFiles = walk(sourceRoot)
  .map(file => relative(projectRoot, file).replaceAll("\\", "/"))
  .sort();
const groups = new Map();
for (const file of sourceFiles) {
  const files = groups.get(shardFor(join(projectRoot, file))) ?? [];
  files.push(file);
  groups.set(shardFor(join(projectRoot, file)), files);
}

let passed = 0;
try {
  const orderedGroups = Array.from(groups.entries())
    .sort(([left], [right]) => {
      if (left === "entrypoints") return 1;
      if (right === "entrypoints") return -1;
      return left.localeCompare(right);
    })
    .filter(
      ([name, files]) =>
        (!requestedShard || name === requestedShard) &&
        (!requestedFile || files.includes(requestedFile))
    );
  if ((requestedShard || requestedFile) && orderedGroups.length === 0)
    throw new Error(
      `Unknown client shard or source file: ${requestedShard ?? requestedFile}`
    );
  for (const [name, files] of orderedGroups) {
    const selectedFiles = requestedFile
      ? files.filter(file => file === requestedFile)
      : files;
    writeFileSync(
      temporaryConfig,
      JSON.stringify(
        {
          extends: "./tsconfig.json",
          files: selectedFiles,
          include: ["shared/**/*", "client/src/types/**/*.d.ts"],
          exclude: ["node_modules", "build", "dist"],
          compilerOptions: {
            incremental: false,
            noEmit: true,
            skipLibCheck: true,
          },
        },
        null,
        2
      )
    );
    // Invoke the project-local pnpm entrypoint directly on Windows. Calling
    // the .cmd shim through a shell is noisy (and can be unsafe when args are
    // ever extended); the local CommonJS entrypoint works in CI and shells.
    const packageManager =
      process.platform === "win32"
        ? join(projectRoot, "node_modules", "pnpm", "bin", "pnpm.cjs")
        : "pnpm";
    const run = spawnSync(
      process.platform === "win32" ? process.execPath : packageManager,
      process.platform === "win32"
        ? [
            packageManager,
            "exec",
            "tsc",
            "-p",
            temporaryConfig,
            "--pretty",
            "false",
          ]
        : ["exec", "tsc", "-p", temporaryConfig, "--pretty", "false"],
      {
        cwd: projectRoot,
        // App.tsx imports the complete route graph; on Windows that entrypoint
        // needs the same 4GB ceiling as the production build. Smaller shards
        // normally stay well below it, but one deterministic ceiling keeps the
        // audit from reporting heap exhaustion as a TypeScript failure.
        env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
        encoding: "utf8",
        shell: false,
      }
    );
    if (run.status !== 0) {
      const spawnError = run.error ? `\nspawn error: ${run.error.message}` : "";
      process.stderr.write(
        `\n[${name}] failed (${selectedFiles.length} roots)\n${run.stdout ?? ""}${run.stderr ?? ""}${spawnError}`
      );
      process.exitCode = run.status || 1;
      break;
    }
    passed += selectedFiles.length;
    process.stdout.write(`[${name}] passed (${selectedFiles.length} roots)\n`);
  }
} finally {
  if (existsSync(temporaryConfig)) rmSync(temporaryConfig);
}

if (!process.exitCode)
  process.stdout.write(
    `Client shard coverage passed: ${passed}/${requestedShard ? passed : sourceFiles.length} source roots.\n`
  );
