import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateReimbursementPdf } from "@/lib/pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const reimbursement = await prisma.reimbursement.findUnique({
    where: { id },
    include: {
      employee: { include: { designation: true } },
      expenses: true,
    },
  });

  if (!reimbursement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Employees can only download their own
  if (session.role !== "ADMIN" && reimbursement.employeeId !== session.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pdfBytes = await generateReimbursementPdf({
    employeeName: reimbursement.employee.name,
    designation: reimbursement.employee.designation?.name || "N/A",
    expenses: reimbursement.expenses.map((e) => ({
      vendor: e.vendor,
      date: e.date.toISOString().split("T")[0],
      amount: e.amount,
      category: e.category,
    })),
    totalAmount: reimbursement.totalAmount,
    submissionDate: reimbursement.submittedAt?.toISOString().split("T")[0] || reimbursement.createdAt.toISOString().split("T")[0],
    reimbursementId: reimbursement.id,
    currencySymbol: request.nextUrl.searchParams.get("currency") || "Rs.",
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="reimbursement-${id}.pdf"`,
    },
  });
}
