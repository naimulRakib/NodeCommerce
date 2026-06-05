/**
 * Keeps Supabase Auth user_metadata in sync with the Postgres profiles row.
 */
export async function syncProfileToSupabaseAuth(supabase, profile) {
  const { error } = await supabase.auth.updateUser({
    data: {
      store_name: profile.storeName,
      full_name: profile.fullName ?? "",
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
      avatar_url: profile.avatarUrl ?? "",
      lat: profile.lat,
      lng: profile.lng,
      city: profile.city,
      upazilla: profile.upazilla,
      seller_code: profile.sellerCode,
    },
  });

  return error;
}
