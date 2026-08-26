import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_MIX_DESIGNS, DEFAULT_TRUCKS, DEFAULT_OBSERVATIONS, DEFAULT_ADJUSTMENTS } from "@/lib/db-batching";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      mixDesigns: DEFAULT_MIX_DESIGNS,
      trucks: DEFAULT_TRUCKS,
      observations: DEFAULT_OBSERVATIONS,
      adjustments: DEFAULT_ADJUSTMENTS,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load batching config" },
      { status: 500 }
    );
  }
}
