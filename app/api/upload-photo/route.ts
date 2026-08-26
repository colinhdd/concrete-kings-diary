import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { getGoogleAuth } from "@/lib/sheets";
import { google } from "googleapis";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const partId = formData.get("partId") as string || "unknown";
    const partName = formData.get("partName") as string || "part";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const folderId = process.env.DRIVE_PARTS_FOLDER_ID;
    if (!folderId) {
      // Drive folder not configured yet — return local-only flag
      return NextResponse.json({
        success: false,
        localOnly: true,
        error: "DRIVE_PARTS_FOLDER_ID not configured. Photo stored locally only.",
      });
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Build a readable stream from buffer
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const auth = getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });

    // Sanitise filename
    const safeName = partName.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    const fileName = `${safeName}_${partId}_${Date.now()}.jpg`;

    // Upload to Drive
    const uploadRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: file.type || "image/jpeg",
      },
      media: {
        mimeType: file.type || "image/jpeg",
        body: stream,
      },
      fields: "id, webViewLink",
    });

    const fileId = uploadRes.data.id!;

    // Make publicly readable
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // Direct embed URL for use in Sheets =IMAGE() formula
    const url = `https://drive.google.com/uc?id=${fileId}`;

    return NextResponse.json({ success: true, url, fileId });
  } catch (error) {
    console.error("POST /api/upload-photo failed:", error);
    return NextResponse.json(
      { success: false, error: `Upload failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
