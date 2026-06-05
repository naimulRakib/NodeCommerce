const ALLOWED_FIELDS = [
  "fullName",
  "phone",
  "bio",
  "storeName",
  "city",
  "upazilla",
  "lat",
  "lng",
  "avatarUrl",
];

function optionalString(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function requiredString(value, fieldName) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  return trimmed;
}

/**
 * @param {Record<string, unknown>} body
 * @returns {Record<string, unknown>}
 */
export function validateProfilePatch(body: any) {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const data: any = {};
  const unknownKeys = Object.keys(body).filter(
    (key) => !ALLOWED_FIELDS.includes(key)
  );

  if (unknownKeys.length > 0) {
    throw new Error(`Unknown fields: ${unknownKeys.join(", ")}`);
  }

  if ("fullName" in body) data.fullName = optionalString(body.fullName);
  if ("phone" in body) data.phone = optionalString(body.phone);
  if ("bio" in body) data.bio = optionalString(body.bio);
  if ("avatarUrl" in body) data.avatarUrl = optionalString(body.avatarUrl);

  if ("storeName" in body) {
    data.storeName = requiredString(body.storeName, "Store name");
    data.username = data.storeName;
  }

  if ("city" in body) {
    data.city = requiredString(body.city, "City");
  }

  if ("upazilla" in body) {
    data.upazilla = requiredString(body.upazilla, "Upazilla");
  }

  if ("lat" in body) {
    const lat = Number(body.lat);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      throw new Error("Latitude must be a number between -90 and 90");
    }
    data.lat = lat;
  }

  if ("lng" in body) {
    const lng = Number(body.lng);
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      throw new Error("Longitude must be a number between -180 and 180");
    }
    data.lng = lng;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("No valid fields to update");
  }

  return data;
}
