import { NextRequest, NextResponse } from "next/server";
import { getCachedRegistry, getCachedSheetValues, getSheetValues, appendSheetRow, updateSheetRange, deleteSheetRow, getGoogleAuth } from "@/lib/sheets";
import { google } from "googleapis";

const SHEET_KEY = "parts-tools";
const PARTS_TAB = "Parts";

const CATEGORY_MAP: Record<string, string> = {
  AR: "Air System",
  BR: "Brakes",
  BD: "Chassis & Body",
  CP: "Concrete Pump System",
  PM: "Consumables / Service",
  CL: "Cooling System",
  DM: "Drum & Mixing System",
  EL: "Electrical System",
  EN: "Engine",
  HO: "Hose",
  HY: "Hydraulic System",
  LT: "Lights",
  MS: "Miscellaneous",
  NB: "Nuts & Bolts",
  SL: "Seals & Gaskets",
  ST: "Steering",
  SU: "Suspension",
  TL: "Tools",
  TX: "Transmission & Driveline",
  TY: "Tire and Wheels",
};

const REVERSE_CATEGORY_MAP: Record<string, string> = {};
Object.entries(CATEGORY_MAP).forEach(([code, label]) => {
  REVERSE_CATEGORY_MAP[label.toLowerCase().trim()] = code;
  REVERSE_CATEGORY_MAP[code.toLowerCase().trim()] = code;
});

// Explicit tyre/tire/wheels synonyms to map to TY directly
REVERSE_CATEGORY_MAP["tyres"] = "TY";
REVERSE_CATEGORY_MAP["tyre"] = "TY";
REVERSE_CATEGORY_MAP["tires"] = "TY";
REVERSE_CATEGORY_MAP["tire"] = "TY";
REVERSE_CATEGORY_MAP["tyre & wheels"] = "TY";
REVERSE_CATEGORY_MAP["tyres & wheels"] = "TY";
REVERSE_CATEGORY_MAP["tire & wheels"] = "TY";
REVERSE_CATEGORY_MAP["tires & wheels"] = "TY";
REVERSE_CATEGORY_MAP["tyre and wheels"] = "TY";
REVERSE_CATEGORY_MAP["tyres and wheels"] = "TY";
REVERSE_CATEGORY_MAP["tire and wheels"] = "TY";
REVERSE_CATEGORY_MAP["tires and wheels"] = "TY";

function getCategoryCode(sheetValue: string): string {
  const normalized = String(sheetValue || "").trim().toLowerCase();
  
  // 1. Direct match
  if (REVERSE_CATEGORY_MAP[normalized]) {
    return REVERSE_CATEGORY_MAP[normalized];
  }
  
  // 2. Explicit Tyres / Tires synonyms
  if (normalized.includes("tyre") || normalized.includes("tire")) {
    return "TY";
  }
  
  // 3. Substring match against standard category labels
  for (const [code, label] of Object.entries(CATEGORY_MAP)) {
    const cleanLabel = label.toLowerCase();
    if (cleanLabel.includes(normalized) || normalized.includes(cleanLabel)) {
      return code;
    }
  }
  
  // 4. Custom common abbreviations/aliases
  if (normalized.includes("concrete pump") || normalized === "pump") return "CP";
  if (normalized.includes("mixing") || normalized.includes("mixer") || normalized === "drum") return "DM";
  if (normalized === "chassis" || normalized === "body") return "BD";
  if (normalized.includes("service") || normalized.includes("consumable")) return "PM";
  
  return "MS";
}

function getCategoryLabel(code: string): string {
  return CATEGORY_MAP[code] || code;
}

async function getSpreadsheetId() {
  const registry = await getCachedRegistry();
  const entry = registry.find((e) => e.sheet_key === SHEET_KEY);
  if (!entry) throw new Error(`'${SHEET_KEY}' not found in registry`);
  return entry.spreadsheet_id;
}

/** Dynamically map column headers → indices so column order doesn't matter */
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
    if (!rows || rows.length < 2) return NextResponse.json({ success: true, parts: [] });

    const idx = buildIndex(rows[0]);

    const parts = rows.slice(1)
      .filter((r) => r.length > 0 && col(r, idx, "part name", "name", "part").length > 0)
      .map((row) => {
        const name = col(row, idx, "part name", "name", "description", "part");
        let id = col(row, idx, "part id", "id", "part no", "part number", "code", "part #", "item #");
        
        if (!id) {
          // Fallback: slugify the name to get a stable, unique ID
          id = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "");
        }

        return {
          id,
          name,
          category:          getCategoryCode(col(row, idx, "category", "type", "fault category", "system", "group")),
          unit:              col(row, idx, "unit", "uom", "unit of measure") || "each",
          currentStock:      parseFloat(col(row, idx, "quantity", "qty", "stock", "on hand", "balance", "current stock") || "0"),
          lowStockThreshold: parseFloat(col(row, idx, "reorder", "reorder level", "min qty", "low threshold", "min stock") || "2"),
          driveUrl:          col(row, idx, "photo url", "photo", "image url", "image"),
          driveFileId:       col(row, idx, "file id", "drive file id"),
          notes:             col(row, idx, "notes", "remarks", "comment"),
          location:          col(row, idx, "location", "bin", "shelf"),
          createdAt:         Date.now(),
        };
      });

    return NextResponse.json({ success: true, parts });
  } catch (error) {
    console.error("GET /api/parts-catalogue failed:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const spreadsheetId = await getSpreadsheetId();
    const body = await request.json();
    const { part } = body;
    if (!part) return NextResponse.json({ success: false, error: "part is required" }, { status: 400 });

    // Read existing headers to match the sheet's own column order
    const rows = await getSheetValues(spreadsheetId, `'${PARTS_TAB}'!A1:Z1`);

    if (!rows || rows.length === 0) {
      // Sheet is empty — write headers then a row in a sensible default order
      await appendSheetRow(spreadsheetId, `'${PARTS_TAB}'!A:K`, [
        "Part ID", "Part Name", "Category", "Unit", "Quantity", "Reorder Level",
        "Photo URL", "Drive File ID", "Location", "Notes", "Created At",
      ]);
      await appendSheetRow(spreadsheetId, `'${PARTS_TAB}'!A:K`, [
        part.id, part.name, getCategoryLabel(part.category), part.unit || "each",
        String(part.currentStock ?? 0), String(part.lowStockThreshold ?? 2),
        part.driveUrl ? `=IMAGE("${part.driveUrl}")` : "",
        part.driveFileId || "", part.location || "", part.notes || "",
        new Date().toISOString(),
      ]);
    } else {
      // Match existing column order dynamically
      const headers = rows[0];
      const idx = buildIndex(headers);

      const rowValues = headers.map((h) => {
        const k = String(h).trim().toLowerCase();
        if (k.includes("part id") || k === "id" || k.includes("part no") || k.includes("part #") || k.includes("item #")) return part.id;
        if (k.includes("part name") || k === "name" || k === "description") return part.name;
        if (k.includes("category") || k === "type" || k === "system") return getCategoryLabel(part.category);
        if (k === "unit" || k === "uom") return part.unit || "each";
        if (k.includes("quantity") || k === "qty" || k.includes("stock") || k.includes("on hand") || k.includes("balance")) return String(part.currentStock ?? 0);
        if (k.includes("reorder") || k.includes("min qty") || k.includes("low threshold")) return String(part.lowStockThreshold ?? 2);
        if (k.includes("photo") || k.includes("image")) return part.driveUrl ? `=IMAGE("${part.driveUrl}")` : "";
        if (k.includes("file id") || k.includes("drive")) return part.driveFileId || "";
        if (k === "location" || k === "bin" || k === "shelf") return part.location || "";
        if (k.includes("note") || k.includes("remark")) return part.notes || "";
        if (k.includes("created") || k.includes("date")) return new Date().toISOString();
        return "";
      });

      await appendSheetRow(spreadsheetId, `'${PARTS_TAB}'!A:${columnLetter(headers.length)}`, rowValues);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/parts-catalogue failed:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

function columnLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function PUT(request: NextRequest) {
  try {
    const spreadsheetId = await getSpreadsheetId();
    const body = await request.json();
    const { id, updates } = body;
    if (!id || !updates) {
      return NextResponse.json({ success: false, error: "id and updates are required" }, { status: 400 });
    }

    // Read all rows to find the matching part ID row
    const rows = await getSheetValues(spreadsheetId, `'${PARTS_TAB}'!A1:Z2000`);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: "Sheet is empty" }, { status: 404 });
    }

    const headers = rows[0];
    const idx = buildIndex(headers);
    const idColIdx = idx("part id") !== -1 ? idx("part id") : 
                     idx("id") !== -1 ? idx("id") : 
                     idx("part no") !== -1 ? idx("part no") : 
                     idx("part #") !== -1 ? idx("part #") : 
                     idx("item #") !== -1 ? idx("item #") : -1;

    if (idColIdx === -1) {
      return NextResponse.json({ success: false, error: "Could not find part id column" }, { status: 400 });
    }

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idColIdx] && String(rows[i][idColIdx]).trim() === String(id).trim()) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json({ success: false, error: "Part not found in sheet" }, { status: 404 });
    }

    // Construct updated row values to overwrite the existing row
    const existingRow = rows[rowIndex];
    const rowValues = headers.map((h, i) => {
      const k = String(h).trim().toLowerCase();
      if (k.includes("part id") || k === "id" || k.includes("part no") || k.includes("part #") || k.includes("item #")) return id;
      if (k.includes("part name") || k === "name" || k === "description") return updates.name !== undefined ? updates.name : (existingRow[i] ?? "");
      if (k.includes("category") || k === "type" || k === "system") return updates.category !== undefined ? getCategoryLabel(updates.category) : (existingRow[i] ?? "");
      if (k === "unit" || k === "uom") return updates.unit !== undefined ? updates.unit : (existingRow[i] ?? "each");
      if (k.includes("quantity") || k === "qty" || k.includes("stock") || k.includes("on hand") || k.includes("balance")) {
        return updates.currentStock !== undefined ? String(updates.currentStock) : (existingRow[i] ?? "0");
      }
      if (k.includes("reorder") || k.includes("min qty") || k.includes("low threshold")) {
        return updates.lowStockThreshold !== undefined ? String(updates.lowStockThreshold) : (existingRow[i] ?? "2");
      }
      if (k.includes("photo") || k.includes("image")) {
        return updates.driveUrl !== undefined ? (updates.driveUrl ? `=IMAGE("${updates.driveUrl}")` : "") : (existingRow[i] ?? "");
      }
      if (k.includes("file id") || k.includes("drive")) return updates.driveFileId !== undefined ? updates.driveFileId : (existingRow[i] ?? "");
      if (k === "location" || k === "bin" || k === "shelf") return updates.location !== undefined ? updates.location : (existingRow[i] ?? "");
      if (k.includes("note") || k.includes("remark")) return updates.notes !== undefined ? updates.notes : (existingRow[i] ?? "");
      return existingRow[i] ?? "";
    });

    const range = `'${PARTS_TAB}'!A${rowIndex + 1}:${columnLetter(headers.length)}${rowIndex + 1}`;
    await updateSheetRange(spreadsheetId, range, [rowValues]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/parts-catalogue failed:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const spreadsheetId = await getSpreadsheetId();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "id parameter is required" }, { status: 400 });
    }

    const rows = await getSheetValues(spreadsheetId, `'${PARTS_TAB}'!A1:Z2000`);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: "Sheet is empty" }, { status: 404 });
    }

    const headers = rows[0];
    const idx = buildIndex(headers);
    const idColIdx = idx("part id") !== -1 ? idx("part id") : 
                     idx("id") !== -1 ? idx("id") : 
                     idx("part no") !== -1 ? idx("part no") : 
                     idx("part #") !== -1 ? idx("part #") : 
                     idx("item #") !== -1 ? idx("item #") : -1;

    if (idColIdx === -1) {
      return NextResponse.json({ success: false, error: "Could not find part id column" }, { status: 400 });
    }

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idColIdx] && String(rows[i][idColIdx]).trim() === String(id).trim()) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json({ success: false, error: "Part not found in sheet" }, { status: 404 });
    }

    // 1. Extract row values
    const rowValues = rows[rowIndex];

    // 2. Ensure "Archive" tab exists in the spreadsheet
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    
    const doc = await sheets.spreadsheets.get({ spreadsheetId });
    const archiveTabName = "Archive";
    const hasArchive = doc.data.sheets?.some((s) => s.properties?.title === archiveTabName);

    if (!hasArchive) {
      // Create Archive tab
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: archiveTabName,
                },
              },
            },
          ],
        },
      });
      // Write headers to the new Archive sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${archiveTabName}'!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [headers],
        },
      });
    }

    // 3. Move row values to Archive
    await appendSheetRow(spreadsheetId, `'${archiveTabName}'!A:Z`, rowValues);

    // 4. Delete the row from the active Parts tab
    await deleteSheetRow(spreadsheetId, PARTS_TAB, rowIndex);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/parts-catalogue failed:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

