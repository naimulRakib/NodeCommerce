/**
 * Validates a PATCH body for the local-reseller profile endpoint.
 * Local resellers have a different field shape from sellers (they have
 * `username` not `storeName`, and they always have `city` + `upazilla`).
 * Returns a sanitized data object suitable for `prisma.localReseller.update`.
 */
const ALLOWED_FIELDS = [
  "fullName",
  "phone",
  "bio",
  "username",
  "city",
  "upazilla",
  "lat",
  "lng",
  "avatarUrl",
] as const;

type LocalResellerField = (typeof ALLOWED_FIELDS)[number];

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function requiredString(value: unknown, fieldName: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  return trimmed;
}

export function validateLocalResellerProfilePatch(body: unknown): Record<LocalResellerField, unknown> {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const data: Record<string, unknown> = {};
  const obj = body as Record<string, unknown>;

  const unknownKeys = Object.keys(obj).filter(
    (key) => !(ALLOWED_FIELDS as readonly string[]).includes(key)
  );
  if (unknownKeys.length > 0) {
    throw new Error(`Unknown fields: ${unknownKeys.join(", ")}`);
  }

  if ("fullName" in obj) data.fullName = optionalString(obj.fullName);
  if ("phone" in obj) data.phone = optionalString(obj.phone);
  if ("bio" in obj) data.bio = optionalString(obj.bio);
  if ("avatarUrl" in obj) data.avatarUrl = optionalString(obj.avatarUrl);

  if ("username" in obj) {
    data.username = requiredString(obj.username, "Username");
  }
  if ("city" in obj) {
    data.city = requiredString(obj.city, "City");
  }
  if ("upazilla" in obj) {
    data.upazilla = requiredString(obj.upazilla, "Upazilla");
  }

  if ("lat" in obj) {
    const lat = Number(obj.lat);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      throw new Error("Latitude must be a number between -90 and 90");
    }
    data.lat = lat;
  }
  if ("lng" in obj) {
    const lng = Number(obj.lng);
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      throw new Error("Longitude must be a number between -180 and 180");
    }
    data.lng = lng;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("No valid fields to update");
  }

  return data as Record<LocalResellerField, unknown>;
}
