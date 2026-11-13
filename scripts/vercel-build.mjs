import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.DATABASE_URL) {
  console.log("DATABASE_URL is set. Applying migrations and seed.");
  run("npx", ["drizzle-kit", "migrate"]);
  run("npx", ["tsx", "src/db/seed.ts"]);
} else {
  console.log("DATABASE_URL is not set. Skipping migrations and seed.");
}

run("npx", ["next", "build"]);
