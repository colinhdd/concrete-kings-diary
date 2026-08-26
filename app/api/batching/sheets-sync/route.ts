import { NextRequest, NextResponse } from "next/server";
import { getCachedRegistry, getSheetValues, appendSheetRow, updateSheetRange, ensureSheetTabExists } from "@/lib/sheets";
import { LoadRecord } from "@/lib/db-batching";

export const BATCHING_SHEET_HEADERS = [
  "Batch #",
  "Date",
  "Time",
  "Batcher",
  "Truck",
  "Mix Code",
  "Strength",
  "Placement Type",
  "Quantity (yd³)",
  "Sand Moisture %",
  "Design Water (L)",
  "Expected Water (L)",
  "Actual Water (L)",
  "Water Adjustment (L)",
  "Cement Design (kg/yd³)",
  "Sand Design (kg/yd³)",
  "¾ Stone Design (kg/yd³)",
  "⅜ Stone Design (kg/yd³)",
  "Plasticizer Design (fl oz/yd³)",
  "Retarder Design (fl oz/yd³)",
  "Concrete Condition",
  "Adjustments",
  "Notes",
  "Load ID",
  "Created At",
  "Updated At",
  "Status",
];

async function getBatchingSpreadsheetId(): Promise<string> {
  // First try environment variable
  if (process.env.BATCHING_SPREADSHEET_ID) {
    return process.env.BATCHING_SPREADSHEET_ID;
  }

  // Next check registry
  try {
    const registry = await getCachedRegistry();
    const entry = registry.find((e) => e.sheet_key === "batching-diary" || e.sheet_key === "batching-log");
    if (entry && entry.spreadsheet_id) {
      return entry.spreadsheet_id;
    }
  } catch (err) {
    console.warn("Could not read registry for batching-diary, falling back to default:", err);
  }

  // Fallback to registry sheet ID or default
  return process.env.REGISTRY_SPREADSHEET_ID || "1aw6b7LjmkzzsFGc5iqzDmO80Co0iA_qLVEfjcnE6om8";
}

/**
 * Format LoadRecord into a flat 27-column Google Sheet row
 */
function formatLoadToSheetRow(load: LoadRecord): any[] {
  const obsString = Array.isArray(load.concreteObservations)
    ? load.concreteObservations.join(", ")
    : String(load.concreteObservations || "");

  const adjString = Array.isArray(load.batchAdjustments)
    ? load.batchAdjustments
        .map((a) => (a.value !== undefined ? `${a.label} (${a.value}${a.unit || ""})` : a.label))
        .join("; ")
    : "";

  return [
    load.batchNumber || "", // Batch # (YEAR-MM-DD-JJ-LL)
    load.date || "", // Date
    load.time || "", // Time
    load.batcherName || "", // Batcher
    load.truckCode || "", // Truck
    load.mixCode || "", // Mix Code
    load.snapshot?.strength || "", // Strength
    load.snapshot?.placementType || "", // Placement Type
    Number(load.quantity || 0), // Quantity
    Number(load.sandMoisturePercent || 0), // Sand Moisture %
    Number(load.designWater || 0), // Design Water
    Number(load.expectedBatchWater || 0), // Expected Water
    Number(load.actualBatchWater || 0), // Actual Water
    Number(load.waterAdjustment || 0), // Water Adjustment
    Number(load.snapshot?.cementDesign || 0), // Cement Design
    Number(load.snapshot?.sandDesign || 0), // Sand Design
    Number(load.snapshot?.threeQuarterStoneDesign || 0), // ¾ Stone Design
    Number(load.snapshot?.threeEighthStoneDesign || 0), // ⅜ Stone Design
    Number(load.snapshot?.plasticizerDesign || 0), // Plasticizer Design
    Number(load.snapshot?.retarderDesign || 0), // Retarder Design
    obsString, // Concrete Condition
    adjString, // Adjustments
    load.batcherNotes || "", // Notes
    load.id, // Load ID (Unique Key in Column X / Index 23)
    new Date(load.createdAt).toISOString(), // Created At
    new Date(load.updatedAt).toISOString(), // Updated At
    load.isVoid ? `VOID: ${load.voidReason || "Cancelled"}` : "Active", // Status
  ];
}

export async function exportLoadsToGoogleSheets(loads: LoadRecord[]): Promise<{
  success: boolean;
  exportedIds: string[];
  updatedIds: string[];
  error?: string;
}> {
  if (!loads || loads.length === 0) {
    return { success: true, exportedIds: [], updatedIds: [] };
  }

  try {
    const spreadsheetId = await getBatchingSpreadsheetId();
    const sheetTab = "Sheet1";

    // 1. Ensure tab and header row exist
    await ensureSheetTabExists(spreadsheetId, sheetTab, BATCHING_SHEET_HEADERS);

    // 2. Fetch existing rows to identify duplicate Load IDs (Column X is index 23)
    let existingRows: any[][] = [];
    try {
      existingRows = await getSheetValues(spreadsheetId, `${sheetTab}!A2:AA5000`);
    } catch (readErr) {
      console.warn("Could not read existing rows, will append rows directly:", readErr);
    }

    const loadIdRowMap = new Map<string, number>();
    existingRows.forEach((row, index) => {
      const loadId = String(row[23] || "").trim();
      if (loadId) {
        // row index in sheet is index + 2 (1-based + 1 header row)
        loadIdRowMap.set(loadId, index + 2);
      }
    });

    const exportedIds: string[] = [];
    const updatedIds: string[] = [];

    for (const load of loads) {
      const rowValues = formatLoadToSheetRow(load);
      const existingRowNumber = loadIdRowMap.get(load.id);

      if (existingRowNumber) {
        // Update row in place to prevent duplicates
        await updateSheetRange(spreadsheetId, `${sheetTab}!A${existingRowNumber}:AA${existingRowNumber}`, [rowValues]);
        updatedIds.push(load.id);
      } else {
        // Append new row
        await appendSheetRow(spreadsheetId, `${sheetTab}!A:AA`, rowValues);
        exportedIds.push(load.id);
      }
    }

    return {
      success: true,
      exportedIds,
      updatedIds,
    };
  } catch (err: any) {
    console.error("Google Sheets batching export error:", err);
    return {
      success: false,
      exportedIds: [],
      updatedIds: [],
      error: err.message || "Failed to export to Google Sheets",
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loads } = body;

    if (!loads || !Array.isArray(loads)) {
      return NextResponse.json({ success: false, error: "loads array required" }, { status: 400 });
    }

    const result = await exportLoadsToGoogleSheets(loads);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/batching/sheets-sync error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
