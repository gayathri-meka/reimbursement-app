import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { uploadFile } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const documents = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileUrl = await uploadFile(buffer, file.name, file.type);

    const doc = await prisma.document.create({
      data: {
        fileName: file.name,
        fileUrl,
        fileType: file.type,
      },
    });

    documents.push(doc);
  }

  return NextResponse.json({ documents }, { status: 201 });
}
