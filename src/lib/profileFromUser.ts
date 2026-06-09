import type { User } from "@supabase/supabase-js";

/**
 * Extract a default profile from a Supabase auth user.
 *
 * We do NOT assume the user is a seller. The legacy `|| "seller"` fallback
 * was dangerous: when a buyer or any other role registered, the client
 * would force their username to "seller", colliding with every other
 * role-less user in search and admin UIs. Instead we use a deterministic
 * id-derived default and warn at the call site if a downstream code path
 * is still hardcoding "seller".
 */
export function profileDataFromUser(user: User) {
  const meta = user.user_metadata ?? {};
  const idTail = (user.id ?? "").slice(-6) || "anon";

  // Prefer an explicit username; else a slice of the email; else a stable
  // per-user id-derived default. Never collapse to a literal role name.
  const emailLocal = user.email?.split("@")[0] ?? "";
  const username =
    (meta.username as string) ||
    (meta.store_name as string) || // legacy metadata key, kept for compat
    emailLocal ||
    `user-${idTail}`;

  if (!emailLocal && !(meta.store_name as string) && !(meta.username as string)) {
    // No identity of any kind was available. The call site should treat
    // this as a bug, not a normal flow.
    console.warn(
      "[profileFromUser] Falling back to id-derived username for",
      user.id,
    );
  }

  return {
    username,
    storeName: (meta.store_name as string) || "",
    lat: parseFloat(String(meta.lat)) || 0,
    lng: parseFloat(String(meta.lng)) || 0,
    city: (meta.city as string) || "",
    upazilla: (meta.upazilla as string) || "",
  };
}
