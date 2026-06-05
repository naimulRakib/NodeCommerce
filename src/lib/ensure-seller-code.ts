import { generateSellerCode } from "@/lib/codes";
import { prisma } from "@/lib/prisma";

/**
 * Assigns a unique 6-character sellerCode if the profile does not have one.
 * @param {{ id: string, sellerCode?: string | null } | null} profile
 */
export async function ensureSellerCode(profile: any) {
  if (!profile) {
    return null;
  }

  if (profile.sellerCode) {
    return profile;
  }

  return prisma.profile.update({
    where: { id: profile.id },
    data: { sellerCode: await generateSellerCode() },
  });
}
