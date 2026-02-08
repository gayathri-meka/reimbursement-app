import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSession } from "@/lib/auth";
import { extractExpenseData } from "@/lib/ocr";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileUrl } = await request.json();

  if (!fileUrl) {
    return NextResponse.json({ error: "fileUrl is required" }, { status: 400 });
  }

  // Convert local URLs (e.g. /uploads/...) to absolute file paths
  let resolvedPath = fileUrl;
  if (fileUrl.startsWith("/uploads/")) {
    resolvedPath = path.join(process.cwd(), "public", fileUrl);
  }

  const expenses = await extractExpenseData(resolvedPath);

  return NextResponse.json({ expenses });
}
