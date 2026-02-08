import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSession } from "@/lib/auth";
import { extractExpenseData } from "@/lib/ocr";
import { isSupabaseUrl, getSignedUrl } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileUrl } = await request.json();

  if (!fileUrl) {
    return NextResponse.json({ error: "fileUrl is required" }, { status: 400 });
  }

  try {
    // Convert local URLs (e.g. /uploads/...) to absolute file paths
    let resolvedPath = fileUrl;
    if (fileUrl.startsWith("/uploads/")) {
      resolvedPath = path.join(process.cwd(), "public", fileUrl);
    } else if (isSupabaseUrl(fileUrl)) {
      // Private bucket — create a signed URL so we can download/access the file
      resolvedPath = await getSignedUrl(fileUrl);
    }

    const expenses = await extractExpenseData(resolvedPath);

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("OCR extraction failed:", error);
    const message = error instanceof Error ? error.message : "OCR extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
