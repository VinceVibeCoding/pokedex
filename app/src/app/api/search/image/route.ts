// POST /api/search/image — search-by-photo. Accepts multipart/form-data with an
// "image" file, reads the card off it (vision), and returns the same result shape
// as GET /api/search so the UI can render both through one dropdown.

import { NextRequest, NextResponse } from "next/server";
import {
  IMAGE_SEARCH_ALLOWED_TYPES,
  IMAGE_SEARCH_MAX_BYTES,
  isImageSearchConfigured,
  searchByImage,
} from "@/serving/imageSearch";

export async function POST(request: NextRequest) {
  if (!isImageSearchConfigured()) {
    return NextResponse.json({ error: "Photo search isn't set up yet (no ANTHROPIC_API_KEY)." }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image was uploaded." }, { status: 400 });
  }
  if (!IMAGE_SEARCH_ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: `Unsupported image type: ${file.type || "unknown"}.` }, { status: 400 });
  }
  if (file.size > IMAGE_SEARCH_MAX_BYTES) {
    return NextResponse.json({ error: "That photo is too large (max 8MB)." }, { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const outcome = await searchByImage(base64, file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif");
    return NextResponse.json(outcome);
  } catch (err) {
    console.error("[search/image] failed:", err);
    return NextResponse.json({ error: "Couldn't read that photo — try again or type the name instead." }, { status: 502 });
  }
}
