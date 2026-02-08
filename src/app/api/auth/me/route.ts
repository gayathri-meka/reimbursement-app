import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth";

export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({
    id: employee.id,
    email: employee.email,
    name: employee.name,
    role: employee.role,
    designation: employee.designation?.name || null,
    designationId: employee.designationId,
  });
}
