import { NextRequest, NextResponse } from "next/server";
import { getSheetValues, getGoogleAuth } from "@/lib/sheets";
import { google } from "googleapis";
import { MixDesign } from "@/lib/db-batching";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOK_BOOK_SPREADSHEET_ID = "1ZCi2rfLq-6uwavV7Ti8KSfNH_D591w7SSooWjlAa1Yw";
const COOK_BOOK_GID = "101711551";

function parseNum(val: any, fallback = 0): number {
  if (val === undefined || val === null) return fallback;
  const clean = String(val).trim().replace(/[^0-9.-]/g, "");
  if (!clean) return fallback;
  const n = parseFloat(clean);
  return isNaN(n) ? fallback : n;
}

function parseCsvRows(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/);
  const result: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    // Simple CSV parse handling quotes
    const row: string[] = [];
    let insideQuote = false;
    let entry = "";
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        insideQuote = !insideQuote;
      } else if (c === "," && !insideQuote) {
        row.push(entry.trim());
        entry = "";
      } else {
        entry += c;
      }
    }
    row.push(entry.trim());
    result.push(row);
  }
  return result;
}

function parseRecipesFromRows(rows: string[][]): MixDesign[] {
  if (!rows || rows.length <= 1) return [];

  const headerRow = rows[0].map((h: any) => String(h).trim().toLowerCase());
  const getCol = (names: string[]) => {
    for (const n of names) {
      const idx = headerRow.findIndex((h: string) => h === n || h.includes(n));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const codeIdx = getCol(["code", "mix code", "mix"]) !== -1 ? getCol(["code", "mix code", "mix"]) : 0;
  const nameIdx = getCol(["name", "desc", "description"]) !== -1 ? getCol(["name", "desc", "description"]) : 1;
  const strengthIdx = getCol(["strength", "psi"]) !== -1 ? getCol(["strength", "psi"]) : 2;
  const cementIdx = getCol(["cement"]) !== -1 ? getCol(["cement"]) : 3;
  const waterIdx = getCol(["water", "design water"]) !== -1 ? getCol(["water", "design water"]) : 4;
  const sandIdx = getCol(["sand"]) !== -1 ? getCol(["sand"]) : 5;
  const stone34Idx = getCol(["stone34", "3/4", "three quarter"]) !== -1 ? getCol(["stone34", "3/4", "three quarter"]) : 6;
  const stone38Idx = getCol(["stone38", "3/8", "three eighth"]) !== -1 ? getCol(["stone38", "3/8", "three eighth"]) : 7;
  const plastIdx = getCol(["plasticizer", "admixture"]) !== -1 ? getCol(["plasticizer", "admixture"]) : 8;
  const retardIdx = getCol(["retarder", "retard"]) !== -1 ? getCol(["retarder", "retard"]) : 9;

  const recipes: MixDesign[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const code = String(row[codeIdx] || "").trim();
    if (!code || code.toLowerCase() === "code" || code.toLowerCase() === "mix code") continue;

    const name = String(row[nameIdx] || "").trim();
    const strength = String(row[strengthIdx] || "").trim() || "3000 PSI";

    let placement = "Pump";
    if (code.startsWith("C-") || name.toLowerCase().includes("chute")) placement = "Direct Chute";
    else if (code.startsWith("S-") || name.toLowerCase().includes("slab")) placement = "Flatwork";
    else if (code.startsWith("W-") || name.toLowerCase().includes("wall")) placement = "Pump";

    recipes.push({
      id: `mix_${code.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      code: code.toUpperCase(),
      description: name || `${code} Concrete Mix`,
      strength: strength.includes("PSI") || strength.includes("psi") ? strength : `${strength} PSI`,
      placementType: placement,
      cement: parseNum(row[cementIdx], 240),
      sand: parseNum(row[sandIdx], 800),
      threeQuarterStone: parseNum(row[stone34Idx], 0),
      threeEighthStone: parseNum(row[stone38Idx], 0),
      designWater: parseNum(row[waterIdx], 120),
      plasticizer: parseNum(row[plastIdx], 0),
      retarder: parseNum(row[retardIdx], 0),
      version: 1,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return recipes;
}

export async function GET(request: NextRequest) {
  // Method 1: Try Direct Public/Export CSV fetch (fastest, zero auth failure risk)
  try {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${COOK_BOOK_SPREADSHEET_ID}/export?format=csv&gid=${COOK_BOOK_GID}`;
    const csvRes = await fetch(exportUrl, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });

    if (csvRes.ok) {
      const csvText = await csvRes.text();
      const rows = parseCsvRows(csvText);
      const recipes = parseRecipesFromRows(rows);
      if (recipes.length > 0) {
        return NextResponse.json({
          success: true,
          source: "google_sheet_csv",
          spreadsheetId: COOK_BOOK_SPREADSHEET_ID,
          gid: COOK_BOOK_GID,
          count: recipes.length,
          recipes,
        });
      }
    }
  } catch (csvErr) {
    console.warn("Direct CSV export fetch failed, attempting Google Sheets API:", csvErr);
  }

  // Method 2: Fallback to Google Sheets API
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const meta = await sheets.spreadsheets.get({ spreadsheetId: COOK_BOOK_SPREADSHEET_ID });
    const targetSheet =
      meta.data.sheets?.find(
        (s) =>
          String(s.properties?.sheetId) === COOK_BOOK_GID ||
          s.properties?.title === "Cooking Station"
      ) || meta.data.sheets?.[0];

    const tabTitle = targetSheet?.properties?.title || "Cooking Station";
    const rows = await getSheetValues(COOK_BOOK_SPREADSHEET_ID, `'${tabTitle}'!A1:Z100`);

    const recipes = parseRecipesFromRows(rows as string[][]);

    return NextResponse.json({
      success: true,
      source: "google_sheets_api",
      spreadsheetId: COOK_BOOK_SPREADSHEET_ID,
      tabTitle,
      count: recipes.length,
      recipes,
    });
  } catch (apiErr: any) {
    console.error("Failed to fetch recipes via Google Sheets API:", apiErr);
    return NextResponse.json(
      {
        success: false,
        error: apiErr.message || "Failed to fetch recipes from Google Sheet",
        spreadsheetId: COOK_BOOK_SPREADSHEET_ID,
      },
      { status: 500 }
    );
  }
}
