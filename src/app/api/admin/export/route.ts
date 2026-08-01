import { NextRequest, NextResponse } from "next/server";
import { adminOverview } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { parseMeals } from "@/lib/site";
import { courseOrder, dishLabels, getMenus, menuById } from "@/lib/menus";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** GET a CSV of all guests + responses (admin only) */
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = adminOverview();
  const menus = getMenus();
  const labels = dishLabels(menus);
  const courses = courseOrder(menus);
  const courseHeaders = courses.map((c) => c.label).join(",");
  const header = `Guest,Party,Invitation,Status,Menu,${courseHeaders},Submitted By,Submitted At,Party Comment,Song Request`;
  const lines = rows.map((r) => {
    const picks = parseMeals(r.meal);
    return [
      r.full_name,
      r.party_label,
      r.invite_type === "evening" ? "Evening only" : "Full day",
      r.attending === null
        ? "No response"
        : r.attending === 1
          ? "Attending"
          : "Declined",
      r.invite_type === "full" ? menuById(menus, r.menu).label : "",
      ...courses.map((c) =>
        picks[c.id] ? (labels.get(picks[c.id]) ?? picks[c.id]) : ""
      ),
      r.submitted_by ?? "",
      r.submitted_at ?? "",
      r.comment ?? "",
      r.song_request ?? "",
    ]
      .map(csvEscape)
      .join(",");
  });
  const csv = [header, ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wedding-rsvps.csv"',
    },
  });
}
