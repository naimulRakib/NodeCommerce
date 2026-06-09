import { generateSellerCode } from "@/lib/codes";
import { prisma } from "@/lib/prisma";

  /**
   * Assigns a unique 8-character sellerCode if the profile does not have
   * one. NOTE: earlier versions documented 6 characters; the live field is
   * 8 characters (nanoid(8)).
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
