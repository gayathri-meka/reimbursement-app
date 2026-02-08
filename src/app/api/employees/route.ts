import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const employees = await prisma.employee.findMany({
    include: { designation: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    employees.map((e) => ({
      id: e.id,
      email: e.email,
      name: e.name,
      role: e.role,
      designation: e.designation?.name || null,
      designationId: e.designationId,
      createdAt: e.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { email, password, name, role, designationId } = await request.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const employee = await prisma.employee.create({
    data: { email, passwordHash, name, role: role || "EMPLOYEE", designationId },
  });

  return NextResponse.json({ id: employee.id, email: employee.email, name: employee.name }, { status: 201 });
}
