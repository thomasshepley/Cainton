import { NextRequest, NextResponse } from "next/server";
import { adminOverview } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { MEAL_LABELS, menuById } from "@/lib/site";

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
  const header =
    "Guest,Party,Invitation,Status,Menu,Meal,Submitted By,Submitted At,Party Comment,Song Request";
  const lines = rows.map((r) =>
    [
      r.full_name,
      r.party_label,
      r.invite_type === "evening" ? "Evening only" : "Full day",
      r.attending === null
        ? "No response"
        : r.attending === 1
          ? "Attending"
          : "Declined",
      r.invite_type === "full" ? menuById(r.menu).label : "",
      r.meal ? (MEAL_LABELS.get(r.meal) ?? r.meal) : "",
      r.submitted_by ?? "",
      r.submitted_at ?? "",
      r.comment ?? "",
      r.song_request ?? "",
    ]
      .map(csvEscape)
      .join(",")
  );
  const csv = [header, ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wedding-rsvps.csv"',
    },
  });
}
