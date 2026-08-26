import { NextRequest, NextResponse } from "next/server";
import { getCachedRegistry, getSheetValues, getGoogleAuth } from "@/lib/sheets";
import { google } from "googleapis";
import { MixDesign } from "@/lib/db-batching";

const COOK_BOOK_SPREADSHEET_ID = "1ZCi2rfLq-6uwavV7Ti8KSfNH_D591w7SSooWjlAa1Yw";

export async function GET(request: NextRequest) {
  try {
    let spreadsheetId = COOK_BOOK_SPREADSHEET_ID;

    // Check registry for cook-book
    try {
      const registry = await getCachedRegistry();
      const entry = registry.find((e) => e.sheet_key === "cook-book");
      if (entry && entry.spreadsheet_id) {
        spreadsheetId = entry.spreadsheet_id;
      }
    } catch (err) {
      console.warn("Could not read registry for cook-book:", err);
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // 1. Get metadata to find the exact tab (try "Cooking Station" or gid 101711551)
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const targetSheet =
      meta.data.sheets?.find(
        (s) =>
          String(s.properties?.sheetId) === "101711551" ||
          s.properties?.title === "Cooking Station"
      ) || meta.data.sheets?.[0];

    const tabTitle = targetSheet?.properties?.title || "Cooking Station";

    // 2. Fetch rows
    const rows = await getSheetValues(spreadsheetId, `'${tabTitle}'!A1:Z100`);

    if (!rows || rows.length <= 1) {
      return NextResponse.json({
        success: true,
        sheetTitle: meta.data.properties?.title,
        tabTitle,
        rawRows: rows,
        recipes: [],
      });
    }

    // 3. Parse headers dynamically
    const headerRow = rows[0].map((h: any) => String(h).trim().toLowerCase());
    const getCol = (names: string[]) => {
      for (const n of names) {
        const idx = headerRow.findIndex((h: string) => h.includes(n.toLowerCase()));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const codeIdx = getCol(["code", "mix"]) !== -1 ? getCol(["code", "mix"]) : 0;
    const nameIdx = getCol(["name", "desc", "description"]) !== -1 ? getCol(["name", "desc", "description"]) : 1;
    const strengthIdx = getCol(["strength", "psi"]) !== -1 ? getCol(["strength", "psi"]) : 2;
    const cementIdx = getCol(["cement"]) !== -1 ? getCol(["cement"]) : 3;
    const waterIdx = getCol(["water", "design water"]) !== -1 ? getCol(["water", "design water"]) : 4;
    const sandIdx = getCol(["sand"]) !== -1 ? getCol(["sand"]) : 5;
    const stone34Idx = getCol(["stone34", "3/4", "three quarter"]) !== -1 ? getCol(["stone34", "3/4", "three quarter"]) : 6;
    const stone38Idx = getCol(["stone38", "3/8", "three eighth"]) !== -1 ? getCol(["stone38", "3/8", "three eighth"]) : 7;
    const plastIdx = getCol(["plasticizer", "admixture"]) !== -1 ? getCol(["plasticizer", "admixture"]) : 8;
    const retardIdx = getCol(["retarder", "retard"]) !== -1 ? getCol(["retarder", "retard"]) : 9;

    const parseNum = (row: any[], idx: number, fallback = 0) => {
      if (idx === -1 || idx >= row.length) return fallback;
      const clean = String(row[idx] || "").replace(/[^0-9.-]/g, "");
      const n = parseFloat(clean);
      return isNaN(n) ? fallback : n;
    };

    const recipes: Partial<MixDesign>[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const code = String(row[codeIdx] || "").trim();
      if (!code || code.toLowerCase() === "code" || code.toLowerCase() === "mix code") continue;

      const name = String(row[nameIdx] || "").trim();
      const strength = String(row[strengthIdx] || "").trim() || "3000 PSI";

      // Detect placement type from code/name
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
        cement: parseNum(row, cementIdx, 240),
        sand: parseNum(row, sandIdx, 800),
        threeQuarterStone: parseNum(row, stone34Idx, 0),
        threeEighthStone: parseNum(row, stone38Idx, 0),
        designWater: parseNum(row, waterIdx, 120),
        plasticizer: parseNum(row, plastIdx, 480),
        retarder: parseNum(row, retardIdx, 360),
        version: 1,
        active: true,
      });
    }

    return NextResponse.json({
      success: true,
      sheetTitle: meta.data.properties?.title,
      tabTitle,
      rawHeaders: rows[0],
      recipes,
    });
  } catch (error: any) {
    const isPermissionError = error.message?.includes("permission") || error.code === 403;
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch recipes from Google Sheet",
        isPermissionError,
        serviceAccountEmail: "concrete-kings-central@concrete-kings-498820.iam.gserviceaccount.com",
        spreadsheetId: COOK_BOOK_SPREADSHEET_ID,
      },
      { status: isPermissionError ? 403 : 500 }
    );
  }
}
