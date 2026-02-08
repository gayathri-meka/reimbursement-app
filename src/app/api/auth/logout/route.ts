import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const cookie = clearAuthCookie();
  response.cookies.set(cookie);
  return response;
}
