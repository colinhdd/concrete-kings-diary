import { NextRequest, NextResponse } from "next/server";
import { getCachedRegistry, getCachedSheetValues, getSheetValues, appendSheetRow, updateSheetRange, deleteSheetRow } from "@/lib/sheets";

const SHEET_KEY = "parts-tools";
const USAGE_TAB = "Parts Usage";

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
    const { data: rows } = await getCachedSheetValues(spreadsheetId, `'${USAGE_TAB}'!A1:Z2000`, 30);
    if (!rows || rows.length < 2) return NextResponse.json({ success: true, events: [] });

    const idx = buildIndex(rows[0]);

    const events = rows.slice(1)
      .filter((r) => r.length > 0)
      .map((row) => ({
        id:        col(row, idx, "sync id", "id", "event id"),
        partId:    col(row, idx, "part id", "part no", "part number", "code"),
        partName:  col(row, idx, "part name", "name", "description", "part"),
        delta: (() => {
          const type = col(row, idx, "event type", "type", "action") || "usage";
          const rawDelta = parseFloat(col(row, idx, "qty used", "quantity used", "quantity", "qty", "delta", "amount") || "0");
          return type.toLowerCase() === "restock" ? rawDelta : -rawDelta;
        })(),
        eventType: col(row, idx, "event type", "type", "action") || "usage",
        attendant: col(row, idx, "mechanic", "attendant", "technician", "employee", "logged by", "by"),
        vehicle:   col(row, idx, "vehicle", "plate", "vehicle id", "truck"),
        notes:     col(row, idx, "notes", "remarks", "comment"),
        timestamp: (() => {
          const d = col(row, idx, "date", "timestamp", "datetime", "logged at");
          return d ? new Date(d).getTime() : Date.now();
        })(),
        status: "synced",
      }));

    events.reverse();
    return NextResponse.json({ success: true, events });
  } catch (error) {
    console.error("GET /api/parts-log failed:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const spreadsheetId = await getSpreadsheetId();
    const body = await request.json();
    const { events } = body;
    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ success: false, error: "events array is required" }, { status: 400 });
    }

    // Read existing headers to detect column order
    const rows = await getSheetValues(spreadsheetId, `'${USAGE_TAB}'!A1:Z1`);
    const hasHeaders = rows && rows.length > 0;

    // Fetch existing sync IDs to deduplicate
    const allRows = await getSheetValues(spreadsheetId, `'${USAGE_TAB}'!A1:Z2000`);
    const existingIds = new Set<string>();
    if (allRows && allRows.length > 1) {
      const idx = buildIndex(allRows[0]);
      const idPos = idx("sync id") !== -1 ? idx("sync id") : idx("id") !== -1 ? idx("id") : -1;
      allRows.slice(1).forEach((r) => {
        if (idPos !== -1 && r[idPos]) existingIds.add(String(r[idPos]).trim());
      });
    }

    const synced: string[] = [];
    const skipped: string[] = [];

    for (const ev of events) {
      const evId = String(ev.id || "").trim();
      if (evId && existingIds.has(evId)) { skipped.push(evId); continue; }

      if (!hasHeaders || !allRows || allRows.length === 0) {
        // Write default headers + row
        await appendSheetRow(spreadsheetId, `'${USAGE_TAB}'!A:J`, [
          "Date", "Part ID", "Part Name", "Qty Used", "Event Type",
          "Mechanic", "Vehicle", "Notes", "Sync ID",
        ]);
        await appendSheetRow(spreadsheetId, `'${USAGE_TAB}'!A:J`, [
          new Date(ev.timestamp || Date.now()).toLocaleDateString(),
          ev.partId || "", ev.partName || "",
          String(Math.abs(ev.delta ?? 0)),
          ev.eventType || "usage",
          ev.attendant || "",
          ev.vehicle || "",
          ev.notes || "",
          evId,
        ]);
      } else {
        // Match existing column order
        const headers = allRows[0];
        const idx = buildIndex(headers);

        const rowValues = headers.map((h) => {
          const k = String(h).trim().toLowerCase();
          if (k.includes("date") || k === "timestamp" || k === "datetime" || k.includes("logged at")) return new Date(ev.timestamp || Date.now()).toLocaleDateString();
          if (k.includes("part id") || k.includes("part no") || k.includes("code")) return ev.partId || "";
          if (k.includes("part name") || k === "name" || k === "description") return ev.partName || "";
          if (k.includes("qty") || k.includes("quantity") || k === "amount" || k === "delta") return String(Math.abs(ev.delta ?? 0));
          if (k.includes("event type") || k === "type" || k === "action") return ev.eventType || "usage";
          if (k.includes("mechanic") || k.includes("attendant") || k.includes("technician") || k.includes("employee") || k.includes("logged by") || k === "by") return ev.attendant || "";
          if (k.includes("vehicle") || k.includes("plate") || k.includes("truck")) return ev.vehicle || "";
          if (k.includes("note") || k.includes("remark") || k.includes("comment")) return ev.notes || "";
          if (k.includes("sync id") || k === "id" || k.includes("event id")) return evId;
          return "";
        });

        await appendSheetRow(spreadsheetId, `'${USAGE_TAB}'!A:${columnLetter(headers.length)}`, rowValues);
      }

      synced.push(evId);
    }

    return NextResponse.json({ success: true, synced, skipped });
  } catch (error) {
    console.error("POST /api/parts-log failed:", error);
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

    const rows = await getSheetValues(spreadsheetId, `'${USAGE_TAB}'!A1:Z2000`);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: "Sheet is empty" }, { status: 404 });
    }

    const headers = rows[0];
    const idx = buildIndex(headers);
    const idColIdx = idx("sync id") !== -1 ? idx("sync id") : idx("id") !== -1 ? idx("id") : -1;

    if (idColIdx === -1) {
      return NextResponse.json({ success: false, error: "Could not find sync id column" }, { status: 400 });
    }

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idColIdx] && String(rows[i][idColIdx]).trim() === String(id).trim()) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json({ success: false, error: "Transaction not found in sheet" }, { status: 404 });
    }

    const existingRow = rows[rowIndex];
    const rowValues = headers.map((h, i) => {
      const k = String(h).trim().toLowerCase();
      if (k.includes("sync id") || k === "id" || k.includes("event id")) return id;
      if (k.includes("date") || k === "timestamp" || k === "datetime" || k.includes("logged at")) return existingRow[i] ?? new Date().toLocaleDateString();
      if (k.includes("part id") || k.includes("part no") || k.includes("code")) return existingRow[i] ?? "";
      if (k.includes("part name") || k === "name" || k === "description") return existingRow[i] ?? "";

      if (k.includes("qty") || k.includes("quantity") || k === "amount" || k === "delta") {
        return updates.delta !== undefined ? String(Math.abs(updates.delta)) : (existingRow[i] ?? "0");
      }
      if (k.includes("event type") || k === "type" || k === "action") {
        return updates.eventType !== undefined ? updates.eventType : (existingRow[i] ?? "usage");
      }
      if (k.includes("mechanic") || k.includes("attendant") || k.includes("technician") || k.includes("employee") || k.includes("logged by") || k === "by") {
        return updates.attendant !== undefined ? updates.attendant : (existingRow[i] ?? "");
      }
      if (k.includes("vehicle") || k.includes("plate") || k.includes("truck")) {
        return updates.vehicle !== undefined ? updates.vehicle : (existingRow[i] ?? "");
      }
      if (k.includes("note") || k.includes("remark") || k.includes("comment")) {
        return updates.notes !== undefined ? updates.notes : (existingRow[i] ?? "");
      }
      return existingRow[i] ?? "";
    });

    const range = `'${USAGE_TAB}'!A${rowIndex + 1}:${columnLetter(headers.length)}${rowIndex + 1}`;
    await updateSheetRange(spreadsheetId, range, [rowValues]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/parts-log failed:", error);
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

    const rows = await getSheetValues(spreadsheetId, `'${USAGE_TAB}'!A1:Z2000`);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: "Sheet is empty" }, { status: 404 });
    }

    const headers = rows[0];
    const idx = buildIndex(headers);
    const idColIdx = idx("sync id") !== -1 ? idx("sync id") : idx("id") !== -1 ? idx("id") : -1;

    if (idColIdx === -1) {
      return NextResponse.json({ success: false, error: "Could not find sync id column" }, { status: 400 });
    }

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idColIdx] && String(rows[i][idColIdx]).trim() === String(id).trim()) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json({ success: false, error: "Transaction not found in sheet" }, { status: 404 });
    }

    await deleteSheetRow(spreadsheetId, USAGE_TAB, rowIndex);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/parts-log failed:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
