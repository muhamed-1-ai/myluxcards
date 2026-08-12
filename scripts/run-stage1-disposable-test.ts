import { spawn } from "node:child_process";

type DatabaseIdentity = {
  host: string;
  port: string;
  database: string;
};

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const PG_DESTINATION_VARIABLES = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"] as const;

function databaseIdentityFromUrl(value: string, variableName: string): DatabaseIdentity {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} is not a valid PostgreSQL URL.`);
  }

  if (!POSTGRES_PROTOCOLS.has(url.protocol) || !url.hostname || !url.pathname || url.pathname === "/") {
    throw new Error(`${variableName} must identify a PostgreSQL host and database.`);
  }

  return {
    host: url.hostname.toLowerCase().replace(/\.$/, ""),
    port: url.port || "5432",
    database: decodeURIComponent(url.pathname.slice(1)),
  };
}

function productionDatabaseIdentity(env: NodeJS.ProcessEnv): DatabaseIdentity {
  if (env.PGHOST && env.PGUSER && env.PGDATABASE) {
    return {
      host: env.PGHOST.toLowerCase().replace(/\.$/, ""),
      port: env.PGPORT || "5432",
      database: env.PGDATABASE,
    };
  }
  if (env.DATABASE_URL) return databaseIdentityFromUrl(env.DATABASE_URL, "DATABASE_URL");
  throw new Error("The configured production database cannot be identified safely; refusing to continue.");
}

function isSameDatabase(left: DatabaseIdentity, right: DatabaseIdentity) {
  return left.host === right.host && left.port === right.port && left.database === right.database;
}

function disposableEnvironment(testDatabaseUrl: string, validator = false): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: testDatabaseUrl };
  for (const name of PG_DESTINATION_VARIABLES) delete env[name];
  delete env.STAGE1_TEST_DATABASE_URL;
  if (validator) env.STAGE1_DISPOSABLE_DB = "1";
  else delete env.STAGE1_DISPOSABLE_DB;
  return env;
}

function runNpm(args: string[], env: NodeJS.ProcessEnv, captureOutput = false): Promise<string> {
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      env,
      shell: false,
      stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let output = "";
    if (captureOutput) {
      child.stdout?.on("data", chunk => {
        const text = String(chunk);
        output += text;
        process.stdout.write(text);
      });
      child.stderr?.on("data", chunk => process.stderr.write(chunk));
    }
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve(output);
      else reject(new Error(`npm ${args.join(" ")} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

async function main() {
  const testDatabaseUrl = process.env.STAGE1_TEST_DATABASE_URL;
  if (!testDatabaseUrl) throw new Error("STAGE1_TEST_DATABASE_URL is required; refusing to continue.");

  const testIdentity = databaseIdentityFromUrl(testDatabaseUrl, "STAGE1_TEST_DATABASE_URL");
  const productionIdentity = productionDatabaseIdentity(process.env);
  if (isSameDatabase(testIdentity, productionIdentity)) {
    throw new Error("The disposable database appears to be the configured production database; refusing to continue.");
  }

  const commandEnv = disposableEnvironment(testDatabaseUrl);
  const validatorEnv = disposableEnvironment(testDatabaseUrl, true);

  process.stdout.write("Stage 1 disposable safety preflight\n");
  await runNpm(["run", "db:validate:stage1", "--", "--preflight"], validatorEnv);

  process.stdout.write("Applying Stage 1 migrations to the disposable database\n");
  await runNpm(["run", "db:migrate"], commandEnv);
  await runNpm(["run", "db:migrate:status"], commandEnv);

  process.stdout.write("Verifying idempotent migration rerun\n");
  const rerunOutput = await runNpm(["run", "db:migrate"], commandEnv, true);
  const newlyApplied = rerunOutput.split(/\r?\n/).filter(line => /^applied \d{4}_/.test(line.trim()));
  if (newlyApplied.length !== 0) throw new Error("The second migration run applied new migrations; aborting validation.");

  await runNpm(["run", "db:validate:stage1"], validatorEnv);
  await runNpm(["test"], commandEnv);
  process.stdout.write("Stage 1 disposable database test completed successfully.\n");
}

main().catch(error => {
  console.error("Stage 1 disposable database test failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
