import { NextRequest, NextResponse } from "next/server";
import { getCachedRegistry, getCachedSheetValues, getSheetValues, appendSheetRow } from "@/lib/sheets";

// Resolve fuel-log spreadsheet ID
async function getFuelLogSpreadsheetId() {
  const registry = await getCachedRegistry();
  const entry = registry.find((e) => e.sheet_key === "fuel-log");
  if (!entry) {
    throw new Error("fuel-log sheet key not found in registry");
  }
  return entry.spreadsheet_id;
}

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = await getFuelLogSpreadsheetId();
    
    // Read past logs. A2:K covers columns up to Sync ID
    const { data: rows } = await getCachedSheetValues(spreadsheetId, "Log!A2:K2000", 30);
    
    const logs = rows.map((row) => {
      // Map columns back to JSON properties safely
      return {
        timestamp: row[0] ? new Date(row[0]).getTime() : Date.now(),
        date: row[1] || "",
        plate: row[2] || "",
        driver: row[3] || "",
        vehicleType: row[4] || "",
        fuelSource: row[5] || "",
        volume: parseFloat(row[6] || "0"),
        fuelType: row[7] || "",
        odometer: row[8] || "",
        notes: row[9] || "",
        id: row[10] || "",
        status: "synced",
      };
    });

    // Return in reverse chronological order
    logs.reverse();

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error("GET /api/fuel-log failed:", error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch logs: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const spreadsheetId = await getFuelLogSpreadsheetId();
    const body = await request.json();
    const { logs } = body;

    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { success: false, error: "logs array is required" },
        { status: 400 }
      );
    }

    // 1. Fetch existing log entries to prevent duplicate syncs
    const existingRows = await getSheetValues(spreadsheetId, "Log!A2:K2000");
    const existingSyncIds = new Set(
      existingRows.map((row) => String(row[10] || "").trim()).filter(Boolean)
    );

    const syncedIds: string[] = [];
    const skippedIds: string[] = [];

    // 2. Append new entries
    for (const log of logs) {
      const logId = String(log.id || "").trim();
      
      // Skip if already in Google Sheet
      if (logId && existingSyncIds.has(logId)) {
        skippedIds.push(logId);
        continue;
      }

      // Prepare row values
      const rowValues = [
        log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString(), // Timestamp
        log.date || "", // Date
        log.plate || "", // Licence Plate
        log.driver || "", // Driver
        log.vehicleType || "", // Vehicle Type
        log.fuelSource || "Local Tank", // Fuel Source
        String(log.volume || "0"), // Volume (L)
        log.fuelType || "", // Fuel Type
        log.odometer !== undefined ? String(log.odometer) : "", // Odometer
        log.notes || "", // Notes
        logId, // Sync ID
      ];

      await appendSheetRow(spreadsheetId, "Log!A:K", rowValues);
      syncedIds.push(logId);
    }

    return NextResponse.json({
      success: true,
      synced: syncedIds,
      skipped: skippedIds,
    });
  } catch (error) {
    console.error("POST /api/fuel-log failed:", error);
    return NextResponse.json(
      { success: false, error: `Failed to sync logs: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
