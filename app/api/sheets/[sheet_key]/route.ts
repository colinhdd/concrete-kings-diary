import { NextRequest, NextResponse } from "next/server";
import { getCachedRegistry, getCachedSheetValues } from "@/lib/sheets";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sheet_key: string }> }
) {
  try {
    const { sheet_key } = await params;
    if (!sheet_key) {
      return NextResponse.json(
        { success: false, error: "sheet_key parameter is required" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tab_name = searchParams.get("tab_name");

    if (!tab_name) {
      return NextResponse.json(
        { success: false, error: "tab_name query parameter is required" },
        { status: 400 }
      );
    }

    // Cache control parameters
    const forceRefresh = searchParams.get("refresh") === "true";
    const ttlParam = searchParams.get("ttl");
    let ttl = 10; // default 10 seconds TTL
    if (ttlParam !== null) {
      const parsedTtl = parseInt(ttlParam, 10);
      if (!isNaN(parsedTtl)) {
        ttl = parsedTtl;
      }
    }

    // 1. Fetch registry (cached)
    let registry;
    try {
      registry = await getCachedRegistry(forceRefresh);
    } catch (error) {
      console.error("Failed to fetch registry:", error);
      return NextResponse.json(
        { success: false, error: `Failed to fetch registry: ${(error as Error).message}` },
        { status: 500 }
      );
    }

    // 2. Find matching active entry
    const entry = registry.find(
      (e) => e.sheet_key.toLowerCase() === sheet_key.toLowerCase()
    );

    if (!entry) {
      return NextResponse.json(
        { success: false, error: `Sheet key '${sheet_key}' not found in registry` },
        { status: 404 }
      );
    }

    if (!entry.active) {
      return NextResponse.json(
        { success: false, error: `Sheet key '${sheet_key}' is inactive in registry` },
        { status: 403 }
      );
    }

    // 3. Fetch data from resolved spreadsheet ID & tab (cached)
    try {
      const { data, cached, ageSeconds } = await getCachedSheetValues(
        entry.spreadsheet_id,
        tab_name,
        ttl,
        forceRefresh
      );
      return NextResponse.json({
        success: true,
        sheet_key: entry.sheet_key,
        tab_name,
        cached,
        age_seconds: ageSeconds,
        data,
      });
    } catch (error) {
      console.error(`Failed to fetch spreadsheet data for ID ${entry.spreadsheet_id} tab ${tab_name}:`, error);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch sheet data: ${(error as Error).message}`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Unexpected error in sheets API route:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
