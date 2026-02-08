import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where = session.role === "ADMIN" ? {} : { employeeId: session.employeeId };

  const reimbursements = await prisma.reimbursement.findMany({
    where,
    include: {
      employee: { select: { name: true, email: true, designation: true } },
      expenses: { include: { documents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(reimbursements);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { expenses } = await request.json();

  if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
    return NextResponse.json({ error: "At least one expense is required" }, { status: 400 });
  }

  // Validate all expenses have required fields
  for (const exp of expenses) {
    if (!exp.vendor || !exp.date || !exp.amount) {
      return NextResponse.json(
        { error: "Each expense must have vendor, date, and amount" },
        { status: 400 }
      );
    }
  }

  const totalAmount = expenses.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);

  // Check limits if employee has a designation
  const employee = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    include: { designation: true },
  });

  if (employee?.designationId) {
    const limits = await prisma.limit.findMany({
      where: { designationId: employee.designationId },
    });

    for (const exp of expenses) {
      const limit = limits.find(
        (l) => l.category === exp.category || l.category === "general"
      );
      if (limit && exp.amount > limit.maxAmount) {
        return NextResponse.json(
          {
            error: `Expense "${exp.vendor}" (${exp.amount}) exceeds limit of ${limit.maxAmount} for ${limit.category}`,
          },
          { status: 400 }
        );
      }
    }

    // Check total limit
    const totalLimit = limits.find((l) => l.category === "total");
    if (totalLimit && totalAmount > totalLimit.maxAmount) {
      return NextResponse.json(
        { error: `Total ${totalAmount} exceeds limit of ${totalLimit.maxAmount}` },
        { status: 400 }
      );
    }
  }

  const reimbursement = await prisma.reimbursement.create({
    data: {
      employeeId: session.employeeId,
      totalAmount,
      status: "SUBMITTED",
      submittedAt: new Date(),
      expenses: {
        create: expenses.map(
          (exp: { vendor: string; date: string; amount: number; category?: string; description?: string; documentIds?: string[] }) => ({
            vendor: exp.vendor,
            date: new Date(exp.date),
            amount: exp.amount,
            category: exp.category || "general",
            description: exp.description || null,
          })
        ),
      },
    },
    include: { expenses: true },
  });

  // Link documents to expenses if documentIds provided
  for (let i = 0; i < expenses.length; i++) {
    const docIds = expenses[i].documentIds;
    if (docIds && docIds.length > 0) {
      await prisma.document.updateMany({
        where: { id: { in: docIds } },
        data: { expenseId: reimbursement.expenses[i].id },
      });
    }
  }

  return NextResponse.json(reimbursement, { status: 201 });
}
