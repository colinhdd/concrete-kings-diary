import { NextRequest, NextResponse } from "next/server";
import { upsertLoadsToSupabase } from "@/lib/supabase-batching";
import { exportLoadsToGoogleSheets } from "../sheets-sync/route";
import { LoadRecord } from "@/lib/db-batching";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loads } = body as { loads: LoadRecord[] };

    if (!loads || !Array.isArray(loads) || loads.length === 0) {
      return NextResponse.json(
        { success: false, error: "loads array must not be empty" },
        { status: 400 }
      );
    }

    // 1. Authoritative Step: Upsert into Supabase
    const supabaseResult = await upsertLoadsToSupabase(loads);

    if (supabaseResult.failedIds.length > 0 && supabaseResult.syncedIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          synced: [],
          failed: supabaseResult.failedIds,
          error: supabaseResult.error || "Failed to commit records to Supabase",
        },
        { status: 502 }
      );
    }

    // 2. Secondary Step: Forward authoritative records to Google Sheets
    // Note: Per spec, failure in Google Sheets does not block tablet sync success
    let sheetsResult: any = { success: false, note: "pending" };
    try {
      const syncedRecords = loads.filter((l) => supabaseResult.syncedIds.includes(l.id));
      sheetsResult = await exportLoadsToGoogleSheets(syncedRecords);
    } catch (sheetsErr: any) {
      console.warn("Google Sheets automatic export deferred/failed:", sheetsErr);
      sheetsResult = { success: false, error: sheetsErr.message };
    }

    return NextResponse.json({
      success: true,
      synced: supabaseResult.syncedIds,
      failed: supabaseResult.failedIds,
      sheetsExport: sheetsResult,
    });
  } catch (error: any) {
    console.error("POST /api/batching/sync error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Sync handler error" },
      { status: 500 }
    );
  }
}
