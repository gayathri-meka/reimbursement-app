import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { email } });
  if (!employee) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await verifyPassword(password, employee.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signToken({
    employeeId: employee.id,
    email: employee.email,
    role: employee.role,
  });

  const response = NextResponse.json({
    employee: {
      id: employee.id,
      email: employee.email,
      name: employee.name,
      role: employee.role,
    },
  });

  const cookie = setAuthCookie(token);
  response.cookies.set(cookie);

  return response;
}
