import { OLLAMA_HOST, OLLAMA_TIMEOUT_MS } from "@/lib/env";

export class OllamaTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Ollama request timed out after ${timeoutMs}ms`);
    this.name = "OllamaTimeoutError";
  }
}

/**
 * Send a generation request to the local Ollama instance.
 * Uses OLLAMA_HOST and OLLAMA_TIMEOUT_MS from env (with sensible defaults).
 */
export async function verifyWithOllama(data: any) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError") {
      throw new OllamaTimeoutError(OLLAMA_TIMEOUT_MS);
    }
    throw err;
  }
}
