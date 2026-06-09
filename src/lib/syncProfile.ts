import { supabaseClient } from "@/lib/supabase";

/**
 * Syncs the current Supabase session into the role-appropriate profile
 * table. The server-side route (`/api/auth/sync-profile`) inspects every
 * role table and updates the matching one — this lib no longer hardcodes
 * a single endpoint.
 */
export async function syncProfileToDatabase(): Promise<{
  ok: boolean;
  error?: string;
  role?: string;
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

  const response = await fetch("/api/auth/sync-profile", {
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

  return { ok: true, role: body.role, profile: body.profile };
}
