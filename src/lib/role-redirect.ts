/**
 * Single source of truth for "where does this role live?".
 *
 * Centralizes the role → home/login path mapping so callers never have to
 * hardcode "/buyer/login" (or any other role-specific path) again.
 */

export type AppRole =
  | "seller"
  | "buyer"
  | "local_reseller"
  | "upazilla_reseller"
  | "district_reseller";

export const ROLE_HOME: Record<AppRole, string> = {
  seller: "/seller",
  buyer: "/buyer",
  local_reseller: "/local-reseller",
  upazilla_reseller: "/upazilla-reseller",
  district_reseller: "/district-reseller",
};

export const ROLE_LOGIN: Record<AppRole, string> = {
  seller: "/seller/login",
  buyer: "/buyer/login",
  local_reseller: "/local-reseller/login",
  upazilla_reseller: "/upazilla-reseller/login",
  district_reseller: "/district-reseller/login",
};

export function getRoleHomePath(role: AppRole): string {
  return ROLE_HOME[role];
}

export function getRoleLoginPath(role: AppRole): string {
  return ROLE_LOGIN[role];
}

/**
 * Best-effort role detection from a URL pathname. Works for the current app's
 * routes ("/seller/dashboard" → "seller"). Returns null when the path doesn't
 * start with a known role segment.
 */
export function detectRoleFromPath(pathname: string): AppRole | null {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  switch (seg) {
    case "seller":
      return "seller";
    case "buyer":
      return "buyer";
    case "local-reseller":
      return "local_reseller";
    case "upazilla-reseller":
      return "upazilla_reseller";
    case "district-reseller":
      return "district_reseller";
    default:
      return null;
  }
}
