import { NextRequest, NextResponse } from "next/server";
import { adminOverview } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { getMenus } from "@/lib/menus";

/** GET the full guest list with response status, plus the live menus */
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ rows: adminOverview(), menus: getMenus() });
}
