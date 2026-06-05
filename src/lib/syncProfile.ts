import { supabaseClient } from "@/lib/supabase";

export async function syncProfileToDatabase(): Promise<{
  ok: boolean;
  error?: string;
  profile?: unknown;
}> {
  const {
    data: { session },
    error: sessionError,
  } = await supabaseClient.auth.getSession();

  if (sessionError || !session?.access_token) {
    return {
      ok: false,
      error: sessionError?.message || "Not authenticated",
    };
  }

  const response = await fetch("/api/seller/register", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      error:
        typeof body.error === "string"
          ? body.error
          : "Failed to sync profile to database",
    };
  }

  return { ok: true, profile: body.profile };
}
