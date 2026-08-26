import { NextRequest, NextResponse } from "next/server";
import { getCachedRegistry, getCachedSheetValues, getSheetValues, appendSheetRow, writeHeadersIfEmpty } from "@/lib/sheets";

// Resolve fuel-log spreadsheet ID
async function getFuelLogSpreadsheetId() {
  const registry = await getCachedRegistry();
  const entry = registry.find((e) => e.sheet_key === "fuel-log");
  if (!entry) {
    throw new Error("fuel-log sheet key not found in registry");
  }
  return entry.spreadsheet_id;
}

const TANK_HEADERS = ["Timestamp", "Date", "Volume (L)", "Notes", "Refill ID"];

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = await getFuelLogSpreadsheetId();
    
    // Initialize headers if sheet is empty
    await writeHeadersIfEmpty(spreadsheetId, "Tank!A1:E1", TANK_HEADERS);

    // Read past refills
    const { data: rows } = await getCachedSheetValues(spreadsheetId, "Tank!A2:E500", 30);
    
    const refills = rows.map((row) => {
      return {
        timestamp: row[0] ? new Date(row[0]).getTime() : Date.now(),
        date: row[1] || "",
        volume: parseFloat(row[2] || "0"),
        notes: row[3] || "",
        id: row[4] || "",
      };
    });

    refills.reverse(); // Reverse to return latest refills first

    return NextResponse.json({
      success: true,
      refills,
    });
  } catch (error) {
    console.error("GET /api/tank-refill failed:", error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch refills: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const spreadsheetId = await getFuelLogSpreadsheetId();
    const body = await request.json();
    const { refills } = body;

    if (!refills || !Array.isArray(refills)) {
      return NextResponse.json(
        { success: false, error: "refills array is required" },
        { status: 400 }
      );
    }

    // 1. Initialize headers if sheet is empty
    await writeHeadersIfEmpty(spreadsheetId, "Tank!A1:E1", TANK_HEADERS);

    // 2. Fetch existing refills to check for duplicates
    const existingRows = await getSheetValues(spreadsheetId, "Tank!A2:E500");
    const existingRefillIds = new Set(
      existingRows.map((row) => String(row[4] || "").trim()).filter(Boolean)
    );

    const syncedIds: string[] = [];
    const skippedIds: string[] = [];

    // 3. Append new entries
    for (const refill of refills) {
      const refillId = String(refill.id || "").trim();
      
      // Skip if already in Google Sheet
      if (refillId && existingRefillIds.has(refillId)) {
        skippedIds.push(refillId);
        continue;
      }

      // Prepare row values
      const rowValues = [
        refill.timestamp ? new Date(refill.timestamp).toISOString() : new Date().toISOString(), // Timestamp
        refill.date || "", // Date
        String(refill.volume || "0"), // Volume (L)
        refill.notes || "", // Notes
        refillId, // Refill ID
      ];

      await appendSheetRow(spreadsheetId, "Tank!A:E", rowValues);
      syncedIds.push(refillId);
    }

    return NextResponse.json({
      success: true,
      synced: syncedIds,
      skipped: skippedIds,
    });
  } catch (error) {
    console.error("POST /api/tank-refill failed:", error);
    return NextResponse.json(
      { success: false, error: `Failed to sync refills: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
