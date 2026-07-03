import { NextRequest, NextResponse } from "next/server";
import { adminOverview } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { site } from "@/lib/site";

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
  const mealLabels = new Map<string, string>(
    site.mealOptions.map((m) => [m.id, m.label])
  );
  const rows = adminOverview();
  const header =
    "Guest,Party,Status,Meal,Submitted By,Submitted At,Party Comment";
  const lines = rows.map((r) =>
    [
      r.full_name,
      r.party_label,
      r.attending === null
        ? "No response"
        : r.attending === 1
          ? "Attending"
          : "Declined",
      r.meal ? (mealLabels.get(r.meal) ?? r.meal) : "",
      r.submitted_by ?? "",
      r.submitted_at ?? "",
      r.comment ?? "",
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
