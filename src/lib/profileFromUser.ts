import type { User } from "@supabase/supabase-js";

export function profileDataFromUser(user: User) {
  const meta = user.user_metadata ?? {};

  return {
    username:
      (meta.store_name as string) ||
      user.email?.split("@")[0] ||
      "seller",
    storeName: (meta.store_name as string) || "",
    lat: parseFloat(String(meta.lat)) || 0,
    lng: parseFloat(String(meta.lng)) || 0,
    city: (meta.city as string) || "",
    upazilla: (meta.upazilla as string) || "",
  };
}
