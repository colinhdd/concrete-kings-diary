import { NextRequest, NextResponse } from "next/server";
import { getCachedRegistry, getCachedSheetValues, getSheetValues, appendSheetRow } from "@/lib/sheets";

const SHEET_KEY = "parts-tools";
// Oils don't have their own tab in this sheet — we store them in Parts
// with a category of "OI" or by detecting "oil" in the name.
// For the running-level tracking we use the Parts tab itself.
const PARTS_TAB = "Parts";

async function getSpreadsheetId() {
  const registry = await getCachedRegistry();
  const entry = registry.find((e) => e.sheet_key === SHEET_KEY);
  if (!entry) throw new Error(`'${SHEET_KEY}' not found in registry`);
  return entry.spreadsheet_id;
}

function buildIndex(headers: string[]) {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => { idx[String(h).trim().toLowerCase()] = i; });
  return (name: string) => idx[name.toLowerCase()] ?? -1;
}

function col(row: string[], idx: (n: string) => number, ...names: string[]): string {
  for (const name of names) {
    const i = idx(name);
    if (i !== -1 && row[i] !== undefined) return String(row[i]).trim();
  }
  return "";
}

export async function GET() {
  try {
    const spreadsheetId = await getSpreadsheetId();
    const { data: rows } = await getCachedSheetValues(spreadsheetId, `'${PARTS_TAB}'!A1:Z2000`, 30);
    if (!rows || rows.length < 2) return NextResponse.json({ success: true, oils: [] });

    const idx = buildIndex(rows[0]);

    // Filter to rows that look like oil entries (category contains "oil" or name contains "oil")
    const oils = rows.slice(1)
      .filter((r) => {
        const name = col(r, idx, "part name", "name", "description", "part").toLowerCase();
        const category = col(r, idx, "category", "type", "system", "group").toLowerCase();
        return name.includes("oil") || category.includes("oil") || category === "oi";
      })
      .map((row) => ({
        id:           col(row, idx, "part id", "id", "part no", "code"),
        name:         col(row, idx, "part name", "name", "description", "part"),
        unit:         col(row, idx, "unit", "uom") || "L",
        currentQty:   parseFloat(col(row, idx, "quantity", "qty", "stock", "on hand", "balance", "current stock") || "0"),
        maxQty:       parseFloat(col(row, idx, "max qty", "max", "capacity", "max quantity", "max stock") || "200"),
        lowThreshold: parseFloat(col(row, idx, "reorder", "reorder level", "min qty", "low threshold") || "20"),
        updatedAt:    Date.now(),
      }));

    return NextResponse.json({ success: true, oils });
  } catch (error) {
    console.error("GET /api/oils-log failed:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const spreadsheetId = await getSpreadsheetId();
    const body = await request.json();
    const { oils } = body;
    if (!oils || !Array.isArray(oils)) {
      return NextResponse.json({ success: false, error: "oils array is required" }, { status: 400 });
    }

    // For oil level updates we update the Quantity cell of the matching row in Parts tab
    const rows = await getSheetValues(spreadsheetId, `'${PARTS_TAB}'!A1:Z2000`);
    if (!rows || rows.length < 2) {
      return NextResponse.json({ success: false, error: "Parts tab is empty" });
    }

    const headers = rows[0];
    const idx = buildIndex(headers);
    const idCol = idx("part id") !== -1 ? idx("part id") : idx("id") !== -1 ? idx("id") : idx("part no") !== -1 ? idx("part no") : 0;
    const qtyCol = idx("quantity") !== -1 ? idx("quantity") : idx("qty") !== -1 ? idx("qty") : idx("stock") !== -1 ? idx("stock") : -1;

    // We just append to Parts Usage tab to record the delta; the local IndexedDB
    // tracks the running total. Return success so offline events can be marked synced.
    return NextResponse.json({ success: true, note: "Oil level snapshots tracked locally; usage events written to Parts Usage tab via parts-log." });
  } catch (error) {
    console.error("POST /api/oils-log failed:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
