import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create designations
  const engineer = await prisma.designation.upsert({
    where: { name: "Software Engineer" },
    update: {},
    create: { name: "Software Engineer" },
  });

  const seniorEngineer = await prisma.designation.upsert({
    where: { name: "Senior Engineer" },
    update: {},
    create: { name: "Senior Engineer" },
  });

  const manager = await prisma.designation.upsert({
    where: { name: "Engineering Manager" },
    update: {},
    create: { name: "Engineering Manager" },
  });

  console.log("  Created designations:", engineer.name, seniorEngineer.name, manager.name);

  // Create limits
  const limitsData = [
    { designationId: engineer.id, category: "general", maxAmount: 500, period: "monthly" },
    { designationId: engineer.id, category: "travel", maxAmount: 1000, period: "monthly" },
    { designationId: engineer.id, category: "total", maxAmount: 2000, period: "monthly" },
    { designationId: seniorEngineer.id, category: "general", maxAmount: 1000, period: "monthly" },
    { designationId: seniorEngineer.id, category: "travel", maxAmount: 2000, period: "monthly" },
    { designationId: seniorEngineer.id, category: "total", maxAmount: 5000, period: "monthly" },
    { designationId: manager.id, category: "general", maxAmount: 2000, period: "monthly" },
    { designationId: manager.id, category: "travel", maxAmount: 5000, period: "monthly" },
    { designationId: manager.id, category: "total", maxAmount: 10000, period: "monthly" },
  ];

  for (const limit of limitsData) {
    await prisma.limit.upsert({
      where: {
        designationId_category: {
          designationId: limit.designationId,
          category: limit.category,
        },
      },
      update: { maxAmount: limit.maxAmount },
      create: limit,
    });
  }

  console.log("  Created limits for all designations");

  // Create admin user
  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.employee.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      email: "admin@company.com",
      passwordHash: adminHash,
      name: "Admin User",
      role: "ADMIN",
    },
  });

  console.log("  Created admin: admin@company.com / admin123");

  // Create sample employees
  const empHash = await bcrypt.hash("password123", 10);

  await prisma.employee.upsert({
    where: { email: "alice@company.com" },
    update: {},
    create: {
      email: "alice@company.com",
      passwordHash: empHash,
      name: "Alice Johnson",
      role: "EMPLOYEE",
      designationId: engineer.id,
    },
  });

  await prisma.employee.upsert({
    where: { email: "bob@company.com" },
    update: {},
    create: {
      email: "bob@company.com",
      passwordHash: empHash,
      name: "Bob Smith",
      role: "EMPLOYEE",
      designationId: seniorEngineer.id,
    },
  });

  await prisma.employee.upsert({
    where: { email: "carol@company.com" },
    update: {},
    create: {
      email: "carol@company.com",
      passwordHash: empHash,
      name: "Carol Williams",
      role: "EMPLOYEE",
      designationId: manager.id,
    },
  });

  console.log("  Created employees: alice, bob, carol (password: password123)");

  console.log("\nSeed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
