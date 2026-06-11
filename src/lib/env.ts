/**
 * Centralized environment access — NodeCommerce Bangladesh
 *
 * ALL process.env accesses should go through this file.
 * Throws a descriptive error at module-load time if required vars are missing.
 * Never construct clients with `connectionString="undefined"`.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `[env] Required environment variable "${name}" is not set. ` +
      `Check your .env.local file. Copy .env.example to .env.local if missing.`
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

// ─── Database ─────────────────────────────────────────────────────────────────
export const DATABASE_URL: string = required("DATABASE_URL");

// ─── Supabase ─────────────────────────────────────────────────────────────────
export const SUPABASE_URL: string = optional("NEXT_PUBLIC_SUPABASE_URL", "");
export const SUPABASE_ANON_KEY: string = optional("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

// ─── Ollama (Local LLM) ───────────────────────────────────────────────────────
export const OLLAMA_HOST: string = optional("OLLAMA_HOST", "http://127.0.0.1:11434");
export const OLLAMA_TIMEOUT_MS: number = asInt("OLLAMA_TIMEOUT_MS", 8_000);

// ─── Groq AI (Grok Terminal + LangChain) ─────────────────────────────────────
// Falls back to empty string so build doesn't fail — runtime will warn
export const GROQ_API_KEY: string = optional("GROQ_API_KEY", "");

// ─── Auth & Security Secrets ──────────────────────────────────────────────────
export const NEXTAUTH_SECRET: string = optional("NEXTAUTH_SECRET", "");
export const NEXTAUTH_URL: string = optional("NEXTAUTH_URL", "http://localhost:3000");
export const INTERNAL_SECRET: string = optional("INTERNAL_SECRET", "");
export const CRON_SECRET: string = optional("CRON_SECRET", "");
export const QR_SECRET: string = optional(
  "QR_SECRET",
  "fallback-qr-secret-NOT-for-production"
);
export const TEST_RESET_SECRET: string = optional("TEST_RESET_SECRET", "");

// ─── App URLs ─────────────────────────────────────────────────────────────────
export const APP_URL: string = optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

// ─── Internal Agent API ───────────────────────────────────────────────────────
export const NODECOMMERCE_BASE_URL: string = optional(
  "NODECOMMERCE_BASE_URL",
  "http://localhost:3000"
);
export const NODECOMMERCE_INTERNAL_KEY: string = optional(
  "NODECOMMERCE_INTERNAL_KEY",
  ""
);

// ─── UiPath ───────────────────────────────────────────────────────────────────
export const UIPATH_WEBHOOK_URL: string = optional("UIPATH_WEBHOOK_URL", "");
export const UIPATH_API_KEY: string = optional("UIPATH_API_KEY", "");
export const UIPATH_WEBHOOK_SECRET: string = optional("UIPATH_WEBHOOK_SECRET", "");

// ─── Redis ────────────────────────────────────────────────────────────────────
export const REDIS_URL: string = optional("REDIS_URL", "redis://localhost:6379");

// ─── LangSmith Tracing (optional) ────────────────────────────────────────────
export const LANGCHAIN_TRACING_V2: boolean = process.env.LANGCHAIN_TRACING_V2 === "true";
export const LANGCHAIN_PROJECT: string = optional(
  "LANGCHAIN_PROJECT",
  "nodecommerce-bangladesh"
);
export const LANGCHAIN_API_KEY: string = optional("LANGCHAIN_API_KEY", "");

// ─── Runtime helpers ──────────────────────────────────────────────────────────
export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

/**
 * Validate the admin secret from a request header.
 * Checks INTERNAL_SECRET first, falls back to NEXTAUTH_SECRET.
 * Returns true if the provided secret is valid and non-empty.
 */
export function isValidAdminSecret(providedSecret: string | null | undefined): boolean {
  const valid = INTERNAL_SECRET || NEXTAUTH_SECRET;
  if (!valid || !providedSecret) return false;
  return providedSecret === valid;
}

/**
 * Validate a cron-job request.
 * Returns true if CRON_SECRET is not set (open in dev) or matches.
 */
export function isValidCronRequest(providedSecret: string | null | undefined): boolean {
  if (!CRON_SECRET) return !IS_PRODUCTION; // open in dev, closed in prod
  return providedSecret === CRON_SECRET;
}

/**
 * Validate a UiPath webhook signature.
 * Returns true if UIPATH_WEBHOOK_SECRET is not set or matches.
 */
export function isValidUiPathSecret(providedSecret: string | null | undefined): boolean {
  if (!UIPATH_WEBHOOK_SECRET) return true; // optional check
  return providedSecret === UIPATH_WEBHOOK_SECRET;
}

// Re-export as `env` namespace for convenience
export const env = {
  DATABASE_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  OLLAMA_HOST,
  OLLAMA_TIMEOUT_MS,
  GROQ_API_KEY,
  NEXTAUTH_SECRET,
  NEXTAUTH_URL,
  INTERNAL_SECRET,
  CRON_SECRET,
  QR_SECRET,
  TEST_RESET_SECRET,
  APP_URL,
  NODECOMMERCE_BASE_URL,
  NODECOMMERCE_INTERNAL_KEY,
  UIPATH_WEBHOOK_URL,
  UIPATH_API_KEY,
  UIPATH_WEBHOOK_SECRET,
  REDIS_URL,
  LANGCHAIN_TRACING_V2,
  LANGCHAIN_PROJECT,
  LANGCHAIN_API_KEY,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  isValidAdminSecret,
  isValidCronRequest,
  isValidUiPathSecret,
};
