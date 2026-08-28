import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";

export async function GET(request: Request) {
  const user = await currentUser(request);
  return user ? NextResponse.json({ user }) : NextResponse.json({ user: null }, { status: 401 });
}
