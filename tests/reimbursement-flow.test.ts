import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PDFDocument } from "pdf-lib";

// ── Mock getSession so route handlers think a user is logged in ──
let mockSession: { employeeId: string; email: string; role: string } | null = null;

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getSession: vi.fn(() => Promise.resolve(mockSession)),
  };
});

// ── Import route handlers AFTER mocking ──
const { POST: createReimbursement, GET: listReimbursements } = await import(
  "@/app/api/reimbursements/route"
);
const { POST: approveReimbursement } = await import(
  "@/app/api/reimbursements/[id]/approve/route"
);
const { POST: rejectReimbursement } = await import(
  "@/app/api/reimbursements/[id]/reject/route"
);
const { GET: downloadPdf } = await import(
  "@/app/api/reimbursements/[id]/pdf/route"
);

// ── DB client for setup / teardown / assertions ──
const prisma = new PrismaClient();

// ── Test data IDs ──
let designationId: string;
let employeeId: string;
let adminId: string;

// Track created reimbursement IDs for cleanup
const createdReimbursementIds: string[] = [];

// ── Helpers ──
function jsonRequest(body: unknown) {
  return new Request("http://localhost:3000/api/reimbursements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function pdfRequest(id: string, currency?: string) {
  const url = new URL(`http://localhost:3000/api/reimbursements/${id}/pdf`);
  if (currency) url.searchParams.set("currency", currency);
  return { nextUrl: url } as any;
}

// ── Setup & Teardown ──
beforeAll(async () => {
  // Create a test designation with limits
  const designation = await prisma.designation.create({
    data: { name: `TestDesig-${Date.now()}` },
  });
  designationId = designation.id;

  await prisma.limit.createMany({
    data: [
      { designationId, category: "travel", maxAmount: 1000, period: "monthly" },
      { designationId, category: "general", maxAmount: 500, period: "monthly" },
      { designationId, category: "total", maxAmount: 2000, period: "monthly" },
    ],
  });

  // Create a test employee
  const hash = await bcrypt.hash("testpass", 10);
  const employee = await prisma.employee.create({
    data: {
      email: `test-emp-${Date.now()}@test.com`,
      passwordHash: hash,
      name: "Test Employee",
      role: "EMPLOYEE",
      designationId,
    },
  });
  employeeId = employee.id;

  // Create a test admin
  const admin = await prisma.employee.create({
    data: {
      email: `test-admin-${Date.now()}@test.com`,
      passwordHash: hash,
      name: "Test Admin",
      role: "ADMIN",
    },
  });
  adminId = admin.id;
});

afterAll(async () => {
  // Clean up in order: reimbursements (cascade deletes expenses), employees, limits, designation
  for (const id of createdReimbursementIds) {
    await prisma.reimbursement.delete({ where: { id } }).catch(() => {});
  }
  await prisma.employee.delete({ where: { id: employeeId } }).catch(() => {});
  await prisma.employee.delete({ where: { id: adminId } }).catch(() => {});
  await prisma.limit.deleteMany({ where: { designationId } }).catch(() => {});
  await prisma.designation.delete({ where: { id: designationId } }).catch(() => {});
  await prisma.$disconnect();
});

beforeEach(() => {
  mockSession = null;
});

// ──────────────────────────────────────────────────────────────────────
// TESTS
// ──────────────────────────────────────────────────────────────────────

describe("Reimbursement Creation", () => {
  it("rejects unauthenticated requests", async () => {
    mockSession = null;
    const res = await createReimbursement(jsonRequest({ expenses: [] }));
    expect(res.status).toBe(401);
  });

  it("rejects when no expenses provided", async () => {
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const res = await createReimbursement(jsonRequest({ expenses: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("At least one expense");
  });

  it("rejects expenses with missing required fields", async () => {
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const res = await createReimbursement(
      jsonRequest({
        expenses: [{ vendor: "TestVendor" }], // missing date and amount
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("vendor, date, and amount");
  });

  it("creates a reimbursement with valid expenses", async () => {
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const res = await createReimbursement(
      jsonRequest({
        expenses: [
          { vendor: "Uber", date: "2025-03-01", amount: 350, category: "travel" },
          { vendor: "Office Supplies", date: "2025-03-02", amount: 150, category: "general" },
        ],
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    createdReimbursementIds.push(body.id);

    expect(body.status).toBe("SUBMITTED");
    expect(body.totalAmount).toBe(500);
    expect(body.expenses).toHaveLength(2);
    expect(body.employeeId).toBe(employeeId);

    // Verify in database
    const dbRecord = await prisma.reimbursement.findUnique({
      where: { id: body.id },
      include: { expenses: true },
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord!.status).toBe("SUBMITTED");
    expect(dbRecord!.expenses).toHaveLength(2);
    expect(dbRecord!.totalAmount).toBe(500);
  });

  it("enforces per-category expense limits", async () => {
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    // general limit is 500 — try to submit 600
    const res = await createReimbursement(
      jsonRequest({
        expenses: [
          { vendor: "BigPurchase", date: "2025-03-05", amount: 600, category: "general" },
        ],
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("exceeds limit");
    expect(body.error).toContain("500");
  });

  it("enforces total expense limit", async () => {
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    // total limit is 2000 — submit expenses that sum to 2500
    const res = await createReimbursement(
      jsonRequest({
        expenses: [
          { vendor: "Flight", date: "2025-03-06", amount: 900, category: "travel" },
          { vendor: "Hotel", date: "2025-03-07", amount: 900, category: "travel" },
          { vendor: "Supplies", date: "2025-03-08", amount: 400, category: "general" },
          { vendor: "More", date: "2025-03-09", amount: 300, category: "general" },
        ],
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("exceeds limit");
    expect(body.error).toContain("2000");
  });
});

describe("Admin Approval Flow", () => {
  let reimbursementId: string;

  beforeAll(async () => {
    // Create a reimbursement to approve/reject
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const res = await createReimbursement(
      jsonRequest({
        expenses: [
          { vendor: "TestExpense", date: "2025-04-01", amount: 200, category: "general" },
        ],
      })
    );
    const body = await res.json();
    reimbursementId = body.id;
    createdReimbursementIds.push(reimbursementId);
  });

  it("rejects approval from non-admin (employee)", async () => {
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const res = await approveReimbursement(
      {} as any,
      makeParams(reimbursementId)
    );
    expect(res.status).toBe(403);
  });

  it("rejects approval from unauthenticated user", async () => {
    mockSession = null;
    const res = await approveReimbursement(
      {} as any,
      makeParams(reimbursementId)
    );
    expect(res.status).toBe(403);
  });

  it("admin approves a reimbursement", async () => {
    mockSession = { employeeId: adminId, email: "admin@test.com", role: "ADMIN" };
    const res = await approveReimbursement(
      {} as any,
      makeParams(reimbursementId)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("APPROVED");
    expect(body.approvedAt).toBeTruthy();

    // Verify in database
    const dbRecord = await prisma.reimbursement.findUnique({
      where: { id: reimbursementId },
    });
    expect(dbRecord!.status).toBe("APPROVED");
    expect(dbRecord!.approvedAt).not.toBeNull();
  });
});

describe("Admin Rejection Flow", () => {
  let reimbursementId: string;

  beforeAll(async () => {
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const res = await createReimbursement(
      jsonRequest({
        expenses: [
          { vendor: "RejectMe", date: "2025-04-10", amount: 100, category: "general" },
        ],
      })
    );
    const body = await res.json();
    reimbursementId = body.id;
    createdReimbursementIds.push(reimbursementId);
  });

  it("rejects rejection from non-admin", async () => {
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const res = await rejectReimbursement(
      {} as any,
      makeParams(reimbursementId)
    );
    expect(res.status).toBe(403);
  });

  it("admin rejects a reimbursement", async () => {
    mockSession = { employeeId: adminId, email: "admin@test.com", role: "ADMIN" };
    const res = await rejectReimbursement(
      {} as any,
      makeParams(reimbursementId)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("REJECTED");

    // Verify in database
    const dbRecord = await prisma.reimbursement.findUnique({
      where: { id: reimbursementId },
    });
    expect(dbRecord!.status).toBe("REJECTED");
  });
});

describe("Reimbursement PDF Download", () => {
  let reimbursementId: string;

  beforeAll(async () => {
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const res = await createReimbursement(
      jsonRequest({
        expenses: [
          { vendor: "PdfTest", date: "2025-05-01", amount: 250, category: "general" },
          { vendor: "PdfTest2", date: "2025-05-02", amount: 175, category: "travel" },
        ],
      })
    );
    const body = await res.json();
    reimbursementId = body.id;
    createdReimbursementIds.push(reimbursementId);
  });

  it("rejects PDF download for unauthenticated user", async () => {
    mockSession = null;
    const res = await downloadPdf(pdfRequest(reimbursementId), makeParams(reimbursementId));
    expect(res.status).toBe(401);
  });

  it("returns a valid PDF for the owning employee", async () => {
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const res = await downloadPdf(pdfRequest(reimbursementId), makeParams(reimbursementId));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("reimbursement-");

    // Verify it's a valid PDF
    const buffer = await res.arrayBuffer();
    const doc = await PDFDocument.load(buffer);
    expect(doc.getPageCount()).toBe(1);
  });

  it("admin can download any employee's PDF", async () => {
    mockSession = { employeeId: adminId, email: "admin@test.com", role: "ADMIN" };
    const res = await downloadPdf(pdfRequest(reimbursementId), makeParams(reimbursementId));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("returns 404 for non-existent reimbursement", async () => {
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const res = await downloadPdf(
      pdfRequest("non-existent-id"),
      makeParams("non-existent-id")
    );
    expect(res.status).toBe(404);
  });
});

describe("Listing Reimbursements", () => {
  it("rejects unauthenticated listing", async () => {
    mockSession = null;
    const res = await listReimbursements();
    expect(res.status).toBe(401);
  });

  it("employee sees only their own reimbursements", async () => {
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const res = await listReimbursements();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // All results should belong to this employee
    for (const r of body) {
      expect(r.employeeId).toBe(employeeId);
    }
  });

  it("admin sees all reimbursements", async () => {
    mockSession = { employeeId: adminId, email: "admin@test.com", role: "ADMIN" };
    const res = await listReimbursements();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // Should include at least our test employee's records
    const testRecords = body.filter((r: any) => r.employeeId === employeeId);
    expect(testRecords.length).toBeGreaterThan(0);
  });
});

describe("Full End-to-End Flow", () => {
  it("employee creates → admin approves → employee downloads PDF", async () => {
    // Step 1: Employee submits a reimbursement
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const createRes = await createReimbursement(
      jsonRequest({
        expenses: [
          { vendor: "E2E Vendor", date: "2025-06-01", amount: 300, category: "general" },
          { vendor: "E2E Travel", date: "2025-06-02", amount: 450, category: "travel" },
        ],
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    createdReimbursementIds.push(created.id);
    expect(created.status).toBe("SUBMITTED");
    expect(created.totalAmount).toBe(750);

    // Step 2: Admin approves
    mockSession = { employeeId: adminId, email: "admin@test.com", role: "ADMIN" };
    const approveRes = await approveReimbursement(
      {} as any,
      makeParams(created.id)
    );
    expect(approveRes.status).toBe(200);
    const approved = await approveRes.json();
    expect(approved.status).toBe("APPROVED");

    // Step 3: Employee downloads PDF
    mockSession = { employeeId, email: "e@e.com", role: "EMPLOYEE" };
    const pdfRes = await downloadPdf(
      pdfRequest(created.id),
      makeParams(created.id)
    );
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("Content-Type")).toBe("application/pdf");

    const pdfBuffer = await pdfRes.arrayBuffer();
    const doc = await PDFDocument.load(pdfBuffer);
    expect(doc.getPageCount()).toBe(1);

    // Step 4: Verify final DB state
    const dbRecord = await prisma.reimbursement.findUnique({
      where: { id: created.id },
      include: { expenses: true },
    });
    expect(dbRecord!.status).toBe("APPROVED");
    expect(dbRecord!.approvedAt).not.toBeNull();
    expect(dbRecord!.totalAmount).toBe(750);
    expect(dbRecord!.expenses).toHaveLength(2);
  });
});
