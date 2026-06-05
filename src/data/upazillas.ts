import locations from "./bangladesh-locations.json";

export type DistrictName = keyof typeof locations;

/** All 64 districts of Bangladesh (alphabetical). */
export const DISTRICTS = Object.keys(locations).sort() as DistrictName[];

/** Upazilas grouped by district. */
export const UPAZILLAS_BY_DISTRICT = locations as Record<string, string[]>;

export function getUpazilasForDistrict(district: string): string[] {
  if (!district) return [];
  return UPAZILLAS_BY_DISTRICT[district] ?? [];
}

/** @deprecated Use DISTRICTS and getUpazilasForDistrict instead. */
export const UPAZILLAS = DISTRICTS.flatMap((district) =>
  getUpazilasForDistrict(district).map((upazilla) => ({ district, upazilla }))
);

export function getDistrictUpazilas(district: string) {
  return getUpazilasForDistrict(district).map((upazilla) => ({
    district,
    upazilla,
  }));
}

export function getUniqueDistricts() {
  return DISTRICTS;
}
