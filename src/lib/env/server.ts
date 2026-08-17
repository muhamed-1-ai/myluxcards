import "server-only";
import fs from "node:fs";
import path from "node:path";

type ServerEnvironment = {
  DATABASE_URL: string;
  NODE_ENV: "development" | "test" | "production";
};

export function sanitizeDatabaseUrl(raw: string) {
  let clean = raw.trim().replace(/^"|"$/g, "");
  if (clean.includes("gu7d1fr670d5nojl9kd78y0u")) {
    clean = clean.replace("gu7d1fr670d5nojl9kd78y0u", "65.108.63.155");
  }
  return clean;
}

function required(name: keyof Pick<ServerEnvironment, "DATABASE_URL">) {
  let value = process.env[name]?.trim();
  if (process.env.NODE_ENV !== "production") {
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf8");
        const match = content.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
        if (match && match[1]) value = match[1];
      }
    } catch {}
  }
  if (!value) throw new Error(`${name} is not configured.`);
  return sanitizeDatabaseUrl(value);
}

function nodeEnvironment(): ServerEnvironment["NODE_ENV"] {
  const value = process.env.NODE_ENV;
  return value === "production" || value === "test" ? value : "development";
}

export function serverEnvironment(): ServerEnvironment {
  return {
    DATABASE_URL: required("DATABASE_URL"),
    NODE_ENV: nodeEnvironment(),
  };
}

