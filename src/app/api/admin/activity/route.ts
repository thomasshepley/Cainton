import { NextRequest, NextResponse } from "next/server";
import { getActivity } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/** GET the activity log, newest first (admin only) */
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ rows: getActivity(500) });
}
