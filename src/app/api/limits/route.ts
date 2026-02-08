import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const limits = await prisma.limit.findMany({
    include: { designation: true },
    orderBy: { designation: { name: "asc" } },
  });

  return NextResponse.json(limits);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { designationId, category, maxAmount, period } = await request.json();

  if (!designationId || !category || maxAmount === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const limit = await prisma.limit.upsert({
    where: { designationId_category: { designationId, category } },
    update: { maxAmount, period: period || "monthly" },
    create: { designationId, category, maxAmount, period: period || "monthly" },
  });

  return NextResponse.json(limit, { status: 201 });
}
