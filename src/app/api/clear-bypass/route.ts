import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/clear-bypass
 * Clears the dev bypass_auth_id cookie so you can log in with a real session.
 */
export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete("bypass_auth_id");
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("supabase.co", "localhost:3000") || "http://localhost:3000"));
}
