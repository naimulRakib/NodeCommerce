// @ts-ignore
import UPAZILLA_CENTROIDS_RAW from "@/data/upazilla-centroids.js";
// @ts-ignore
import DISTRICT_CENTROIDS_RAW from "@/data/district-centroids.js";
import { UPAZILLAS, getUpazilasForDistrict } from "@/data/upazillas";

const UPAZILLA_CENTROIDS = UPAZILLA_CENTROIDS_RAW as Record<string, { lat: number; lng: number }>;
const DISTRICT_CENTROIDS = DISTRICT_CENTROIDS_RAW as Record<string, { lat: number; lng: number }>;

const DEFAULT_CENTER = { lat: 23.6850, lng: 90.3563 };

// Edge Case 60: Geographic Bounds Checking for Bangladesh
function isValidCoordinate(coords: { lat: number; lng: number }): boolean {
  return coords.lat >= 20.5 && coords.lat <= 26.8 && coords.lng >= 88.0 && coords.lng <= 92.7;
}

export function getUpazillaCoords(upazillaName: string): { lat: number; lng: number } {
  if (!upazillaName) return DEFAULT_CENTER;
  // Normalize string for lookup
  const key = Object.keys(UPAZILLA_CENTROIDS).find(
    (k) => k.toLowerCase() === upazillaName.toLowerCase()
  );
  if (!key) {
    console.warn(`Centroid not found for Upazilla: ${upazillaName}, using Bangladesh center`);
    return DEFAULT_CENTER;
  }
  const coords = UPAZILLA_CENTROIDS[key];
  if (!isValidCoordinate(coords)) {
    console.warn(`Invalid out-of-bounds centroid for Upazilla: ${upazillaName} (${coords.lat}, ${coords.lng}). Using Bangladesh center.`);
    return DEFAULT_CENTER;
  }
  return coords;
}

export function getDistrictCoords(districtName: string): { lat: number; lng: number } {
  if (!districtName) return DEFAULT_CENTER;
  // Normalize string for lookup
  const key = Object.keys(DISTRICT_CENTROIDS).find(
    (k) => k.toLowerCase() === districtName.toLowerCase()
  );
  if (!key) {
    console.warn(`Centroid not found for District: ${districtName}, using Bangladesh center`);
    return DEFAULT_CENTER;
  }
  const coords = DISTRICT_CENTROIDS[key];
  if (!isValidCoordinate(coords)) {
    console.warn(`Invalid out-of-bounds centroid for District: ${districtName} (${coords.lat}, ${coords.lng}). Using Bangladesh center.`);
    return DEFAULT_CENTER;
  }
  return coords;
}

export function getUpazillasInDistrict(district: string): string[] {
  return getUpazilasForDistrict(district);
}

export function getDistrictForUpazilla(upazillaName: string): string | null {
  if (!upazillaName) return null;
  const match = UPAZILLAS.find(
    (u) => u.upazilla.toLowerCase() === upazillaName.toLowerCase()
  );
  return match ? match.district : null;
}
