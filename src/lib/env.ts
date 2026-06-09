/**
 * Centralized environment access.
 *
 * Throws a descriptive error at module-load time if required env vars are
 * missing, so we never construct a `pg.Pool` with `connectionString="undefined"`.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `[env] Required environment variable ${name} is not set. ` +
        `Copy .env.example to .env.local and populate it.`,
    );
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

function asInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Required: the Postgres connection string used by Prisma. */
export const DATABASE_URL: string = required("DATABASE_URL");

/** Optional: Supabase URL / anon key. The Supabase client falls back to "" */
export const SUPABASE_URL: string = optional("NEXT_PUBLIC_SUPABASE_URL", "");
export const SUPABASE_ANON_KEY: string = optional(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "",
);

/** Optional: Ollama host + timeout used by lib/ollama.ts */
export const OLLAMA_HOST: string = optional(
  "OLLAMA_HOST",
  "http://127.0.0.1:11434",
);
export const OLLAMA_TIMEOUT_MS: number = asInt("OLLAMA_TIMEOUT_MS", 8_000);
