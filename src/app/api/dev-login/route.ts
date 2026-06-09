import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const redirectTo = searchParams.get("redirectTo") || "/";

  if (!id) {
    return NextResponse.json({ error: "Missing ID" }, { status: 400 });
  }

  // Set the dev bypass cookie
  const cookieStore = await cookies();
  cookieStore.set("bypass_auth_id", id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });

  return NextResponse.redirect(new URL(redirectTo, req.url));
}
